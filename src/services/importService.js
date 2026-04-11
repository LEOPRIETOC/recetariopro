import {
  collection, doc, getDocs, addDoc, updateDoc,
  writeBatch, serverTimestamp, query, where,
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db } from '../lib/firebase'
import { toTitleCase } from '../lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function commitBatch(ops, onProgress) {
  let done = 0
  for (let i = 0; i < ops.length; i += 50) {
    const batch = writeBatch(db)
    const chunk = ops.slice(i, i + 50)
    for (const op of chunk) {
      if (op.type === 'set') batch.set(op.ref, op.data)
      else batch.update(op.ref, op.data)
    }
    await batch.commit()
    done += chunk.length
    if (onProgress) onProgress(Math.round((done / ops.length) * 100))
  }
}

// Detect recipe type from reference prefix
function detectType(reference, fallback) {
  const r = (reference || '').toUpperCase()
  if (r.startsWith('ONIREC') || r.startsWith('BARREC')) return 'recipe'
  if (r.startsWith('ONISUB') || r.startsWith('BARSB')) return 'subrecipe'
  return fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE LOADERS  (load once, reuse across all rows)
// ─────────────────────────────────────────────────────────────────────────────

async function loadCategories(restaurantId) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories'))
  const byCode = {}
  const byName = {}
  const byId = {}
  snap.docs.forEach((d) => {
    const data = d.data()
    byId[d.id] = { id: d.id, ...data }
    if (data.code) byCode[data.code.toUpperCase().trim()] = { id: d.id, ...data }
    if (data.name) byName[data.name.toUpperCase().trim()] = { id: d.id, ...data }
  })
  return { byCode, byName, byId }
}

async function loadMPs(restaurantId) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas'))
  const byRef = {}
  snap.docs.forEach((d) => {
    const ref = (d.data().reference || '').toUpperCase().trim()
    if (ref) byRef[ref] = { id: d.id, ...d.data() }
  })
  return byRef
}

async function loadSubrecipes(restaurantId) {
  const snap = await getDocs(
    query(collection(db, 'restaurants', restaurantId, 'recipes'), where('type', '==', 'subrecipe'))
  )
  const byRef = {}
  snap.docs.forEach((d) => {
    const ref = (d.data().reference || '').toUpperCase().trim()
    if (ref) byRef[ref] = { id: d.id, ...d.data() }
  })
  return byRef
}

async function loadSuppliers(restaurantId) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'suppliers'))
  const byCode = {}
  snap.docs.forEach((d) => {
    const code = (d.data().code || '').toUpperCase().trim()
    if (code) byCode[code] = { id: d.id, ...d.data() }
  })
  return byCode
}

