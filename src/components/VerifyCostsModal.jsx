import { useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { formatNumber } from '../lib/utils'
import { IngredientSourceModal } from './IngredientSourceModal'

/**
 * Lista todos los ingredientes de la receta con su precio actual en la fila
 * vs el precio actual en la fuente (materia prima o sub-receta). Marca con
 * un warning las filas donde hay discrepancia. Click en una fila → abre el
 * modal de la fuente para editar la materia prima o ir a la sub-receta.
 */
export function VerifyCostsModal({ open, onClose, restaurantId, ingredients, allIngredients, allSubrecipes, isDark, canEdit }) {
  const [selected, setSelected] = useState(null)

  if (!open) return null

  const ink = isDark ? '#f0ece4' : '#111827'
  const t2 = isDark ? '#9ca3af' : '#6b7280'
  const t3 = isDark ? '#6b7280' : '#9ca3af'
  const bg = isDark ? '#111712' : '#fff'
  const bg2 = isDark ? '#1f2937' : '#f9fafb'
  const bdr = isDark ? '#1f2937' : '#e5e7eb'

  const items = (ingredients || [])
    .filter((ing) => ing?.ingredientId)
    .map((ing) => {
      const isSub = ing.type === 'subrecipe'
      const src = isSub
        ? (allSubrecipes || []).find((s) => s.id === ing.ingredientId)
        : (allIngredients || []).find((i) => i.id === ing.ingredientId)
      const rowPrice = parseFloat(ing.pricePerUnit) || 0
      let sourcePrice = 0
      if (src) {
        if (isSub) {
          const stored = parseFloat(src.costPerYieldUnit)
          const yieldAmt = parseFloat(src.yieldAmount) || 0
          const total = parseFloat(src.totalCost) || 0
          sourcePrice = !isNaN(stored) && stored > 0
            ? stored
            : (yieldAmt > 0 ? total / yieldAmt : 0)
        } else {
          sourcePrice = parseFloat(src.pricePerUnit) || 0
        }
      }
      const diff = Math.abs(rowPrice - sourcePrice)
      const mismatch = src && diff > 0.01
      return { ing, src, isSub, rowPrice, sourcePrice, mismatch }
    })

  return (
    <>
      <div
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
        <div style={{
          background: bg, border: `1px solid ${bdr}`, borderRadius: 14,
          width: 'min(680px, 95vw)', maxHeight: '90vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${bdr}` }}>
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: ink, margin: 0 }}>
                Verificar costos
              </h2>
              <p style={{ color: t3, fontSize: '0.78rem', margin: '4px 0 0' }}>
                Click en cualquier ítem para revisar su origen y actualizar el precio.
              </p>
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t2, padding: 4 }}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div style={{ padding: 16, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', color: t3, padding: '40px 0', fontSize: '0.85rem' }}>
                No hay ingredientes con fuente identificada en esta receta.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(({ ing, src, isSub, rowPrice, sourcePrice, mismatch }, idx) => {
                  const name = ing.description || ing.ingredientName || src?.name || '—'
                  const code = src?.code || ing.reference || '—'
                  return (
                    <button key={`${ing.ingredientId}-${idx}`}
                      type="button"
                      onClick={() => src && setSelected({ ingredientId: ing.ingredientId, description: name })}
                      disabled={!src}
                      style={{
                        background: bg2,
                        border: `1px solid ${mismatch ? '#f59e0b66' : bdr}`,
                        borderRadius: 10,
                        padding: '10px 14px',
                        textAlign: 'left',
                        cursor: src ? 'pointer' : 'default',
                        opacity: src ? 1 : 0.55,
                        fontFamily: 'inherit',
                        display: 'grid',
                        gridTemplateColumns: '70px 1fr 110px 110px 16px',
                        gap: 10,
                        alignItems: 'center',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                      onMouseOver={(e) => { if (src) e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = mismatch ? '#f59e0b66' : bdr }}>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '3px 6px', borderRadius: 5, textAlign: 'center',
                        background: isSub ? 'rgba(96,165,250,0.15)' : 'rgba(217,119,6,0.15)',
                        color: isSub ? '#60a5fa' : '#d97706',
                      }}>
                        {isSub ? 'Sub-rec.' : 'M. prima'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 500, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: t3, fontFamily: 'monospace' }}>
                          {code} {!src && '· no encontrado'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.62rem', color: t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>En receta</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: ink, fontVariantNumeric: 'tabular-nums' }}>
                          {formatNumber(rowPrice)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.62rem', color: t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>En origen</div>
                        <div style={{
                          fontSize: '0.85rem', fontWeight: 700,
                          color: mismatch ? '#f59e0b' : ink,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {src ? formatNumber(sourcePrice) : '—'}
                        </div>
                      </div>
                      {src && <ExternalLink className="h-4 w-4" style={{ color: t3 }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal anidado para ver/editar la fuente */}
      {selected && (
        <IngredientSourceModal
          open={!!selected}
          onClose={() => setSelected(null)}
          restaurantId={restaurantId}
          ingredientRow={selected}
          isDark={isDark}
          canEdit={canEdit}
        />
      )}
    </>
  )
}
