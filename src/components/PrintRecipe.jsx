import '../print.css'

export function PrintRecipe({ recipe, categories, allIngredients, restaurantName, forwardRef }) {
  const cat = categories.find((c) => c.id === recipe?.categoryId)
  const ingList = (recipe?.ingredients || []).filter((i) => i.description || i.ingredientName || i.ingredientId)

  const createdDate = recipe?.createdAt?.toDate
    ? recipe.createdAt.toDate().toLocaleDateString('es-ES')
    : recipe?.createdAt
      ? new Date(recipe.createdAt).toLocaleDateString('es-ES')
      : null

  const prepSteps = (recipe?.preparation || '').split('\n').filter((s) => s.trim())

  const menuLabel = recipe?.isSubRecipe ? 'Sub-receta' : (cat?.name || null)

  return (
    <div ref={forwardRef} className="print-document">

      {/* ── HEADER ── */}
      <div className="print-header">
        {restaurantName && <div className="print-restaurant">{restaurantName}</div>}
        {cat && <div className="print-menu-name">{cat.name}</div>}
        <div className="print-header-line" />
        <h1 className="print-recipe-title">{recipe?.name}</h1>
      </div>

      {/* ── BODY ── */}
      <div className="print-body">

        {/* Left column — photo + meta */}
        <div className="print-col-left">
          {recipe?.photoURL ? (
            <div className="print-photo-wrap">
              <img src={recipe.photoURL} alt={recipe.name} />
            </div>
          ) : (
            <div className="print-no-photo">🍽</div>
          )}

          <div className="print-menu-box">
            <div className="print-menu-label">Menú</div>
            <div className="print-menu-value">{menuLabel || 'Sin menú'}</div>
          </div>
        </div>

        {/* Right column — ingredients + preparation */}
        <div className="print-col-right">
          <h2 className="print-section-title">Ingredientes</h2>
          {(recipe?.code || recipe?.item || recipe?.reference) && (
            <div className="print-meta-inline">
              {[recipe.code, recipe.item, recipe.reference].filter(Boolean).map((val, i) => (
                <span key={i} className="print-meta-chip">{val}</span>
              ))}
            </div>
          )}
          {ingList.length > 0 ? (
            <ul className="print-ing-list">
              {ingList.map((ing, i) => (
                <li key={i} className="print-ing-item">
                  <span className="print-ing-bullet" />
                  <span className="print-ing-qty">{ing.quantity}</span>
                  <span className="print-ing-unit">{ing.unit}</span>
                  <span className="print-ing-name">{ing.description || ing.ingredientName || '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '8.5pt', color: '#aaa', margin: '0 0 8mm' }}>Sin ingredientes</p>
          )}

          <h2 className="print-section-title">Procedimiento</h2>
          {prepSteps.length > 0 ? (
            <ol className="print-prep-list">
              {prepSteps.map((step, i) => (
                <li key={i} className="print-prep-item">
                  <span className="print-prep-num">{i + 1}.</span>
                  <span>{step.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ fontSize: '8.5pt', color: '#aaa', margin: 0 }}>Sin preparación</p>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="print-footer">
        <span className="print-footer-left">
          v{recipe?.version || 1}{createdDate ? ` · Creada ${createdDate}` : ''}
        </span>
        <span className="print-footer-center">{restaurantName?.toUpperCase()}</span>
        <span className="print-footer-right">Impresa: {new Date().toLocaleDateString('es-ES')}</span>
      </div>

    </div>
  )
}
