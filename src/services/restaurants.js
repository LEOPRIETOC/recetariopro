import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot, limit,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// ── Auto-code generators ─────────────────────────────────────────────────────

export async function getNextIngredientCode(restaurantId) {
  try {
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas'))
    const nums = snap.docs
      .map((d) => d.data().code || '')
      .filter((c) => /^MP\d+$/.test(c))
      .map((c) => parseInt(c.replace('MP', ''), 10))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    if (next > 9999) throw new Error('Límite de materias primas alcanzado (MP9999)')
    return `MP${String(next).padStart(4, '0')}`
  } catch (err) {
    if (err.message?.includes('Límite')) throw err
    return `MP${String(Date.now()).slice(-4)}`
  }
}

export async function getNextCategoryCode(restaurantId) {
  try {
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories'))
    const nums = snap.docs
      .map((d) => d.data().code || '')
      .filter((c) => /^MEN\d+$/.test(c))
      .map((c) => parseInt(c.replace('MEN', ''), 10))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `MEN${String(next).padStart(3, '0')}`
  } catch {
    return `MEN${Date.now().toString().slice(-3)}`
  }
}

export async function getNextRecipeCode(restaurantId, type = 'recipe') {
  try {
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
    const prefix = type === 'subrecipe' ? 'SUB' : 'REC'
    const regex = new RegExp(`^${prefix}\\d+$`)
    const nums = snap.docs
      .map((d) => d.data().code || '')
      .filter((c) => regex.test(c))
      .map((c) => parseInt(c.replace(prefix, ''), 10))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `${prefix}${String(next).padStart(3, '0')}`
  } catch {
    return `REC${Date.now().toString().slice(-3)}`
  }
}

// ── Categories ──────────────────────────────────────────────────────────────

export function subscribeCategories(restaurantId, callback) {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'categories'),
    orderBy('order', 'asc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function createCategory(restaurantId, data) {
  return addDoc(collection(db, 'restaurants', restaurantId, 'categories'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateCategory(restaurantId, categoryId, data) {
  return updateDoc(doc(db, 'restaurants', restaurantId, 'categories', categoryId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCategory(restaurantId, categoryId) {
  return deleteDoc(doc(db, 'restaurants', restaurantId, 'categories', categoryId))
}

export async function updateCategoryOrder(restaurantId, orderedIds) {
  return Promise.all(
    orderedIds.map((id, index) =>
      updateDoc(doc(db, 'restaurants', restaurantId, 'categories', id), { order: index })
    )
  )
}

// ── Utility: strip undefined values recursively before writing to Firestore ──
function cleanForFirestore(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore)
  }
  if (obj !== null && typeof obj === 'object' && obj.constructor?.name !== 'Timestamp') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanForFirestore(v)])
    )
  }
  // Convert NaN to 0 — Firestore rejects NaN
  if (typeof obj === 'number' && isNaN(obj)) return 0
  return obj
}

// ── Recipes ─────────────────────────────────────────────────────────────────

export function subscribeRecipes(restaurantId, callback) {
  // No orderBy: Firestore excluye docs sin el campo, y recetas legacy
  // pueden no tener `order`. Ordenamos en cliente.
  const q = query(collection(db, 'restaurants', restaurantId, 'recipes'))
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    docs.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    callback(docs)
  })
}

