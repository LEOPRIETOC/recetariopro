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
  // Tambien indexamos por code y reference (en lowercase) porque importaciones
  // legacy a veces guardan el codigo en `ingredientId` en vez del Firestore docId.
  const byCode = new Map()
  for (const r of allRecipes) {
    if (r.code) byCode.set(String(r.code).toLowerCase(), r)
    if (r.reference) byCode.set(String(r.reference).toLowerCase(), r)
  }
  const isSub = (r) => !!r && (r.isSubRecipe === true || r.type === 'subrecipe')

  const resolveSub = (ing) => {
    // 1) por Firestore docId
    let src = ing?.ingredientId ? byId.get(ing.ingredientId) : null
    if (src && isSub(src)) return src
    // 2) por code/reference que pueda venir en ingredientId, reference o item
    const candidates = [ing?.ingredientId, ing?.reference, ing?.item]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase())
    for (const c of candidates) {
      const hit = byCode.get(c)
      if (hit && isSub(hit)) return hit
    }
    return null
  }

  const plan = []

  for (const r of allRecipes) {
    const ings = Array.isArray(r.ingredients) ? r.ingredients : []
    if (!ings.length) continue

    let recipeChanged = false
    const fixedRows = []
    const newIngs = ings.map((ing) => {
      // Si ya tiene reference que parece sub-receta (ONISUB/BARSB), no tocar
      if (ing?.reference && /^(ONISUB|BARSB)/i.test(ing.reference)) return ing

      const src = resolveSub(ing)
      // type === 'subrecipe' con src null lo dejamos pasar igual: si tiene type
      // pero no resuelve, no podemos hacer mucho. Solo arreglamos si encontramos src.
      if (!src) {
        // Caso especial: type === 'subrecipe' y NO tiene reference: no podemos
        // resolverlo, lo dejamos como esta.
        return ing
      }
      if (ing.reference && ing.type === 'subrecipe') return ing // ya esta bien

      const ref = src.reference || src.code || ''
      if (!ref) return ing // src sin reference ni code, no se puede arreglar

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
    // Diagnostico para la consola del browser. Util si el numero esperado no
    // coincide con el detectado: muestra el detalle por receta.
    const subRecipesCount = allRecipes.filter(isSub).length
    console.groupCollapsed(`[migrateSubrecipeRefs] dry-run: ${allRecipes.length} recetas, ${subRecipesCount} sub-recetas`)
    console.log('Recetas afectadas:', plan.length, '| Ingredientes a reparar:', plan.reduce((acc, p) => acc + p.fixedRows.length, 0))
    if (plan.length > 0) {
      console.table(plan.flatMap((p) => p.fixedRows.map((f) => ({ receta: p.recipeName, ingrediente: f.name, nuevaRef: f.newRef }))))
    } else {
      // Debug extra: mostrar primeras filas de ingredientes que apuntan a sub-recetas
      // pero ya tienen reference, para confirmar que la deteccion funciona.
      const sample = []
      for (const r of allRecipes.slice(0, 50)) {
        for (const ing of (r.ingredients || [])) {
          const src = resolveSub(ing)
          if (src) sample.push({ receta: r.name, ingrediente: ing.description || ing.ingredientName, type: ing.type || '—', reference: ing.reference || '—', resolved: src.code || src.reference })
        }
      }
      if (sample.length) {
        console.log('Sub-recetas detectadas (ya con reference, no requieren fix):')
        console.table(sample.slice(0, 20))
      } else {
        console.warn('No se detectaron ingredientes que apunten a sub-recetas. Revisa que las sub-recetas existan y que los ingredientes tengan ingredientId, reference o item correctos.')
      }
    }
    console.groupEnd()
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
