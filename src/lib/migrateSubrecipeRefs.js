import { collection, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

// Repara ingredientes de tipo sub-receta que quedaron guardados sin `reference`.
// El bug en handleSelectSubrecipe (RecipeDetailPage.jsx) omitia setear el campo
// `reference` al insertar una sub-receta como ingrediente, por lo que vistas
// como RecipePrintView (que detectan sub-recetas con ing.reference?.startsWith('ONISUB'|'BARSB'))
// no las identificaban.
//
// Estrategia:
// 1. Cargar todas las recetas (incluidas sub-recetas).
// 2. Indexar por id para resolver rapido el origen de cada ingrediente.
// 3. Para cada receta, recorrer ingredientes y detectar los que apuntan a una
//    sub-receta (por type, por ingredientId que matchea una sub-receta, o por
//    pricePerUnit calculado desde otra receta) y que no tengan reference.
// 4. Rellenar reference con sr.reference || sr.code (o '' si la sub-receta fue borrada).
// 5. Escribir en batches de 400 (limite de writeBatch es 500 ops).
//
// `dryRun: true` no escribe — solo cuenta y devuelve los cambios planeados.

export async function migrateSubrecipeRefs(restaurantId, { dryRun = false } = {}) {
  if (!restaurantId) throw new Error('restaurantId requerido')

  const recipesSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
  const allRecipes = recipesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const byId = new Map(allRecipes.map((r) => [r.id, r]))
  const isSub = (r) => !!r && (r.isSubRecipe === true || r.type === 'subrecipe')

  const plan = []

  for (const r of allRecipes) {
    const ings = Array.isArray(r.ingredients) ? r.ingredients : []
    if (!ings.length) continue

    let recipeChanged = false
    const fixedRows = []
    const newIngs = ings.map((ing) => {
      const looksLikeSub =
        ing?.type === 'subrecipe' ||
        (ing?.ingredientId && isSub(byId.get(ing.ingredientId)))

      if (!looksLikeSub) return ing
      if (ing.reference) return ing // ya tiene reference, no tocar

      const src = byId.get(ing.ingredientId)
      const ref = src?.reference || src?.code || ''
      if (!ref) return ing // no se pudo resolver, dejar igual

      recipeChanged = true
      fixedRows.push({
        ingredientId: ing.ingredientId,
        name: ing.description || ing.ingredientName || src?.name || '?',
        newRef: ref,
      })
      return {
        ...ing,
        reference: ref,
        // tambien fijamos el type explicito por si quedo undefined
        type: 'subrecipe',
        // y rellenamos ingredientName si falta (consistencia con el handler corregido)
        ingredientName: ing.ingredientName || ing.description || src?.name || '',
      }
    })

    if (recipeChanged) {
      plan.push({ recipeId: r.id, recipeName: r.name || r.code || r.id, fixedRows, newIngredients: newIngs })
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      recipesAffected: plan.length,
      ingredientsFixed: plan.reduce((acc, p) => acc + p.fixedRows.length, 0),
      preview: plan.slice(0, 10).map((p) => ({
        recipe: p.recipeName,
        fixed: p.fixedRows,
      })),
    }
  }

  // Escritura real en batches de 400 (limite de writeBatch es 500).
  // Usamos updateDoc directo — NO updateRecipe — para no crear una version nueva
  // por cada receta migrada (inflaria el historial sin razon).
  const BATCH_SIZE = 400
  let written = 0
  for (let i = 0; i < plan.length; i += BATCH_SIZE) {
    const slice = plan.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const p of slice) {
      const ref = doc(db, 'restaurants', restaurantId, 'recipes', p.recipeId)
      batch.update(ref, {
        ingredients: p.newIngredients,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    written += slice.length
  }

  return {
    dryRun: false,
    recipesAffected: plan.length,
    recipesWritten: written,
    ingredientsFixed: plan.reduce((acc, p) => acc + p.fixedRows.length, 0),
  }
}
