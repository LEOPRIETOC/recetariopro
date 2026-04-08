import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot, limit,
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
      .filter((c) => /^CAT\d+$/.test(c))
      .map((c) => parseInt(c.replace('CAT', ''), 10))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `CAT${String(next).padStart(3, '0')}`
  } catch {
    return `CAT${Date.now().toString().slice(-3)}`
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
  const q = query(
    collection(db, 'restaurants', restaurantId, 'recipes'),
    orderBy('order', 'asc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
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
  return updateDoc(doc(db, 'restaurants', restaurantId), {
    settings,
    updatedAt: serverTimestamp(),
  })
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
