import {
  collection, doc, getDocs, addDoc, updateDoc,
  writeBatch, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { toTitleCase } from '../lib/utils'

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

// ── 5 & 6. RECETAS / SUB-RECETAS ────────────────────────────────────────────
async function importRecipeOrSub(restaurantId, rows, type, onProgress) {
  // Pre-load categories and materias primas for lookups
  const catMap = await fetchMap(restaurantId, 'categories', 'code')
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

    // Resolve category
    const menuCode = String(first.MENU_CODIGO || first.MENU || '').trim()
    let categoryId = null
    if (menuCode && catMap.has(menuCode)) {
      categoryId = catMap.get(menuCode).id
    }

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
