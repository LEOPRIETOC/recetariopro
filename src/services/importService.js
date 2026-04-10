import {
  collection, doc, getDocs, addDoc, updateDoc,
  writeBatch, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db } from '../lib/firebase'
import { toTitleCase } from '../lib/utils'

// ── Generic Excel export ──────────────────────────────────────────────────────
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

// ── Recipe / Sub-recipe export ────────────────────────────────────────────────
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
      ITEM: recipe.item || '',
      REFERENCIA: recipe.reference || '',
      NOMBRE_RECETA: recipe.name || '',
      CODIGO_MENU: recipe.menuCode || cat.code || '',
      MENU: cat.name || '',
      PRECIO_VENTA: recipe.sellingPrice || 0,
    }
    if (!recipe.ingredients?.length) {
      rows.push(base)
    } else {
      recipe.ingredients.forEach((ing) => {
        rows.push({
          ...base,
          ITEM_MP: ing.item || '',
          REFERENCIA_MP: ing.reference || '',
          NOMBRE_MP: ing.ingredientName || '',
          CANTIDAD: ing.quantity || 0,
          UNIDAD: ing.unit || '',
        })
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

const BATCH_SIZE = 50

// Helper: commit write operations in batches of 50
async function batchWrite(operations, onProgress) {
  let done = 0
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const chunk = operations.slice(i, i + BATCH_SIZE)
    for (const op of chunk) {
      if (op.type === 'set') batch.set(op.ref, op.data)
      else batch.update(op.ref, op.data)
    }
    await batch.commit()
    done += chunk.length
    if (onProgress) onProgress(Math.round((done / operations.length) * 100))
  }
}

// Helper: get all docs from a subcollection as a Map keyed by a field
async function fetchMap(restaurantId, colName, keyField) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, colName))
  const map = new Map()
  snap.docs.forEach((d) => {
    const val = d.data()[keyField]
    if (val !== undefined && val !== null && val !== '') {
      map.set(String(val).trim(), { id: d.id, ...d.data() })
    }
  })
  return map
}

// Helper: get next code for a collection
function getNextCode(existingCodes, prefix, pad) {
  const nums = existingCodes
    .filter((c) => new RegExp(`^${prefix}\\d+$`).test(c))
    .map((c) => parseInt(c.replace(prefix, ''), 10))
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `${prefix}${String(next).padStart(pad, '0')}`
}

// ── 1. MENÚS ─────────────────────────────────────────────────────────────────
export async function importMenus(restaurantId, rows, onProgress) {
  const existing = await fetchMap(restaurantId, 'categories', 'code')
  const existingCodes = [...existing.values()].map((v) => v.code || '')
  const result = { created: 0, updated: 0, errors: [] }
  const ops = []

  rows.forEach((row, idx) => {
    const code = String(row.CODIGO_MENU || '').trim()
    const name = String(row.NOMBRE_MENU || '').trim()
    if (!code || !name) {
      result.errors.push(`Fila ${idx + 2}: CODIGO_MENU o NOMBRE_MENU vacíos`)
      return
    }
    if (existing.has(code)) {
      const ref = doc(db, 'restaurants', restaurantId, 'categories', existing.get(code).id)
      ops.push({ type: 'update', ref, data: { name: toTitleCase(name), updatedAt: serverTimestamp() } })
      result.updated++
    } else {
      const newCode = existingCodes.length
        ? getNextCode([...existingCodes, code], 'CAT', 3)
        : `CAT${String(ops.filter((o) => o.type === 'set').length + 1).padStart(3, '0')}`
      existingCodes.push(newCode)
      const ref = doc(collection(db, 'restaurants', restaurantId, 'categories'))
      ops.push({
        type: 'set', ref, data: {
          code, name: toTitleCase(name),
          order: (existing.size || 0) + ops.filter((o) => o.type === 'set').length,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        },
      })
      result.created++
    }
  })

  await batchWrite(ops, onProgress)
  return result
}

