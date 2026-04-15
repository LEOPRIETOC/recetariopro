import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { RecipePrintView } from './RecipePrintView'

export function RecipeReadOnlyView({ recipe, restaurantId, userId, isDark }) {
  const navigate = useNavigate()
  const { currentRestaurant } = useAppStore()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!recipe?.id || !userId || !restaurantId) return
    getDoc(doc(db, 'restaurants', restaurantId, 'recipes', recipe.id, 'userNotes', userId))
      .then((snap) => { if (snap.exists()) setNote(snap.data().note || '') })
      .catch(() => {})
  }, [recipe?.id, userId, restaurantId])

  const persistNote = useCallback(
    (value) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        if (!recipe?.id || !userId || !restaurantId) return
        setSaving(true)
        try {
          await setDoc(
            doc(db, 'restaurants', restaurantId, 'recipes', recipe.id, 'userNotes', userId),
            { note: value, updatedAt: serverTimestamp() },
            { merge: true }
          )
        } finally {
          setSaving(false)
        }
      }, 1200)
    },
    [recipe?.id, userId, restaurantId]
  )

  const saveNote = async () => {
    if (!recipe?.id || !userId || !restaurantId) return
    clearTimeout(saveTimer.current)
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'restaurants', restaurantId, 'recipes', recipe.id, 'userNotes', userId),
        { note, updatedAt: serverTimestamp() },
        { merge: true }
      )
    } finally {
      setSaving(false)
    }
  }

  const handleNote = (e) => {
    setNote(e.target.value)
    persistNote(e.target.value)
  }

  const t3  = isDark ? '#6b7280' : '#9ca3af'
  const ink = isDark ? '#f9fafb' : '#111827'
  const bg2 = isDark ? '#1f2937' : '#f9fafb'
  const bdr = isDark ? '#374151' : '#e5e7eb'

  if (!recipe) return null

  const ingredients = recipe.ingredients || []
  const steps = recipe.preparation
    ? recipe.preparation.split('\n').filter(Boolean)
    : []

  return (
    <div>
      {/* Barra superior sticky */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--b1)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text)',
          maxWidth: '50%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {recipe?.name}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowPrint(true)}
            style={{
              background: 'transparent',
              border: '1px solid var(--b2)',
              borderRadius: 8,
              color: 'var(--t2)',
              fontFamily: 'inherit',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            🖨 Imprimir
          </button>

          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent',
              border: '1px solid var(--red)',
              borderRadius: 8,
              color: 'var(--red)',
              fontFamily: 'inherit',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '7px 14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'var(--red)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--red)'
            }}
          >
            Volver
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        {/* Title */}
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: ink, marginBottom: 4 }}>
          {recipe.name}
        </h1>
        {recipe.code && (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.05em' }}>
            {recipe.code}
          </span>
        )}

        {/* Meta chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, marginBottom: 24 }}>
          {recipe.yieldAmount > 0 && (
            <span style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', color: t3 }}>
              Rinde: {recipe.yieldAmount} {recipe.yieldUnit}
            </span>
          )}
          {recipe.preparationTime && (
            <span style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', color: t3 }}>
              ⏱ {recipe.preparationTime}
            </span>
          )}
          {recipe.category && (
            <span style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', color: t3 }}>
              {recipe.category}
            </span>
          )}
        </div>

        {/* Photo */}
        {recipe.photoURL && (
          <div style={{ marginBottom: 24 }}>
            <img src={recipe.photoURL} alt={recipe.name} style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 12 }} />
          </div>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: ink, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${bdr}` }}>
              Ingredientes
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ingredients.map((ing, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderBottom: `1px solid ${isDark ? '#1f2937' : '#f3f4f6'}`, fontSize: '0.9rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 2, display: 'inline-block' }} />
                  <span style={{ fontWeight: 700, color: ink, minWidth: 48 }}>{ing.quantity || ''}</span>
                  <span style={{ color: t3, minWidth: 40 }}>{ing.unit || ''}</span>
                  <span style={{ color: isDark ? '#d1d5db' : '#374151', flex: 1 }}>{ing.name || ing.ingredientName || ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preparation */}
        {steps.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: ink, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${bdr}` }}>
              Preparación
            </h2>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((step, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: '0.9rem', color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.65 }}>
                  <span style={{ fontWeight: 800, color: ink, minWidth: 24, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Verification badge */}
        <div style={{
          background: recipe?.verified ? 'rgba(22,163,74,0.10)' : 'rgba(100,100,100,0.08)',
          border: `1px solid ${recipe?.verified ? 'rgba(22,163,74,0.30)' : bdr}`,
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: '1.5rem' }}>{recipe?.verified ? '✅' : '⬜'}</span>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: recipe?.verified ? 'var(--green, #16a34a)' : t3 }}>
              {recipe?.verified ? 'Receta verificada' : 'Receta no verificada'}
            </div>
            {recipe?.verified && (
              <div style={{ fontSize: '0.72rem', color: t3, marginTop: 2 }}>
                Por {recipe.verifiedBy} · {recipe.verifiedAt?.toDate?.()?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Personal notes */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: ink, marginBottom: 8 }}>
            Mis notas
          </h2>
          <textarea
            value={note}
            onChange={handleNote}
            placeholder="Escribe tus notas sobre esta receta..."
            rows={5}
            style={{
              width: '100%',
              background: bg2,
              border: `1px solid ${bdr}`,
              borderRadius: 10,
              padding: '12px 14px',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              color: ink,
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = bdr }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={saveNote}
              disabled={saving}
              style={{
                background: saving ? 'var(--b2)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {saving ? 'Guardando...' : '💾 Guardar nota'}
            </button>
          </div>
        </div>
      </div>

      {/* Print view */}
      {showPrint && (
        <RecipePrintView
          recipe={recipe}
          restaurant={currentRestaurant}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