export async function getRecipe(restaurantId, recipeId) {
  const snap = await getDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipeId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function createRecipe(restaurantId, data) {
  return addDoc(collection(db, 'restaurants', restaurantId, 'recipes'), {
    ...cleanForFirestore(data),
    active: true,
    version: 1,
    order: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateRecipe(restaurantId, recipeId, data) {
  const recipeRef = doc(db, 'restaurants', restaurantId, 'recipes', recipeId)
  const currentSnap = await getDoc(recipeRef)
  if (currentSnap.exists()) {
    const currentData = currentSnap.data()
    await addDoc(
      collection(db, 'restaurants', restaurantId, 'recipes', recipeId, 'versions'),
      {
        ...cleanForFirestore(currentData),
        savedAt: serverTimestamp(),
        versionNumber: currentData.version || 1,
      }
    )
  }
  return updateDoc(recipeRef, {
    ...cleanForFirestore(data),
    version: (currentSnap.data()?.version || 1) + 1,
    updatedAt: serverTimestamp(),
  })
}

// Upsert por CODIGO con soporte de ingredientes por fila.
// Si las filas tienen CODIGO_INGREDIENTE, se reconstruye ingredients[] de cada
// receta agrupando por CODIGO_RECETA. Si no, solo actualiza campos planos.
// No crea recetas nuevas (necesitan ser definidas desde el editor).
export async function upsertRecipesWithIngredients(restaurantId, rows) {
  const mpSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas'))
  const mpByCode = new Map()
  mpSnap.docs.forEach((d) => {
    const code = d.data()?.code
    if (code) mpByCode.set(String(code).toLowerCase().trim(), { id: d.id, ...d.data() })
  })

  const recSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  const recipesByCode = new Map()
  recSnap.docs.forEach((d) => {
    const code = d.data()?.code
    if (code) recipesByCode.set(String(code).toLowerCase().trim(), { id: d.id, ...d.data() })
  })

  const norm = (v) => (v == null ? '' : String(v).trim())
  const num  = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n }
  const pick = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
    }
    return ''
  }

  // Agrupar por código de receta
  const groups = new Map()
  rows.forEach((r) => {
    const code = norm(pick(r, 'CODIGO_RECETA', 'codigoReceta', 'CODIGO', 'codigo', 'code'))
    if (!code) return
    const k = code.toLowerCase()
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  })

  let updated = 0, notFound = 0, skipped = 0, ingredientsSkipped = 0

  for (const [codeLower, groupRows] of groups) {
    const existing = recipesByCode.get(codeLower)
    if (!existing) { notFound++; continue }

    const newIngredients = []
    for (const row of groupRows) {
      const ingCode = norm(pick(row, 'CODIGO_INGREDIENTE', 'codigoIngrediente'))
      if (!ingCode) continue
      const ingLow = ingCode.toLowerCase()
      const mp = mpByCode.get(ingLow)
      const sr = recipesByCode.get(ingLow)
      const tipoHint = norm(pick(row, 'TIPO', 'tipo', 'type')).toLowerCase()
      const isSub = (sr && (sr.isSubRecipe || sr.type === 'subrecipe') && (!mp || tipoHint === 'subreceta' || tipoHint === 'sub' || tipoHint === 'subrecipe'))
      const source = isSub ? sr : mp || (sr && (sr.isSubRecipe || sr.type === 'subrecipe') ? sr : null)
      if (!source) { ingredientsSkipped++; continue }

      const qty = num(pick(row, 'CANTIDAD', 'cantidad', 'quantity'))
      const unit = norm(pick(row, 'UNIDAD', 'unidad', 'unit')) || (isSub ? source.yieldUnit : (source.useUnit || source.unit)) || ''
      const waste = num(pick(row, 'DESPERDICIO_%', 'DESPERDICIO_PCT', 'DESPERDICIO', 'desperdicio', 'wasteMargin'))

      let pricePerUnit
      if (isSub) {
        const stored = parseFloat(source.costPerYieldUnit)
        const yieldAmt = parseFloat(source.yieldAmount) || 0
        const total = parseFloat(source.totalCost) || 0
        pricePerUnit = !isNaN(stored) && stored > 0
          ? stored
          : (yieldAmt > 0 ? total / yieldAmt : 0)
      } else {
        pricePerUnit = parseFloat(source.pricePerUnit) || 0
      }

      const base = qty * pricePerUnit
      const wasteCost = base * (waste / 100)
      newIngredients.push({
        ingredientId: source.id,
        description: source.name || source.description || '',
        ingredientName: source.name || source.description || '',
        reference: source.reference || source.code || '',
        quantity: qty,
        unit,
        wasteMargin: waste,
        purchaseUnit: isSub ? '' : (source.purchaseUnit || ''),
        pricePerUnit,
        type: isSub ? 'subrecipe' : 'ingredient',
        baseCost: isNaN(base) ? 0 : base,
        wasteCost: isNaN(wasteCost) ? 0 : wasteCost,
        totalCost: isNaN(base + wasteCost) ? 0 : base + wasteCost,
      })
    }

    const first = groupRows[0]
    const updates = {
      ingredients: newIngredients,
      totalCost: newIngredients.reduce((s, i) => s + (i.totalCost || 0), 0),
      updatedAt: serverTimestamp(),
    }
    const nameVal = norm(pick(first, 'NOMBRE_RECETA', 'nombreReceta', 'NOMBRE', 'nombre', 'name'))
    if (nameVal) updates.name = nameVal.toUpperCase()
    const refVal = norm(pick(first, 'REFERENCIA_RECETA', 'referenciaReceta', 'REFERENCIA', 'referencia', 'reference'))
    if (refVal) updates.reference = refVal
    if (pick(first, 'RENDIMIENTO', 'rendimiento', 'yieldAmount') !== '') {
      updates.yieldAmount = num(pick(first, 'RENDIMIENTO', 'rendimiento', 'yieldAmount'))
    }
    const yu = norm(pick(first, 'UNIDAD_RENDIMIENTO', 'unidadRendimiento', 'yieldUnit'))
    if (yu) updates.yieldUnit = yu
    if (pick(first, 'PRECIO_VENTA', 'precioVenta', 'sellingPrice') !== '') {
      updates.sellingPrice = num(pick(first, 'PRECIO_VENTA', 'precioVenta', 'sellingPrice'))
    }
    if (pick(first, 'PREPARACION', 'preparacion', 'preparation') !== '') {
      updates.preparation = String(pick(first, 'PREPARACION', 'preparacion', 'preparation'))
    }

    if (existing.isSubRecipe || existing.type === 'subrecipe') {
      const yieldAmt = parseFloat(updates.yieldAmount ?? existing.yieldAmount) || 0
      updates.costPerYieldUnit = yieldAmt > 0 ? updates.totalCost / yieldAmt : 0
    }

    await updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', existing.id), updates)
    updated++
  }

  return { updated, notFound, skipped, ingredientsSkipped }
}

// Upsert por CODIGO de receta — solo actualiza campos planos (no toca ingredientes).
// No crea recetas nuevas porque requieren ingredientes desde el editor.
export async function upsertRecipesByCode(restaurantId, rows) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  const byCode = new Map()
  snap.docs.forEach((d) => {
    const code = d.data()?.code
    if (code) byCode.set(String(code).toLowerCase().trim(), { id: d.id, data: d.data() })
  })

  const norm = (v) => (v == null ? '' : String(v).trim())
  const num  = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n }
  const bool = (v) => v === true || /^(true|si|sí|1|x|y|yes)$/i.test(String(v ?? '').trim())
  const pick = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
    }
    return ''
  }
  const has = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return true
    }
    return false
  }

  let updated = 0, skipped = 0, notFound = 0
  for (const row of rows) {
    const code = norm(pick(row, 'CODIGO', 'codigo', 'code'))
    if (!code) { skipped++; continue }
    const existing = byCode.get(code.toLowerCase())
    if (!existing) { notFound++; continue }

    const updates = {}
    if (has(row, 'NOMBRE_RECETA', 'NOMBRE', 'nombre', 'name')) {
      updates.name = norm(pick(row, 'NOMBRE_RECETA', 'NOMBRE', 'nombre', 'name')).toUpperCase()
    }
    if (has(row, 'REFERENCIA_RECETA', 'REFERENCIA', 'referencia', 'reference')) {
      updates.reference = norm(pick(row, 'REFERENCIA_RECETA', 'REFERENCIA', 'referencia', 'reference'))
    }
    if (has(row, 'PRECIO_VENTA', 'precioVenta', 'sellingPrice')) {
      updates.sellingPrice = num(pick(row, 'PRECIO_VENTA', 'precioVenta', 'sellingPrice'))
    }
    if (has(row, 'RENDIMIENTO', 'rendimiento', 'yieldAmount')) {
      updates.yieldAmount = num(pick(row, 'RENDIMIENTO', 'rendimiento', 'yieldAmount'))
    }
    if (has(row, 'UNIDAD_RENDIMIENTO', 'unidadRendimiento', 'yieldUnit')) {
      updates.yieldUnit = norm(pick(row, 'UNIDAD_RENDIMIENTO', 'unidadRendimiento', 'yieldUnit'))
    }
    if (has(row, 'PREPARACION', 'preparacion', 'preparation')) {
      updates.preparation = String(pick(row, 'PREPARACION', 'preparacion', 'preparation'))
    }
    if (has(row, 'COSTO_MANUAL', 'costoManual', 'manualCost')) {
      updates.manualCost = num(pick(row, 'COSTO_MANUAL', 'costoManual', 'manualCost'))
    }
    if (has(row, 'USA_COSTO_MANUAL', 'usaCostoManual', 'useManualCost')) {
      updates.useManualCost = bool(pick(row, 'USA_COSTO_MANUAL', 'usaCostoManual', 'useManualCost'))
    }
    if (has(row, 'NOTAS', 'notas', 'notes')) {
      updates.notes = String(pick(row, 'NOTAS', 'notas', 'notes'))
    }

    if (Object.keys(updates).length === 0) { skipped++; continue }
    updates.updatedAt = serverTimestamp()
    await updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', existing.id), updates)
    updated++
  }
  return { updated, notFound, skipped }
}

