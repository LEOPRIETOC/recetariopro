import { useState } from 'react'
import { createPortal } from 'react-dom'

export function RecipePrintView({ recipe, restaurant, onClose }) {
  const restaurantName = restaurant?.name || ''
  const ingList = (recipe?.ingredients || []).filter(
    (i) => i.description || i.ingredientName || i.ingredientId
  )

  const prepSteps = (recipe?.preparation || '')
    .split('\n')
    .filter((s) => s.trim())
    .map((s) => s.replace(/^\d+\.\s*/, ''))

  const printDate = new Date().toLocaleDateString('es-ES')
  const twoCol = ingList.length > 6
  const isSubRecipe = recipe?.isSubRecipe === true || recipe?.type === 'subrecipe'
  const yieldAmount = recipe?.yieldAmount
  const yieldUnit = recipe?.yieldUnit
  const showYieldBanner = isSubRecipe && yieldAmount && Number(yieldAmount) > 0

  const [imageLoaded, setImageLoaded] = useState(!recipe?.photoURL)

  return createPortal(
    <div
      id="print-only"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#f5f0e8',
        fontFamily: "'DM Sans', Arial, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        paddingTop: 52,
      }}
    >
      {/* ── TOOLBAR ── */}
      <div
        className="print-toolbar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#333',
          padding: '10px 20px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          zIndex: 999999,
        }}
      >
        <span style={{ color: '#fff', fontSize: '0.85rem', flex: 1 }}>
          Vista previa de impresión
        </span>
        <button
          onClick={() => window.print()}
          disabled={!imageLoaded}
          style={{
            background: '#c9a84c',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontWeight: 600,
            cursor: imageLoaded ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            opacity: imageLoaded ? 1 : 0.5,
            transition: 'opacity 0.2s',
          }}
        >
          🖨 Imprimir
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            color: '#fff',
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ✕ Cerrar
        </button>
      </div>

      {/* ── WATERMARK ── */}
      {restaurantName && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-35deg)',
          fontFamily: "'Playfair Display', serif",
          fontSize: 80,
          fontWeight: 700,
          color: 'rgba(0,0,0,0.04)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 0,
          userSelect: 'none',
        }}>
          {restaurantName}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{
        background: '#111111',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Circular photo */}
        <div style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: '3px solid #c9a84c',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
        }}>
          {recipe?.photoURL
            ? (
              <img
                src={recipe.photoURL}
                alt={recipe.name}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )
            : '🍽'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {restaurantName && (
            <div style={{
              fontSize: 10,
              color: '#c9a84c',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 6,
            }}>
              {restaurantName}
            </div>
          )}
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 22,
            color: '#ffffff',
            fontWeight: 700,
            margin: '0 0 6px',
            lineHeight: 1.2,
          }}>
            {recipe?.name}
          </h1>
          {(recipe?.code || recipe?.reference || recipe?.item) && (
            <div style={{ fontSize: 10, color: '#888' }}>
              {[recipe.code, recipe.item, recipe.reference].filter(Boolean).join(' · ')}
            </div>
          )}
          {recipe?.portions && (
            <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
              Porciones: {recipe.portions}
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{
        padding: '24px 32px',
        flex: 1,
        position: 'relative',
        zIndex: 1,
      }}>

        {/* INGREDIENTS */}
        {ingList.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontWeight: 700,
              fontSize: 12,
              color: '#111',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingBottom: 4,
              borderBottom: '2px solid #c9a84c',
            }}>
              Ingredientes
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: twoCol ? '1fr 1fr' : '1fr',
              gap: '4px 24px',
            }}>
              {ingList.map((ing, i) => {
                const qty = ing.quantity ? `${ing.quantity} ` : ''
                const unit = ing.unit ? `${ing.unit.toLowerCase()} de ` : ''
                const name = ing.description || ing.ingredientName || '—'
                const isSub = ing.type === 'subrecipe' ||
                  ing.reference?.startsWith('ONISUB') ||
                  ing.reference?.startsWith('BARSB')
                return (
                  <div key={i} style={{
                    fontSize: 11,
                    color: '#333',
                    padding: '3px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 4,
                  }}>
                    <span style={{ color: isSub ? '#2563eb' : '#16a34a', flexShrink: 0 }}>•</span>
                    <span>{qty}{unit}<strong style={{ color: '#111' }}>{name}</strong></span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* YIELD BANNER (only sub-recipes) */}
        {showYieldBanner && (
          <div style={{
            background: '#c9a84c',
            color: '#111',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            <span>Rendimiento de la sub-receta:</span>
            <span style={{ fontSize: 14 }}>
              {yieldAmount} {yieldUnit || ''}
            </span>
          </div>
        )}

        {/* PREPARATION */}
        {prepSteps.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontWeight: 700,
              fontSize: 12,
              color: '#111',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingBottom: 4,
              borderBottom: '2px solid #c9a84c',
            }}>
              Preparación
            </div>
            <div style={{
              background: '#fff',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 11,
              lineHeight: 1.9,
              color: '#333',
            }}>
              {prepSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                  <span style={{ color: '#c9a84c', fontWeight: 700, flexShrink: 0, minWidth: 18 }}>{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── FOOTER ── */}
      <div style={{
        background: '#111111',
        padding: '12px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 9,
        color: '#888',
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        <span>{restaurantName}</span>
        <span style={{ color: '#c9a84c', fontWeight: 600 }}>RecetarioPro</span>
        <span>v{recipe?.version || 1} · {printDate}</span>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          .print-toolbar { display: none !important; }
          #print-only {
            position: fixed !important;
            inset: 0 !important;
            z-index: 99999 !important;
            overflow: visible !important;
            padding-top: 0 !important;
          }
          body > *:not(#print-only) {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>,
    document.body
  )
}
