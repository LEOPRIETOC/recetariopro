import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { updateIngredient } from '../services/restaurants'
import { useToast } from './ui/toast'
import { X, Save, ExternalLink } from 'lucide-react'
import { formatNumber } from '../lib/utils'

export function IngredientSourceModal({ open, onClose, restaurantId, ingredientRow, isDark, canEdit, onSaved }) {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState(null)
  const [kind, setKind] = useState(null) // 'mp' | 'subrecipe' | null
  const [qty, setQty] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !restaurantId || !ingredientRow?.ingredientId) return
    setLoading(true)
    setSource(null)
    setKind(null)
    ;(async () => {
      try {
        // Try materia prima first
        const mpSnap = await getDoc(doc(db, 'restaurants', restaurantId, 'materias_primas', ingredientRow.ingredientId))
        if (mpSnap.exists()) {
          const data = { id: mpSnap.id, ...mpSnap.data() }
          setSource(data)
          setKind('mp')
          setQty(String(data.quantityPerPresentation ?? ''))
          setValue(String(data.value ?? ''))
        } else {
          const recSnap = await getDoc(doc(db, 'restaurants', restaurantId, 'recipes', ingredientRow.ingredientId))
          if (recSnap.exists()) {
            setSource({ id: recSnap.id, ...recSnap.data() })
            setKind('subrecipe')
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [open, restaurantId, ingredientRow?.ingredientId])

  if (!open) return null

  const ink = isDark ? '#f0ece4' : '#111827'
  const t2 = isDark ? '#9ca3af' : '#6b7280'
  const t3 = isDark ? '#6b7280' : '#9ca3af'
  const bg = isDark ? '#111712' : '#fff'
  const bg2 = isDark ? '#1f2937' : '#f9fafb'
  const bdr = isDark ? '#1f2937' : '#e5e7eb'

  const computedPrice = (() => {
    const q = parseFloat(qty) || 0
    const v = parseFloat(value) || 0
    return q > 0 ? v / q : 0
  })()

  const handleSave = async () => {
    if (!source?.id) return
    const q = parseFloat(qty) || 0
    const v = parseFloat(value) || 0
    if (q <= 0) { error('La cantidad por presentación debe ser mayor a 0'); return }
    if (v < 0) { error('El valor de presentación es inválido'); return }
    setSaving(true)
    try {
      const newPrice = q > 0 ? v / q : 0
      await updateIngredient(restaurantId, source.id, {
        quantityPerPresentation: q,
        value: v,
        pricePerUnit: newPrice,
      })
      // Notifica al row de la receta para que actualice su pricePerUnit
      // local sin tener que recargar la receta completa.
      onSaved?.({
        ingredientId: source.id,
        pricePerUnit: newPrice,
        value: v,
        quantityPerPresentation: q,
      })
      success('Materia prima actualizada')
      onClose?.()
    } catch (err) {
      error('Error al guardar: ' + (err?.message || 'desconocido'))
    } finally {
      setSaving(false)
    }
  }

  const goToSubrecipe = () => {
    if (source?.id) {
      onClose?.()
      navigate(`/recipes/${source.id}`, { state: { from: 'source-modal' } })
    }
  }

  return (
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
        width: 'min(480px, 95vw)', maxHeight: '90vh', overflowY: 'auto',
        padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: ink, margin: 0 }}>
            {kind === 'subrecipe' ? 'Sub-receta de origen' : 'Materia prima de origen'}
          </h2>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t2, padding: 4 }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: t3, padding: '40px 0', fontSize: '0.85rem' }}>
            Cargando…
          </div>
        ) : !source ? (
          <div style={{ textAlign: 'center', color: t3, padding: '40px 0', fontSize: '0.85rem' }}>
            No se encontró la fuente original. Quizás fue eliminada.
          </div>
        ) : kind === 'mp' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row label="Código" value={source.code || '—'} mono />
            <Row label="Nombre" value={source.name || source.description || '—'} ink={ink} />
            <Row label="Unidad de uso" value={source.useUnit || source.unit || '—'} />
            <Row label="Unidad de compra" value={source.purchaseUnit || '—'} />

            <div style={{ height: 1, background: bdr, margin: '6px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={`Cant. por presentación (${source.purchaseUnit || ''})`} ink={ink} t3={t3}>
                <input type="number" min="0" step="0.001"
                  value={qty} onChange={(e) => setQty(e.target.value)}
                  disabled={!canEdit}
                  style={inp(isDark)} />
              </Field>
              <Field label="Valor presentación" ink={ink} t3={t3}>
                <input type="number" min="0" step="0.01"
                  value={value} onChange={(e) => setValue(e.target.value)}
                  disabled={!canEdit}
                  style={inp(isDark)} />
              </Field>
            </div>

            <div style={{ background: bg2, border: `1px dashed ${bdr}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: '0.7rem', color: t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Precio por {source.useUnit || 'unidad'}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent)' }}>
                {formatNumber(computedPrice)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={onClose}
                style={btn(isDark, 'ghost')}>
                {canEdit ? 'Cancelar' : 'Cerrar'}
              </button>
              {canEdit && (
                <button onClick={handleSave} disabled={saving}
                  style={btn(isDark, 'primary', saving)}>
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Guardando…' : 'Guardar y actualizar'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row label="Código" value={source.code || '—'} mono />
            <Row label="Nombre" value={source.name || '—'} ink={ink} />
            <Row label="Rendimiento" value={`${formatNumber(source.yieldAmount || 0)} ${source.yieldUnit || ''}`} />
            <Row label="Costo total ingredientes" value={formatNumber(source.totalCost || 0)} />
            <Row
              label={`Costo por ${source.yieldUnit || 'unidad'}`}
              value={formatNumber(source.costPerYieldUnit || (source.yieldAmount > 0 ? (source.totalCost || 0) / source.yieldAmount : 0))}
              accent />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={onClose}
                style={btn(isDark, 'ghost')}>
                Cerrar
              </button>
              <button onClick={goToSubrecipe}
                style={btn(isDark, 'primary')}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir sub-receta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono, ink, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: '0.78rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      <span style={{
        fontSize: '0.92rem',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontWeight: accent ? 700 : 500,
        color: accent ? 'var(--accent)' : (ink || 'inherit'),
        textAlign: 'right', wordBreak: 'break-word',
      }}>
        {value}
      </span>
    </div>
  )
}

function Field({ label, children, ink, t3 }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: t3 || '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp = (isDark) => ({
  width: '100%',
  background: isDark ? '#1f2937' : '#fff',
  border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
  borderRadius: 8, padding: '8px 10px',
  fontFamily: 'inherit', fontSize: '0.9rem',
  color: isDark ? '#f9fafb' : '#111827',
  outline: 'none', boxSizing: 'border-box',
})

const btn = (isDark, kind, disabled) => {
  const base = {
    border: 'none', borderRadius: 8,
    padding: '8px 16px', fontFamily: 'inherit',
    fontSize: '0.85rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }
  if (kind === 'primary') return { ...base, background: 'var(--accent)', color: '#fff' }
  return {
    ...base,
    background: 'none',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    color: isDark ? '#9ca3af' : '#6b7280',
  }
}