// ── Notes (multi-author) ──────────────────────────────────────────────────────
// Nota: serverTimestamp() no funciona dentro de arrayUnion(); usamos ISO string.
export async function addRecipeNote(restaurantId, recipeId, { text, authorId, authorName, authorRole }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: String(text || '').trim(),
    authorId: authorId || 'desconocido',
    authorName: authorName || 'Usuario',
    authorRole: authorRole || 'usuario',
    createdAt: new Date().toISOString(),
  }
  if (!entry.text) throw new Error('La nota está vacía')
  await updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipeId), {
    noteEntries: arrayUnion(entry),
    updatedAt: serverTimestamp(),
  })
  return entry
}

export async function deleteRecipeNote(restaurantId, recipeId, entryId) {
  // arrayRemove requiere el objeto exacto; releemos el array, filtramos y reescribimos.
  const ref = doc(db, 'restaurants', restaurantId, 'recipes', recipeId)
  const snap = await getDoc(ref)
  const current = Array.isArray(snap.data()?.noteEntries) ? snap.data().noteEntries : []
  const next = current.filter((e) => e.id !== entryId)
  await updateDoc(ref, { noteEntries: next, updatedAt: serverTimestamp() })
}

// Soft-hide / unhide: marca la nota con hidden=true|false sin borrarla.
export async function setRecipeNoteHidden(restaurantId, recipeId, entryId, hidden) {
  const ref = doc(db, 'restaurants', restaurantId, 'recipes', recipeId)
  const snap = await getDoc(ref)
  const current = Array.isArray(snap.data()?.noteEntries) ? snap.data().noteEntries : []
  const next = current.map((e) => e.id === entryId ? { ...e, hidden: !!hidden } : e)
  await updateDoc(ref, { noteEntries: next, updatedAt: serverTimestamp() })
  return next
}

