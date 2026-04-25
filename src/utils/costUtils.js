export function getConvertedPrice(rawPrice, purchaseUnit, recipeUnit) {
  const pu = (purchaseUnit || '').toLowerCase()
  const ru = (recipeUnit || '').toLowerCase()
  const kgToG = (pu === 'kg' || pu === 'kilo' || pu === 'kilogramo' || pu === 'kgs') &&
                (ru === 'g' || ru === 'gr' || ru === 'gramo' || ru === 'grs' || ru === 'gramos')
  const ltToMl = (pu === 'lt' || pu === 'l' || pu === 'litro' || pu === 'lts' || pu === 'litros') &&
                 (ru === 'ml' || ru === 'mililitro' || ru === 'mililitros')
  return kgToG || ltToMl ? rawPrice / 1000 : rawPrice
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
