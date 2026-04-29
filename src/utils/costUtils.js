// pricePerUnit ya se guarda en moneda-por-useUnit (ej. $/g) cuando se crea la
// materia prima (pricePerUnit = value / quantityPerPresentation). No hace falta
// convertir aqui — solo se devuelve el precio crudo. Se mantiene la firma para
// compat con los call sites existentes.
export function getConvertedPrice(rawPrice /* , purchaseUnit, recipeUnit */) {
  return parseFloat(rawPrice) || 0
}

export function calcIngredientCost(ing) {
  if (!ing) return 0
  if (ing.totalCost > 0) return ing.totalCost
  const eff = getConvertedPrice(parseFloat(ing.pricePerUnit || 0), ing.purchaseUnit || '', ing.unit || '')
  const base = parseFloat(ing.quantity || 0) * eff
  const waste = base * (parseFloat(ing.wasteMargin || 0) / 100)
  return isNaN(base + waste) ? 0 : base + waste
}

export function calcRecipeTotalCost(recipe) {
  if (!recipe) return 0
  if (recipe.totalCost > 0) return recipe.totalCost
  return (recipe.ingredients || []).reduce((s, i) => s + calcIngredientCost(i), 0)
}