export async function toggleRecipeActive(restaurantId, recipeId, active) {
  return updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipeId), {
    active,
    updatedAt: serverTimestamp(),
  })
}

export async function updateRecipeOrder(restaurantId, recipes) {
  return Promise.all(
    recipes.map((r, i) =>
      updateDoc(doc(db, 'restaurants', restaurantId, 'recipes', r.id), { order: i })
    )
  )
}

export function subscribeVersions(restaurantId, recipeId, callback) {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'recipes', recipeId, 'versions'),
    orderBy('savedAt', 'desc'),
    limit(20)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// ── Ingredients / Materias Primas ─────────────────────────────────────────────

export function subscribeIngredients(restaurantId, callback) {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'materias_primas'),
    orderBy('code', 'asc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function createIngredient(restaurantId, data) {
  return addDoc(collection(db, 'restaurants', restaurantId, 'materias_primas'), {
    ...cleanForFirestore(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateIngredient(restaurantId, ingredientId, data) {
  return updateDoc(
    doc(db, 'restaurants', restaurantId, 'materias_primas', ingredientId),
    { ...cleanForFirestore(data), updatedAt: serverTimestamp() }
  )
}

export async function deleteIngredient(restaurantId, ingredientId) {
  return deleteDoc(doc(db, 'restaurants', restaurantId, 'materias_primas', ingredientId))
}

// Upsert por CODIGO: actualiza si el code ya existe, crea si es nuevo.
// Mapea encabezados del export (CODIGO, NOMBRE, ...) y nombres legacy/lowercase.
export async function upsertIngredientsByCode(restaurantId, rows) {
  const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas'))
  const byCode = new Map()
  snap.docs.forEach((d) => {
    const code = d.data()?.code
    if (code) byCode.set(String(code).toLowerCase().trim(), d.id)
  })

  const norm = (v) => (v == null ? '' : String(v).trim())
  const num  = (v) => {
    const n = parseFloat(String(v ?? '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  const pick = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
    }
    return ''
  }

  let created = 0, updated = 0, skipped = 0
  for (const row of rows) {
    const code = norm(pick(row, 'CODIGO', 'codigo', 'code', 'Código'))
    if (!code) { skipped++; continue }

    const name = norm(pick(row, 'NOMBRE', 'nombre', 'name', 'Nombre', 'description', 'descripcion', 'DESCRIPCION'))
    const useUnit = norm(pick(row, 'UNIDAD', 'unidad', 'useUnit', 'unit', 'Unidad'))
    const purchaseUnit = norm(pick(row, 'UNIDAD_COMPRA', 'unidadCompra', 'purchaseUnit', 'Unidad de compra'))
    const qtyPres = num(pick(row, 'CANT_PRESENTACION', 'cantPresentacion', 'quantityPerPresentation', 'Cant. presentación'))
    const value = num(pick(row, 'VALOR', 'valor', 'value', 'Valor'))
    let pricePerUnit = num(pick(row, 'PRECIO_POR_UNIDAD', 'precioPorUnidad', 'pricePerUnit', 'Precio por unidad'))
    if (!pricePerUnit && qtyPres > 0 && value > 0) pricePerUnit = value / qtyPres

    const data = {
      code,
      item: norm(pick(row, 'ITEM', 'item', 'Item')) || null,
      reference: norm(pick(row, 'REFERENCIA', 'referencia', 'reference', 'Referencia')) || null,
      name,
      description: name,
      useUnit: useUnit || null,
      unit: useUnit || null,
      purchaseUnit: purchaseUnit || null,
      quantityPerPresentation: qtyPres,
      value,
      pricePerUnit,
      category: norm(pick(row, 'CATEGORIA', 'categoria', 'category', 'Categoría')) || null,
      supplierCode: norm(pick(row, 'CODIGO_PROVEEDOR', 'codigoProveedor', 'supplierCode', 'Código proveedor')) || null,
      supplier: norm(pick(row, 'PROVEEDOR', 'proveedor', 'supplier', 'Proveedor')) || null,
      updatedAt: serverTimestamp(),
    }

    const existingId = byCode.get(code.toLowerCase())
    if (existingId) {
      await updateDoc(doc(db, 'restaurants', restaurantId, 'materias_primas', existingId), data)
      updated++
    } else {
      await addDoc(collection(db, 'restaurants', restaurantId, 'materias_primas'), {
        ...data, active: true, createdAt: serverTimestamp(),
      })
      created++
    }
  }
  return { created, updated, skipped }
}

export async function importIngredients(restaurantId, rows, existingCodes = []) {
  let maxNum = existingCodes
    .filter((c) => /^MP\d+$/.test(c))
    .map((c) => parseInt(c.replace('MP', ''), 10))
    .reduce((a, b) => Math.max(a, b), 0)

  return Promise.all(
    rows.map((row) => {
      maxNum++
      const code = `MP${String(maxNum).padStart(4, '0')}`
      return addDoc(collection(db, 'restaurants', restaurantId, 'materias_primas'), {
        code,
        description: row.description || row.descripcion || '',
        unit: row.unit || row.unidad || '',
        pricePerUnit: parseFloat(row.pricePerUnit || row.precio || 0),
        category: row.category || row.categoria || '',
        supplier: row.supplier || row.proveedor || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
  )
}

// ── MP Categories (Categorías de materias primas) ────────────────────────────

export function subscribeMpCategories(restaurantId, callback) {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'mp_categories'),
    orderBy('code', 'asc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function getNextMpCategoryCode(restaurantId) {
  try {
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'mp_categories'))
    const nums = snap.docs
      .map((d) => d.data().code || '')
      .filter((c) => /^CAT\d+$/.test(c))
      .map((c) => parseInt(c.replace('CAT', ''), 10))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `CAT${String(next).padStart(3, '0')}`
  } catch {
    return `CAT${Date.now().toString().slice(-3)}`
  }
}

export async function createMpCategory(restaurantId, data) {
  return addDoc(collection(db, 'restaurants', restaurantId, 'mp_categories'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateMpCategory(restaurantId, categoryId, data) {
  return updateDoc(doc(db, 'restaurants', restaurantId, 'mp_categories', categoryId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteMpCategory(restaurantId, categoryId) {
  return deleteDoc(doc(db, 'restaurants', restaurantId, 'mp_categories', categoryId))
}

export async function checkMpCategoryInUse(restaurantId, categoryName) {
  const snap = await getDocs(
    query(collection(db, 'restaurants', restaurantId, 'materias_primas'), where('category', '==', categoryName))
  )
  return snap.size > 0
}

// ── Restaurant settings ────────────────────────────────────────────────────────

export async function updateRestaurantSettings(restaurantId, settings) {
  const updates = { updatedAt: serverTimestamp() }
  for (const [key, value] of Object.entries(settings)) {
    updates[`settings.${key}`] = value
  }
  return updateDoc(doc(db, 'restaurants', restaurantId), updates)
}

export async function updateAccentColor(restaurantId, color) {
  return updateDoc(doc(db, 'restaurants', restaurantId), {
    accentColor: color,
    updatedAt: serverTimestamp(),
  })
}

// ── Sales / BCG data ──────────────────────────────────────────────────────────

export async function importSalesData(restaurantId, rows) {
  return Promise.all(
    rows.map((row) =>
      addDoc(collection(db, 'restaurants', restaurantId, 'sales_data'), {
        recipeName: row.recipeName || row.receta || row.nombre || '',
        quantity: parseFloat(row.quantity || row.cantidad || 0),
        revenue: parseFloat(row.revenue || row.ingresos || 0),
        period: row.period || row.periodo || '',
        importedAt: serverTimestamp(),
      })
    )
  )
}

export function subscribeSalesData(restaurantId, callback) {
  const q = query(
    collection(db, 'restaurants', restaurantId, 'sales_data'),
    orderBy('importedAt', 'desc'),
    limit(500)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}