// ── 2. PROVEEDORES ───────────────────────────────────────────────────────────
export async function importSuppliers(restaurantId, rows, onProgress) {
  const existing = await fetchMap(restaurantId, 'suppliers', 'code')
  const existingCodes = [...existing.values()].map((v) => v.code || '')
  const result = { created: 0, updated: 0, errors: [] }
  const ops = []

  rows.forEach((row, idx) => {
    const code = String(row.CODIGO_PROVEEDOR || '').trim()
    const name = String(row.NOMBRE_PROVEEDOR || '').trim()
    if (!code || !name) {
      result.errors.push(`Fila ${idx + 2}: CODIGO_PROVEEDOR o NOMBRE_PROVEEDOR vacíos`)
      return
    }
    const data = {
      code,
      name: toTitleCase(name),
      contact: row.CONTACTO || null,
      phone: String(row.CELULAR || '').trim() || null,
      address: row.DIRECCION || null,
      updatedAt: serverTimestamp(),
    }
    if (existing.has(code)) {
      const ref = doc(db, 'restaurants', restaurantId, 'suppliers', existing.get(code).id)
      ops.push({ type: 'update', ref, data })
      result.updated++
    } else {
      const ref = doc(collection(db, 'restaurants', restaurantId, 'suppliers'))
      ops.push({ type: 'set', ref, data: { ...data, createdAt: serverTimestamp() } })
      result.created++
    }
  })

  await batchWrite(ops, onProgress)
  return result
}

// ── 3. UNIDADES DE MEDIDA ────────────────────────────────────────────────────
export async function importUnits(restaurantId, rows, onProgress) {
  const existing = await fetchMap(restaurantId, 'units', 'code')
  const result = { created: 0, updated: 0, errors: [] }
  const ops = []

  rows.forEach((row, idx) => {
    const code = String(row.CODIGO || '').trim()
    const medida = String(row.MEDIDA || '').trim()
    const desc = String(row.DESCRIPCION || '').trim()
    if (!code || !medida) {
      result.errors.push(`Fila ${idx + 2}: CODIGO o MEDIDA vacíos`)
      return
    }
    const data = {
      code,
      abbreviation: medida,
      name: toTitleCase(desc || medida),
      equivalence: Number(row.EQUIVALENCIA) || 1,
      updatedAt: serverTimestamp(),
    }
    if (existing.has(code)) {
      const ref = doc(db, 'restaurants', restaurantId, 'units', existing.get(code).id)
      ops.push({ type: 'update', ref, data })
      result.updated++
    } else {
      const ref = doc(collection(db, 'restaurants', restaurantId, 'units'))
      ops.push({ type: 'set', ref, data: { ...data, createdAt: serverTimestamp() } })
      result.created++
    }
  })

  await batchWrite(ops, onProgress)
  return result
}

// ── 4. MATERIAS PRIMAS ───────────────────────────────────────────────────────
export async function importMaterias(restaurantId, rows, onProgress) {
  const existing = await fetchMap(restaurantId, 'materias_primas', 'reference')
  const allSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas'))
  const existingMpCodes = allSnap.docs.map((d) => d.data().code || '')
  let nextNum = existingMpCodes
    .filter((c) => /^MP\d+$/.test(c))
    .map((c) => parseInt(c.replace('MP', ''), 10))
    .reduce((a, b) => Math.max(a, b), 0)

  const result = { created: 0, updated: 0, errors: [] }
  const ops = []

  rows.forEach((row, idx) => {
    const name = String(row.NOMBRE || '').trim()
    const reference = String(row.REFERENCIA || '').trim() || null
    if (!name) {
      result.errors.push(`Fila ${idx + 2}: NOMBRE vacío`)
      return
    }
    const lookupKey = reference || null
    const cost = parseFloat(String(row.COSTO || '0').replace(',', '.')) || 0
    const data = {
      item: row.ITEM?.toString() || null,
      reference,
      name: toTitleCase(name),
      cost,
      pricePerUnit: cost,
      purchaseUnit: row.UNIDAD_COMPRA || null,
      useUnit: row.UNIDAD_USO || null,
      supplierCode: String(row.CODIGO_PROVEEDOR || '').trim() || null,
      supplier: row.PROVEEDOR || null,
      category: row.CATEGORIA || 'General',
      updatedAt: serverTimestamp(),
    }
    if (lookupKey && existing.has(lookupKey)) {
      const ref = doc(db, 'restaurants', restaurantId, 'materias_primas', existing.get(lookupKey).id)
      ops.push({ type: 'update', ref, data })
      result.updated++
    } else {
      nextNum++
      const code = `MP${String(nextNum).padStart(4, '0')}`
      const ref = doc(collection(db, 'restaurants', restaurantId, 'materias_primas'))
      ops.push({ type: 'set', ref, data: { ...data, code, createdAt: serverTimestamp() } })
      result.created++
    }
  })

  await batchWrite(ops, onProgress)
  return result
}