async function getNextAutoCode(restaurantId, colName, prefix, pad) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, colName))
  const nums = snap.docs
    .map((d) => d.data().code || '')
    .filter((c) => new RegExp(`^${prefix}\\d+$`).test(c))
    .map((c) => parseInt(c.replace(prefix, ''), 10))
  return `${prefix}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(pad, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

function findCategoryId(menuCode, menuName, cats) {
  if (menuCode) {
    const hit = cats.byCode[menuCode.toUpperCase().trim()]
    if (hit) return { id: hit.id, code: hit.code, name: hit.name }
  }
  if (menuName) {
    const hit = cats.byName[menuName.toUpperCase().trim()]
    if (hit) return { id: hit.id, code: hit.code, name: hit.name }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// INGREDIENT LOOKUP  (MP first, then sub-recipe)
// ─────────────────────────────────────────────────────────────────────────────

function findIngredient(referenceMP, mpByRef, subByRef) {
  if (!referenceMP) return null
  const key = referenceMP.toUpperCase().trim()
  const mp = mpByRef[key]
  if (mp) return { ...mp, ingredientType: 'materia' }
  const sub = subByRef[key]
  if (sub) return { ...sub, ingredientType: 'subrecipe' }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP ROWS BY REFERENCIA (for recipe / subrecipe import)
// ─────────────────────────────────────────────────────────────────────────────

function groupRowsByReference(rows) {
  const groups = {}
  const order = []
  rows.forEach((row) => {
    const ref = row.REFERENCIA?.toString().trim()
    if (!ref) return
    if (!groups[ref]) { groups[ref] = { header: row, ingredients: [] }; order.push(ref) }
    if (row.REFERENCIA_MP?.toString().trim()) groups[ref].ingredients.push(row)
  })
  return order.map((r) => groups[r])
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD INGREDIENT OBJECT
// ─────────────────────────────────────────────────────────────────────────────

function buildIngredient(row, mpByRef, subByRef, warnings, rowLabel) {
  const refMP = row.REFERENCIA_MP?.toString().trim() || ''
  const nameMP = toTitleCase(row.NOMBRE_MP?.toString().trim() || '')
  const quantity = parseFloat(String(row.CANTIDAD || '0').replace(',', '.')) || 0
  const unit = row.UNIDAD?.toString().trim() || ''
  const waste = parseFloat(String(row.DESPERDICIO ?? row.DESP ?? '0').replace(',', '.')) || 0

  const found = refMP ? findIngredient(refMP, mpByRef, subByRef) : null
  if (refMP && !found) warnings.push(`${rowLabel}: REFERENCIA_MP '${refMP}' no encontrada — se vinculará si se importa después`)

  return {
    ingredientId: found?.id || null,
    ingredientType: found?.ingredientType || 'materia',
    ingredientName: nameMP || found?.name || '',
    reference: refMP || null,
    quantity,
    unit,
    wasteMargin: waste,
    pricePerUnit: found?.pricePerUnit || 0,
    baseCost: 0,
    wasteCost: 0,
    totalCost: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MENÚS
// ─────────────────────────────────────────────────────────────────────────────

export async function importMenus(restaurantId, rows, onProgress) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories'))
  const existing = {}
  snap.docs.forEach((d) => {
    const code = (d.data().code || '').toUpperCase().trim()
    if (code) existing[code] = { id: d.id, ...d.data() }
  })

  const result = { created: 0, updated: 0, warnings: [], errors: [], total: rows.length }
  const ops = []

  rows.forEach((row, idx) => {
    const n = idx + 2
    const code = row.CODIGO_MENU?.toString().trim()
    const name = row.NOMBRE_MENU?.toString().trim()
    if (!code) { result.errors.push(`Fila ${n}: CODIGO_MENU es requerido`); return }
    if (!name) { result.errors.push(`Fila ${n}: NOMBRE_MENU es requerido`); return }

    const displayName = toTitleCase(name)
    const key = code.toUpperCase()

    if (existing[key]) {
      ops.push({
        type: 'update', ref: doc(db, 'restaurants', restaurantId, 'categories', existing[key].id),
        data: { name: displayName, code, updatedAt: serverTimestamp() },
      })
      result.updated++
    } else {
      ops.push({
        type: 'set', ref: doc(collection(db, 'restaurants', restaurantId, 'categories')),
        data: { code, name: displayName, order: snap.docs.length + ops.length, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      })
      result.created++
    }
  })

  await commitBatch(ops, onProgress)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROVEEDORES
// ─────────────────────────────────────────────────────────────────────────────

export async function importSuppliers(restaurantId, rows, onProgress) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'suppliers'))
  const existing = {}
  snap.docs.forEach((d) => {
    const code = (d.data().code || '').toUpperCase().trim()
    if (code) existing[code] = { id: d.id }
  })

  const result = { created: 0, updated: 0, warnings: [], errors: [], total: rows.length }
  const ops = []

  rows.forEach((row, idx) => {
    const n = idx + 2
    const code = row.CODIGO_PROVEEDOR?.toString().trim()
    const name = row.NOMBRE_PROVEEDOR?.toString().trim()
    if (!code) { result.errors.push(`Fila ${n}: CODIGO_PROVEEDOR es requerido`); return }
    if (!name) { result.errors.push(`Fila ${n}: NOMBRE_PROVEEDOR es requerido`); return }

    const data = {
      code,
      name: toTitleCase(name),
      contact: row.CONTACTO?.toString().trim() || null,
      phone: row.CELULAR?.toString().trim() || null,
      address: row.DIRECCION?.toString().trim() || null,
      updatedAt: serverTimestamp(),
    }
    const key = code.toUpperCase()

    if (existing[key]) {
      ops.push({ type: 'update', ref: doc(db, 'restaurants', restaurantId, 'suppliers', existing[key].id), data })
      result.updated++
    } else {
      ops.push({ type: 'set', ref: doc(collection(db, 'restaurants', restaurantId, 'suppliers')), data: { ...data, createdAt: serverTimestamp() } })
      result.created++
    }
  })

  await commitBatch(ops, onProgress)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UNIDADES DE MEDIDA
// ─────────────────────────────────────────────────────────────────────────────

export async function importUnits(restaurantId, rows, onProgress) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'units'))
  const existing = {}
  snap.docs.forEach((d) => {
    const code = (d.data().code || '').toUpperCase().trim()
    if (code) existing[code] = { id: d.id }
  })

  const result = { created: 0, updated: 0, warnings: [], errors: [], total: rows.length }
  const ops = []

  rows.forEach((row, idx) => {
    const n = idx + 2
    const code = row.CODIGO?.toString().trim()
    const medida = row.MEDIDA?.toString().trim()
    const desc = row.DESCRIPCION?.toString().trim()
    const eqRaw = row.EQUIVALENCIA?.toString().trim()
    if (!code) { result.errors.push(`Fila ${n}: CODIGO es requerido`); return }
    if (!medida) { result.errors.push(`Fila ${n}: MEDIDA es requerida`); return }
    if (!desc) { result.errors.push(`Fila ${n}: DESCRIPCION es requerida`); return }
    const eq = parseFloat(eqRaw?.replace(',', '.'))
    if (!eqRaw || isNaN(eq)) { result.errors.push(`Fila ${n}: EQUIVALENCIA debe ser un número`); return }

    const data = { code, abbreviation: medida, name: toTitleCase(desc), equivalence: eq, updatedAt: serverTimestamp() }
    const key = code.toUpperCase()

    if (existing[key]) {
      ops.push({ type: 'update', ref: doc(db, 'restaurants', restaurantId, 'units', existing[key].id), data })
      result.updated++
    } else {
      ops.push({ type: 'set', ref: doc(collection(db, 'restaurants', restaurantId, 'units')), data: { ...data, createdAt: serverTimestamp() } })
      result.created++
    }
  })

  await commitBatch(ops, onProgress)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MATERIAS PRIMAS
// ─────────────────────────────────────────────────────────────────────────────

export async function importMaterias(restaurantId, rows, onProgress) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas'))
  const existingByRef = {}
  const existingCodes = []
  snap.docs.forEach((d) => {
    const ref = (d.data().reference || '').toUpperCase().trim()
    if (ref) existingByRef[ref] = { id: d.id }
    if (d.data().code) existingCodes.push(d.data().code)
  })

  let nextNum = existingCodes
    .filter((c) => /^MP\d+$/.test(c))
    .map((c) => parseInt(c.replace('MP', ''), 10))
    .reduce((a, b) => Math.max(a, b), 0)

  const suppliers = await loadSuppliers(restaurantId)
  const result = { created: 0, updated: 0, warnings: [], errors: [], total: rows.length }
  const ops = []

  rows.forEach((row, idx) => {
    const n = idx + 2
    const reference = row.REFERENCIA?.toString().trim()
    const name = row.NOMBRE?.toString().trim()
    const useUnit = row.UNIDAD_USO?.toString().trim()
    const purchaseUnit = row.UNIDAD_COMPRA?.toString().trim()

    if (!reference) { result.errors.push(`Fila ${n}: REFERENCIA es requerida`); return }
    if (!name) { result.errors.push(`Fila ${n}: NOMBRE es requerido`); return }
    if (!useUnit) { result.errors.push(`Fila ${n}: UNIDAD_USO es requerida`); return }

    const costRaw = row.COSTO?.toString().trim()
    if (!costRaw) result.warnings.push(`Fila ${n}: COSTO vacío, se importa en 0`)

    const cantRaw = row.CANT_PRESENTACION?.toString().trim()
    if (!cantRaw) result.warnings.push(`Fila ${n}: CANT_PRESENTACION vacío, se usa 1 por defecto`)

    const value = parseFloat((costRaw || '0').replace(',', '.')) || 0
    const qty = parseFloat((cantRaw || '1').replace(',', '.')) || 1
    const pricePerUnit = qty > 0 ? value / qty : 0

    const supplierCode = row.CODIGO_PROVEEDOR?.toString().trim() || null
    let supplierName = null
    if (supplierCode) {
      const sup = suppliers[supplierCode.toUpperCase()]
      if (sup) supplierName = sup.name
      else result.warnings.push(`Fila ${n}: proveedor '${supplierCode}' no encontrado`)
    }

    const data = {
      reference,
      name: toTitleCase(name),
      useUnit,
      purchaseUnit: purchaseUnit || null,
      quantityPerPresentation: qty,
      value,
      pricePerUnit,
      cost: value,
      supplierCode: supplierCode || null,
      supplier: supplierName || row.PROVEEDOR?.toString().trim() || null,
      category: row.CATEGORIA?.toString().trim() || 'General',
      updatedAt: serverTimestamp(),
    }
    const key = reference.toUpperCase()

    if (existingByRef[key]) {
      ops.push({ type: 'update', ref: doc(db, 'restaurants', restaurantId, 'materias_primas', existingByRef[key].id), data })
      result.updated++
    } else {
      nextNum++
      const code = `MP${String(nextNum).padStart(4, '0')}`
      ops.push({ type: 'set', ref: doc(collection(db, 'restaurants', restaurantId, 'materias_primas')), data: { ...data, code, createdAt: serverTimestamp() } })
      result.created++
    }
  })

  await commitBatch(ops, onProgress)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SUB-RECETAS
// ─────────────────────────────────────────────────────────────────────────────

export async function importSubrecipes(restaurantId, rows, onProgress) {
  const cats = await loadCategories(restaurantId)
  const mpByRef = await loadMPs(restaurantId)
  const subByRef = await loadSubrecipes(restaurantId)

  const existingSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  const existingByRef = {}
  const existingCodes = []
  existingSnap.docs.forEach((d) => {
    const ref = (d.data().reference || '').toUpperCase().trim()
    if (ref) existingByRef[ref] = { id: d.id }
    if (d.data().code) existingCodes.push(d.data().code)
  })

  let nextNum = existingCodes
    .filter((c) => /^SUB\d+$/.test(c))
    .map((c) => parseInt(c.replace('SUB', ''), 10))
    .reduce((a, b) => Math.max(a, b), 0)

  const result = { created: 0, updated: 0, warnings: [], errors: [], total: 0 }
  const groups = groupRowsByReference(rows)
  result.total = groups.length
  const ops = []

  for (const [gIdx, group] of groups.entries()) {
    if (onProgress) onProgress(Math.round((gIdx / groups.length) * 90))
    const { header: h, ingredients: ingRows } = group
    const reference = h.REFERENCIA?.toString().trim()
    const name = h.NOMBRE_RECETA?.toString().trim()
    const yieldAmount = parseFloat(String(h.RENDIMIENTO || '0').replace(',', '.'))
    const yieldUnit = h.UNIDAD_RENDIMIENTO?.toString().trim()

    if (!reference) { result.errors.push(`Grupo sin referencia — fila omitida`); continue }
    if (!name) { result.errors.push(`Ref ${reference}: NOMBRE_RECETA es requerido`); continue }
    if (!yieldAmount || yieldAmount <= 0) { result.errors.push(`Ref ${reference}: RENDIMIENTO debe ser mayor a 0`); continue }
    if (!yieldUnit) { result.errors.push(`Ref ${reference}: UNIDAD_RENDIMIENTO es requerida`); continue }

    const type = detectType(reference, 'subrecipe')
    const preparation = ingRows.map((r) => r.PREPARACION?.toString().trim()).filter(Boolean).join('\n') || h.PREPARACION?.toString().trim() || ''

    const ingredients = ingRows.map((row) =>
      buildIngredient(row, mpByRef, subByRef, result.warnings, `Ref ${reference}`)
    ).filter((i) => i.ingredientName || i.reference)

    const docData = {
      reference,
      name: name.toUpperCase(),
      type,
      isSubRecipe: true,
      active: true,
      categoryId: null,
      menuCode: 'SUBRECETA',
      menuName: 'Sub-recetas',
      sellingPrice: 0,
      yield: yieldAmount,
      yieldAmount,
      yieldUnit,
      costPerYieldUnit: 0,
      preparation,
      ingredients,
      version: 1,
      updatedAt: serverTimestamp(),
    }

    const key = reference.toUpperCase()
    if (existingByRef[key]) {
      ops.push({ type: 'update', ref: doc(db, 'restaurants', restaurantId, 'recipes', existingByRef[key].id), data: docData })
      result.updated++
    } else {
      nextNum++
      ops.push({
        type: 'set', ref: doc(collection(db, 'restaurants', restaurantId, 'recipes')),
        data: { ...docData, code: `SUB${String(nextNum).padStart(3, '0')}`, order: Date.now() + nextNum, createdAt: serverTimestamp() },
      })
      result.created++
    }
  }

  await commitBatch(ops, (p) => { if (onProgress) onProgress(90 + Math.round(p * 0.1)) })
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECETAS
// ─────────────────────────────────────────────────────────────────────────────

export async function importRecipes(restaurantId, rows, onProgress) {
  const cats = await loadCategories(restaurantId)
  const mpByRef = await loadMPs(restaurantId)
  const subByRef = await loadSubrecipes(restaurantId)

  const existingSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  const existingByRef = {}
  const existingCodes = []
  existingSnap.docs.forEach((d) => {
    const ref = (d.data().reference || '').toUpperCase().trim()
    if (ref) existingByRef[ref] = { id: d.id }
    if (d.data().code) existingCodes.push(d.data().code)
  })

  let nextNum = existingCodes
    .filter((c) => /^REC\d+$/.test(c))
    .map((c) => parseInt(c.replace('REC', ''), 10))
    .reduce((a, b) => Math.max(a, b), 0)

  const result = { created: 0, updated: 0, warnings: [], errors: [], total: 0 }
  const groups = groupRowsByReference(rows)
  result.total = groups.length
  const ops = []

  for (const [gIdx, group] of groups.entries()) {
    if (onProgress) onProgress(Math.round((gIdx / groups.length) * 90))
    const { header: h, ingredients: ingRows } = group
    const reference = h.REFERENCIA?.toString().trim()
    const name = h.NOMBRE_RECETA?.toString().trim()
    const menuCode = h.CODIGO_MENU?.toString().trim()

    if (!reference) { result.errors.push(`Grupo sin referencia — fila omitida`); continue }
    if (!name) { result.errors.push(`Ref ${reference}: NOMBRE_RECETA es requerido`); continue }
    if (!menuCode) { result.errors.push(`Ref ${reference}: CODIGO_MENU es requerido`); continue }

    const menuName = h.MENU?.toString().trim() || ''
    const catMatch = findCategoryId(menuCode, menuName, cats)
    if (!catMatch) { result.errors.push(`Ref ${reference}: menú '${menuCode}' no encontrado en Firestore — importa menús primero`); continue }

    const sellingPrice = parseFloat(String(h.PRECIO_VENTA || '0').replace(',', '.')) || 0
    if (!h.PRECIO_VENTA?.toString().trim()) result.warnings.push(`Ref ${reference}: PRECIO_VENTA vacío, se guarda en 0`)

    const type = detectType(reference, 'recipe')
    const preparation = ingRows.map((r) => r.PREPARACION?.toString().trim()).filter(Boolean).join('\n') || h.PREPARACION?.toString().trim() || ''

    const ingredients = ingRows.map((row) =>
      buildIngredient(row, mpByRef, subByRef, result.warnings, `Ref ${reference}`)
    ).filter((i) => i.ingredientName || i.reference)

    const docData = {
      reference,
      name: name.toUpperCase(),
      type,
      active: true,
      categoryId: catMatch.id,
      menuCode: catMatch.code || menuCode,
      menuName: catMatch.name || menuName,
      sellingPrice,
      preparation,
      ingredients,
      version: 1,
      updatedAt: serverTimestamp(),
    }

    const key = reference.toUpperCase()
    if (existingByRef[key]) {
      ops.push({ type: 'update', ref: doc(db, 'restaurants', restaurantId, 'recipes', existingByRef[key].id), data: docData })
      result.updated++
    } else {
      nextNum++
      ops.push({
        type: 'set', ref: doc(collection(db, 'restaurants', restaurantId, 'recipes')),
        data: { ...docData, code: `REC${String(nextNum).padStart(3, '0')}`, order: Date.now() + nextNum, createdAt: serverTimestamp() },
      })
      result.created++
    }
  }

  await commitBatch(ops, (p) => { if (onProgress) onProgress(90 + Math.round(p * 0.1)) })
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

const ORDER_NOTE = 'Orden de importación recomendado: 1. Unidades  2. Menús  3. Proveedores  4. Materias Primas  5. Sub-recetas  6. Recetas'

function buildInstructionsSheet(fields) {
  // fields: [{ col, required, note }]
  const rows = [
    { CAMPO: '=== INSTRUCCIONES ===' , REQUERIDO: '', DESCRIPCION: '' },
    { CAMPO: ORDER_NOTE, REQUERIDO: '', DESCRIPCION: '' },
    { CAMPO: '', REQUERIDO: '', DESCRIPCION: '' },
    { CAMPO: 'CAMPO', REQUERIDO: 'REQUERIDO', DESCRIPCION: 'DESCRIPCION' },
    ...fields.map((f) => ({
      CAMPO: f.col,
      REQUERIDO: f.required ? '* Requerido' : '(opcional)',
      DESCRIPCION: f.note || '',
    })),
  ]
  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true })
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 60 }]
  return ws
}

function makeWorkbook(dataRows, dataSheetName, instructionsWs) {
  const ws = XLSX.utils.json_to_sheet(dataRows)
  ws['!cols'] = Object.keys(dataRows[0] || {}).map(() => ({ wch: 22 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, dataSheetName)
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'INSTRUCCIONES')
  return wb
}

export function generateMenuTemplate() {
  const rows = [
    { CODIGO_MENU: 'BAR01', NOMBRE_MENU: 'AD BEBIDAS' },
    { CODIGO_MENU: 'ONI01', NOMBRE_MENU: 'Nigiris' },
  ]
  const inst = buildInstructionsSheet([
    { col: 'CODIGO_MENU',  required: true,  note: 'Código único del menú/categoría. Debe coincidir con CODIGO_MENU en el archivo de recetas.' },
    { col: 'NOMBRE_MENU',  required: true,  note: 'Nombre visible del menú.' },
  ])
  XLSX.writeFile(makeWorkbook(rows, 'Menús', inst), 'plantilla_menus.xlsx')
}

export function generateSupplierTemplate() {
  const rows = [
    { CODIGO_PROVEEDOR: '8355533', NOMBRE_PROVEEDOR: 'CARMONA OCHOA JUAN FELIPE', CONTACTO: '', CELULAR: '', DIRECCION: '' },
  ]
  const inst = buildInstructionsSheet([
    { col: 'CODIGO_PROVEEDOR',  required: true,  note: 'Código único del proveedor. Debe coincidir con CODIGO_PROVEEDOR en Materias Primas.' },
    { col: 'NOMBRE_PROVEEDOR',  required: true,  note: 'Nombre o razón social del proveedor.' },
    { col: 'CONTACTO',          required: false, note: 'Nombre de la persona de contacto.' },
    { col: 'CELULAR',           required: false, note: 'Teléfono de contacto.' },
    { col: 'DIRECCION',         required: false, note: 'Dirección del proveedor.' },
  ])
  XLSX.writeFile(makeWorkbook(rows, 'Proveedores', inst), 'plantilla_proveedores.xlsx')
}

export function generateUnitTemplate() {
  const rows = [
    { CODIGO: 'UND001', MEDIDA: 'G',  DESCRIPCION: 'GRAMO',      EQUIVALENCIA: 1 },
    { CODIGO: 'UND002', MEDIDA: 'KG', DESCRIPCION: 'KILOGRAMO',  EQUIVALENCIA: 1000 },
    { CODIGO: 'UND003', MEDIDA: 'ML', DESCRIPCION: 'MILILITRO',  EQUIVALENCIA: 1 },
    { CODIGO: 'UND004', MEDIDA: 'L',  DESCRIPCION: 'LITRO',      EQUIVALENCIA: 1000 },
  ]
  const inst = buildInstructionsSheet([
    { col: 'CODIGO',       required: true,  note: 'Código único de la unidad (ej: UND001).' },
    { col: 'MEDIDA',       required: true,  note: 'Abreviación usada en recetas (ej: G, KG, ML).' },
    { col: 'DESCRIPCION',  required: true,  note: 'Nombre completo de la unidad.' },
    { col: 'EQUIVALENCIA', required: true,  note: 'Factor de conversión a la unidad base (ej: KG=1000 para convertir a gramos).' },
  ])
  XLSX.writeFile(makeWorkbook(rows, 'Unidades', inst), 'plantilla_unidades.xlsx')
}

export function generateMateriaTemplate(units = []) {
  const cols = ['REFERENCIA', 'NOMBRE', 'UNIDAD_USO', 'UNIDAD_COMPRA', 'CANT_PRESENTACION', 'COSTO', 'CODIGO_PROVEEDOR', 'CATEGORIA']
  const noteRow = ['** UNIDAD_USO y UNIDAD_COMPRA: usar abreviaturas de la hoja "UNIDADES VÁLIDAS" **']
  const aoa = [
    cols,
    noteRow,
    ['MP1000002', 'ACEITE PARA FREIR', 'ML', 'MILILITROS', '1000', '0',    '',        'Aceites'],
    ['MP1000058', 'ARROZ SUSHI',       'G',  'KG',         '1000', '5000', '8355533', 'Granos'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = cols.map(() => ({ wch: 22 }))

  // INSTRUCCIONES sheet
  const inst = buildInstructionsSheet([
    { col: 'REFERENCIA',        required: true,  note: 'Código único de la materia prima (ej: MP1000001). Se usa para vincular ingredientes en recetas.' },
    { col: 'NOMBRE',            required: true,  note: 'Nombre de la materia prima.' },
    { col: 'UNIDAD_USO',        required: true,  note: 'Unidad con la que se usa en recetas (ej: G, ML). Ver hoja UNIDADES VÁLIDAS.' },
    { col: 'UNIDAD_COMPRA',     required: false, note: 'Unidad con la que se compra al proveedor. Ver hoja UNIDADES VÁLIDAS.' },
    { col: 'CANT_PRESENTACION', required: false, note: 'Cantidad que trae la presentación en UNIDAD_USO (ej: botella 1000ml → 1000). Si vacío → 1.' },
    { col: 'COSTO',             required: false, note: 'Costo total de la presentación. Se divide entre CANT_PRESENTACION para obtener precio por unidad. Si vacío → 0.' },
    { col: 'CODIGO_PROVEEDOR',  required: false, note: 'Código del proveedor (debe estar importado primero).' },
    { col: 'CATEGORIA',         required: false, note: 'Categoría para agrupar. Ver hoja CATEGORÍAS SUGERIDAS.' },
  ])

  // UNIDADES VÁLIDAS sheet
  const defaultUnits = [
    ['G',   'GRAMO',      1],
    ['KG',  'KILOGRAMO',  1000],
    ['ML',  'MILILITRO',  1],
    ['LT',  'LITRO',      1000],
    ['UND', 'UNIDAD',     1],
    ['OZ',  'ONZA',       28.35],
    ['LB',  'LIBRA',      453.59],
  ]
  const unitRows = units.length > 0
    ? units.map((u) => [u.abbreviation || u.medida || '', u.name || u.descripcion || '', u.equivalence ?? u.equivalencia ?? ''])
    : defaultUnits
  const wsUnits = XLSX.utils.aoa_to_sheet([['ABREVIATURA', 'DESCRIPCION', 'EQUIVALENCIA'], ...unitRows])
  wsUnits['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 14 }]

  // CATEGORÍAS SUGERIDAS sheet
  const cats = ['Abarrotes','Fruver','Lácteos','Carnes','Mariscos','Licores','Bebidas','Especias','Salsas','Aceites','Otros']
  const wsCats = XLSX.utils.aoa_to_sheet([['CATEGORIA'], ...cats.map((c) => [c])])
  wsCats['!cols'] = [{ wch: 20 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws,      'Materias Primas')
  XLSX.utils.book_append_sheet(wb, inst,    'INSTRUCCIONES')
  XLSX.utils.book_append_sheet(wb, wsUnits, 'UNIDADES VÁLIDAS')
  XLSX.utils.book_append_sheet(wb, wsCats,  'CATEGORÍAS SUGERIDAS')
  XLSX.writeFile(wb, 'plantilla_materias_primas.xlsx')
}

export function generateSubrecipeTemplate() {
  const rows = [
    { REFERENCIA: 'ONISUB001', NOMBRE_RECETA: 'ARROZ SHARI', RENDIMIENTO: 1000, UNIDAD_RENDIMIENTO: 'G', REFERENCIA_MP: 'MP1000058', NOMBRE_MP: 'ARROZ SUSHI',  CANTIDAD: 508, UNIDAD: 'G',  DESPERDICIO: 0, PREPARACION: '' },
    { REFERENCIA: 'ONISUB001', NOMBRE_RECETA: 'ARROZ SHARI', RENDIMIENTO: 1000, UNIDAD_RENDIMIENTO: 'G', REFERENCIA_MP: 'MP1000036', NOMBRE_MP: 'ALGA KOMBU',  CANTIDAD: 3,   UNIDAD: 'G',  DESPERDICIO: 0, PREPARACION: '' },
  ]
  const inst = buildInstructionsSheet([
    { col: 'REFERENCIA',         required: true,  note: 'Código único de la sub-receta. REPETIR en cada fila de ingrediente de la misma sub-receta.' },
    { col: 'NOMBRE_RECETA',      required: true,  note: 'Nombre de la sub-receta. Repetir en cada fila.' },
    { col: 'RENDIMIENTO',        required: true,  note: 'Cantidad que produce la sub-receta (ej: 1000). Repetir en cada fila.' },
    { col: 'UNIDAD_RENDIMIENTO', required: true,  note: 'Unidad del rendimiento (ej: G, ML). Repetir en cada fila.' },
    { col: 'REFERENCIA_MP',      required: true,  note: 'Referencia de la materia prima o sub-receta usada como ingrediente.' },
    { col: 'NOMBRE_MP',          required: true,  note: 'Nombre del ingrediente (referencial, se prioriza el nombre registrado en Materias Primas).' },
    { col: 'CANTIDAD',           required: true,  note: 'Cantidad del ingrediente.' },
    { col: 'UNIDAD',             required: true,  note: 'Unidad del ingrediente.' },
    { col: 'DESPERDICIO',        required: false, note: 'Porcentaje de desperdicio en número entero (ej: 5 = 5%). Dejar en 0 si no aplica.' },
    { col: 'PREPARACION',        required: false, note: 'Instrucciones de preparación (puede dejarse vacío).' },
    { col: '',                   required: false, note: 'NOTA: Una fila por ingrediente. Filas con la misma REFERENCIA se agrupan en una sub-receta.' },
  ])
  XLSX.writeFile(makeWorkbook(rows, 'Sub-recetas', inst), 'plantilla_subrecetas.xlsx')
}

export function generateRecipeTemplate() {
  const rows = [
    { REFERENCIA: 'ONIREC001', NOMBRE_RECETA: 'AD ZUMO LIMON', CODIGO_MENU: 'BAR01', PRECIO_VENTA: 0, REFERENCIA_MP: 'ONISUB001',  NOMBRE_MP: 'ARROZ SHARI',   CANTIDAD: 45,  UNIDAD: 'ML', DESPERDICIO: 0, PREPARACION: '' },
    { REFERENCIA: 'ONIREC001', NOMBRE_RECETA: 'AD ZUMO LIMON', CODIGO_MENU: 'BAR01', PRECIO_VENTA: 0, REFERENCIA_MP: 'MP2000082',  NOMBRE_MP: 'LIMON TAHITI',  CANTIDAD: 4.5, UNIDAD: 'G',  DESPERDICIO: 5, PREPARACION: '' },
  ]
  const inst = buildInstructionsSheet([
    { col: 'REFERENCIA',    required: true,  note: 'Código único de la receta. REPETIR en cada fila de ingrediente de la misma receta.' },
    { col: 'NOMBRE_RECETA', required: true,  note: 'Nombre de la receta. Repetir en cada fila.' },
    { col: 'CODIGO_MENU',   required: true,  note: 'Código del menú/categoría (debe existir en Firestore — importar Menús primero).' },
    { col: 'PRECIO_VENTA',  required: false, note: 'Precio de venta de la receta. Si se deja vacío se importa en 0.' },
    { col: 'REFERENCIA_MP', required: true,  note: 'Referencia de la materia prima o sub-receta usada como ingrediente.' },
    { col: 'NOMBRE_MP',     required: true,  note: 'Nombre del ingrediente (referencial).' },
    { col: 'CANTIDAD',      required: true,  note: 'Cantidad del ingrediente.' },
    { col: 'UNIDAD',        required: true,  note: 'Unidad del ingrediente.' },
    { col: 'DESPERDICIO',   required: false, note: 'Porcentaje de desperdicio en número entero (ej: 5 = 5%). Dejar en 0 si no aplica.' },
    { col: 'PREPARACION',   required: false, note: 'Instrucciones de preparación (puede dejarse vacío).' },
    { col: '',              required: false, note: 'NOTA: Una fila por ingrediente. Filas con la misma REFERENCIA se agrupan en una receta.' },
  ])
  XLSX.writeFile(makeWorkbook(rows, 'Recetas', inst), 'plantilla_recetas.xlsx')
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function exportToExcel(data, columns, filename) {
  const rows = data.map((item) => {
    const row = {}
    columns.forEach((col) => { row[col.header] = item[col.field] ?? '' })
    return row
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = columns.map((col) => ({ wch: Math.max(col.header.length, 15) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, filename + '.xlsx')
}

export async function exportRecipes(restaurantId, type = 'recipe') {
  const catsSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories'))
  const catById = {}
  catsSnap.docs.forEach((d) => { catById[d.id] = d.data() })

  const recipesSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  const recipes = recipesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.type === type || (type === 'recipe' && !r.type))

  const rows = []
  recipes.forEach((recipe) => {
    const cat = catById[recipe.categoryId] || {}
    const base = {
      REFERENCIA: recipe.reference || '',
      NOMBRE_RECETA: recipe.name || '',
      CODIGO_MENU: recipe.menuCode || cat.code || '',
      MENU: recipe.menuName || cat.name || '',
      PRECIO_VENTA: recipe.sellingPrice || 0,
      RENDIMIENTO: recipe.yieldAmount || '',
      UNIDAD_RENDIMIENTO: recipe.yieldUnit || '',
    }
    if (!recipe.ingredients?.length) {
      rows.push(base)
    } else {
      recipe.ingredients.forEach((ing) => {
        rows.push({ ...base, REFERENCIA_MP: ing.reference || '', NOMBRE_MP: ing.ingredientName || '', CANTIDAD: ing.quantity || 0, UNIDAD: ing.unit || '', DESPERDICIO: ing.wasteMargin || 0 })
      })
    }
  })

  const sheetName = type === 'subrecipe' ? 'Sub-recetas' : 'Recetas'
  const fileName = (type === 'subrecipe' ? 'subrecetas' : 'recetas') + '_recetariopro.xlsx'
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX ALL IMPORTED DATA  (comprehensive migration)
// ─────────────────────────────────────────────────────────────────────────────

export async function fixAllImportedData(restaurantId) {
  const cats = await loadCategories(restaurantId)
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  let fixed = 0
  const errors = []

  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db)
    let batchHasOps = false

    for (const d of snap.docs.slice(i, i + 500)) {
      const data = d.data()
      const ref = data.reference || ''
      const updates = {}

      // 1. Fix type from reference prefix
      const correctType = detectType(ref, null)
      if (correctType && data.type !== correctType) updates.type = correctType

      const effectiveType = updates.type || data.type

      // 2. Sub-recetas: clear categoryId, set fixed menu fields
      if (effectiveType === 'subrecipe') {
        if (data.categoryId !== null) updates.categoryId = null
        if (!data.menuCode || data.menuCode !== 'SUBRECETA') updates.menuCode = 'SUBRECETA'
        if (!data.menuName || data.menuName !== 'Sub-recetas') updates.menuName = 'Sub-recetas'
      }

      // 3. Recetas: fix empty categoryId using menuCode or menuName
      if (effectiveType !== 'subrecipe' && !data.categoryId) {
        const menuIdentifier = data.menuCode || data.menuName || data.menu
        if (menuIdentifier) {
          const catMatch = findCategoryId(menuIdentifier, menuIdentifier, cats)
          if (catMatch) {
            updates.categoryId = catMatch.id
            if (!data.menuCode) updates.menuCode = catMatch.code
            if (!data.menuName) updates.menuName = catMatch.name
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        batch.update(
          doc(db, 'restaurants', restaurantId, 'recipes', d.id),
          { ...updates, updatedAt: serverTimestamp() }
        )
        fixed++
        batchHasOps = true
      }
    }

    if (batchHasOps) await batch.commit()
  }

  return { fixed, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY MIGRATION FUNCTIONS  (kept for ImportTab compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export async function fixRecipeCategoryIds(restaurantId) {
  return fixAllImportedData(restaurantId)
}

export async function fixSubrecipeTypes(restaurantId) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  let fixed = 0
  let skipped = 0

  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db)
    let batchHasOps = false

    snap.docs.slice(i, i + 500).forEach((d) => {
      const data = d.data()
      if (data.type === 'subrecipe') { skipped++; return }

      const isSub =
        data.isSubRecipe === true ||
        data.code?.startsWith('SUB') ||
        data.reference?.toUpperCase?.().startsWith('ONISUB') ||
        data.reference?.toUpperCase?.().startsWith('BARSB')

      if (isSub) {
        batch.update(doc(db, 'restaurants', restaurantId, 'recipes', d.id), {
          type: 'subrecipe', isSubRecipe: true,
          menuCode: 'SUBRECETA', menuName: 'Sub-recetas', categoryId: null,
          updatedAt: serverTimestamp(),
        })
        fixed++
        batchHasOps = true
      } else { skipped++ }
    })

    if (batchHasOps) await batch.commit()
  }

  return { fixed, skipped }
}

export async function fixSubrecipeYields(restaurantId) {
  const snap = await getDocs(query(
    collection(db, 'restaurants', restaurantId, 'recipes'),
    where('type', '==', 'subrecipe')
  ))

  const withoutYield = snap.docs
    .filter((d) => {
      const data = d.data()
      return !data.yieldAmount && !data.yield
    })
    .map((d) => d.data().reference || d.id)

  return {
    total: snap.docs.length,
    withoutYield: withoutYield.length,
    list: withoutYield,
  }
}