// ── Category helper: find by name or code (case-insensitive), create if missing ──
async function findOrCreateCategory(restaurantId, menuName, catById) {
  if (!menuName) return null
  const normalized = menuName.toUpperCase().trim()

  // Search in the in-memory map (keyed by docId)
  for (const [catId, catData] of Object.entries(catById)) {
    if (catData.name?.toUpperCase().trim() === normalized) return catId
    if (catData.code?.toUpperCase().trim() === normalized) return catId
  }

  // Not found — create new category and add to in-memory map
  const displayName = menuName.charAt(0).toUpperCase() + menuName.slice(1).toLowerCase()
  const newRef = await addDoc(collection(db, 'restaurants', restaurantId, 'categories'), {
    name: displayName,
    code: `CAT${Date.now()}`,
    order: Object.keys(catById).length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  catById[newRef.id] = { name: displayName, code: `CAT${Date.now()}` }
  return newRef.id
}

// ── 5 & 6. RECETAS / SUB-RECETAS ────────────────────────────────────────────
async function importRecipeOrSub(restaurantId, rows, type, onProgress) {
  // Pre-load categories keyed by docId for findOrCreateCategory
  const catsSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories'))
  const catById = {}
  catsSnap.docs.forEach((d) => { catById[d.id] = d.data() })

  const mpMap = await fetchMap(restaurantId, 'materias_primas', 'reference')
  const existingRecipes = await fetchMap(restaurantId, 'recipes', 'reference')
  const allRecSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  const existingCodes = allRecSnap.docs.map((d) => d.data().code || '')

  const prefix = type === 'subrecipe' ? 'SUB' : 'REC'
  let nextNum = existingCodes
    .filter((c) => new RegExp(`^${prefix}\\d+$`).test(c))
    .map((c) => parseInt(c.replace(prefix, ''), 10))
    .reduce((a, b) => Math.max(a, b), 0)

  const result = { created: 0, updated: 0, errors: [] }

  // Group rows by ITEM (key) — all rows with same ITEM = one recipe
  const groups = new Map()
  rows.forEach((row) => {
    const key = String(row.ITEM || row.REFERENCIA || '').trim()
    if (!key) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  })

  const recipeList = [...groups.values()]
  const ops = []

  for (const [gIdx, group] of recipeList.entries()) {
    if (onProgress) onProgress(Math.round((gIdx / recipeList.length) * 90))

    const first = group[0]
    const reference = String(first.REFERENCIA || '').trim() || null
    const name = String(first.NOMBRE_RECETA || first.NOMBRE || '').trim()
    if (!name) {
      result.errors.push(`Grupo ITEM=${first.ITEM}: NOMBRE_RECETA vacío`)
      continue
    }

    // Resolve category — try MENU_CODIGO first, then MENU (which may be a name)
    const menuValue = String(first.MENU_CODIGO || first.MENU || '').trim()
    const categoryId = await findOrCreateCategory(restaurantId, menuValue || null, catById)

    // Build ingredients
    const ingredients = group
      .filter((r) => r.REFERENCIA_MP || r.NOMBRE_MP)
      .map((r) => {
        const mpRef = String(r.REFERENCIA_MP || '').trim()
        const mpDoc = mpRef ? mpMap.get(mpRef) : null
        return {
          ingredientId: mpDoc?.id || null,
          ingredientName: toTitleCase(String(r.NOMBRE_MP || '').trim()),
          reference: mpRef || null,
          item: r.ITEM_MP?.toString() || null,
          quantity: parseFloat(String(r.CANTIDAD || '0').replace(',', '.')) || 0,
          unit: String(r.UNIDAD || r.MED || '').trim(),
          wasteMargin: 0,
          totalCost: 0,
        }
      })

    const sellingPrice = parseFloat(String(first.PRECIO_VENTA || first.PRECIO || '0').replace(',', '.')) || 0

    const docData = {
      item: first.ITEM?.toString() || null,
      reference,
      name: name.toUpperCase(),
      categoryId,
      sellingPrice,
      type,
      active: true,
      ingredients,
      version: 1,
      updatedAt: serverTimestamp(),
    }

    const lookupKey = reference
    if (lookupKey && existingRecipes.has(lookupKey)) {
      const ref = doc(db, 'restaurants', restaurantId, 'recipes', existingRecipes.get(lookupKey).id)
      ops.push({ type: 'update', ref, data: docData })
      result.updated++
    } else {
      nextNum++
      const code = `${prefix}${String(nextNum).padStart(3, '0')}`
      const ref = doc(collection(db, 'restaurants', restaurantId, 'recipes'))
      ops.push({
        type: 'set', ref, data: {
          ...docData, code, order: Date.now() + nextNum,
          createdAt: serverTimestamp(),
        },
      })
      result.created++
    }
  }

  await batchWrite(ops, (p) => { if (onProgress) onProgress(90 + Math.round(p * 0.1)) })
  return result
}

export async function importRecipes(restaurantId, rows, onProgress) {
  return importRecipeOrSub(restaurantId, rows, 'recipe', onProgress)
}

export async function importSubrecipes(restaurantId, rows, onProgress) {
  return importRecipeOrSub(restaurantId, rows, 'subrecipe', onProgress)
}

// ── MIGRACIÓN: corregir categoryId de recetas importadas ─────────────────────
export async function fixRecipeCategoryIds(restaurantId) {
  // Build lookup maps: code -> docId and name -> docId
  const catsSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories'))
  const catByCode = {}
  const catByName = {}
  catsSnap.docs.forEach((d) => {
    const data = d.data()
    if (data.code) catByCode[data.code.toUpperCase().trim()] = d.id
    if (data.name) catByName[data.name.toUpperCase().trim()] = d.id
  })

  const allCatIds = new Set(Object.values(catByCode))

  const recipesSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  let fixed = 0
  let skipped = 0
  let notFound = 0
  const errors = []

  const FIX_BATCH = 500
  const docs = recipesSnap.docs

  for (let i = 0; i < docs.length; i += FIX_BATCH) {
    const batch = writeBatch(db)
    let batchHasOps = false

    docs.slice(i, i + FIX_BATCH).forEach((recipeDoc) => {
      const data = recipeDoc.data()
      const current = data.categoryId

      // Already a valid Firestore doc ID that exists in categories — skip
      if (current && allCatIds.has(current)) { skipped++; return }

      // Try to resolve: by code, then by name, then by menuCode/menuName fields
      const newId =
        catByCode[current?.toUpperCase()?.trim()] ||
        catByName[current?.toUpperCase()?.trim()] ||
        catByCode[data.menuCode?.toUpperCase()?.trim()] ||
        catByName[data.menuName?.toUpperCase()?.trim()] ||
        null

      if (newId) {
        batch.update(doc(db, 'restaurants', restaurantId, 'recipes', recipeDoc.id), { categoryId: newId })
        fixed++
        batchHasOps = true
      } else {
        notFound++
        if (errors.length < 50) errors.push(`Sin categoría: ${data.name} (${current || 'vacío'})`)
      }
    })

    if (batchHasOps) await batch.commit()
  }

  return { fixed, skipped, notFound, errors }
}
