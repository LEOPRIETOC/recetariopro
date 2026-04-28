import { useEffect, useState } from 'react'
import { Eye, EyeOff, Send } from 'lucide-react'
import { addRecipeNote, setRecipeNoteHidden } from '../services/restaurants'
import { useAuth } from '../hooks/useAuth'

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function buildEntries(recipe) {
  const arr = Array.isArray(recipe?.noteEntries) ? [...recipe.noteEntries] : []
  arr.sort((a, b) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0
    return ta - tb
  })
  return arr
}

/**
 * Props:
 *  - recipe: { id, notes (legacy string), noteEntries }
 *  - restaurantId: string
 *  - isDark: boolean
 *  - readOnly?: boolean       // true → no input ni borrar (uso en padre que muestra notas heredadas)
 *  - title?: string
 *  - onChange?: (newEntries) => void   // notifica al padre para que actualice su recipe local
 */
export function RecipeNotes({ recipe, restaurantId, isDark, readOnly = false, title = 'Notas', onChange }) {
  const { user, userProfile, isAdmin, isMaster } = useAuth()
  const canModerate = isAdmin || isMaster
  const canAdd = !readOnly && !!user?.uid

  const [entries, setEntries] = useState(() => buildEntries(recipe))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  // Re-sync if the recipe prop changes (e.g. parent re-fetched)
  useEffect(() => {
    setEntries(buildEntries(recipe))
  }, [recipe?.id, recipe?.noteEntries])

  const legacy = typeof recipe?.notes === 'string' && recipe.notes.trim() ? recipe.notes.trim() : ''
  const hiddenCount = entries.filter((e) => e.hidden).length
  const visibleEntries = entries.filter((e) => canModerate && showHidden ? true : !e.hidden)

  const handleAdd = async () => {
    const trimmed = text.trim()
    if (!trimmed || !recipe?.id || !restaurantId) return
    setBusy(true)
    try {
      const entry = await addRecipeNote(restaurantId, recipe.id, {
        text: trimmed,
        authorId: user?.uid,
        authorName: userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Usuario',
        authorRole: userProfile?.role || 'usuario',
      })
      const next = [...entries, entry]
      setEntries(next)
      onChange?.(next)
      setText('')
    } catch (err) {
      alert('No se pudo agregar la nota: ' + (err?.message || 'error desconocido'))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleHidden = async (entryId, currentHidden) => {
    if (!canModerate || readOnly) return
    setBusy(true)
    try {
      const next = await setRecipeNoteHidden(restaurantId, recipe.id, entryId, !currentHidden)
      setEntries(next)
      onChange?.(next)
    } catch (err) {
      alert('No se pudo actualizar la nota: ' + (err?.message || 'error desconocido'))
    } finally {
      setBusy(false)
    }
  }

  const ink = isDark ? '#f0ece4' : '#111827'
  const lbl = isDark ? '#9ca3af' : '#6b7280'
  const t3 = isDark ? '#6b7280' : '#9ca3af'
  const bg2 = isDark ? '#111712' : '#fff'
  const bdr = isDark ? '#1f2937' : '#e5e7eb'
  const bg3 = isDark ? '#1f2937' : '#f9fafb'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(title || (canModerate && !readOnly && hiddenCount > 0)) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {title && (
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: lbl, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {title}
            </div>
          )}
          {canModerate && !readOnly && hiddenCount > 0 && (
            <button type="button"
              onClick={() => setShowHidden((v) => !v)}
              style={{
                background: 'none', border: `1px solid ${bdr}`,
                borderRadius: 6, padding: '4px 10px',
                color: lbl, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.72rem',
                display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
              }}>
              {showHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showHidden ? `Ocultar ${hiddenCount} ocultas` : `Ver ${hiddenCount} ocultas`}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {visibleEntries.length === 0 && !legacy && (
        <div style={{ fontSize: '0.82rem', color: t3, fontStyle: 'italic', padding: '6px 0' }}>
          {entries.length > 0 && !showHidden ? `Sin notas visibles (${hiddenCount} oculta${hiddenCount !== 1 ? 's' : ''}).` : 'Sin notas todavía.'}
        </div>
      )}

      {/* Legacy single-string note (read-only, marcada como previa) */}
      {legacy && (
        <div style={{ background: bg3, border: `1px dashed ${bdr}`, borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: '0.7rem', color: t3, marginBottom: 4 }}>Nota previa (sin autor):</div>
          <div style={{ fontSize: '0.85rem', color: ink, whiteSpace: 'pre-wrap' }}>{legacy}</div>
        </div>
      )}

      {/* Notes list */}
      {visibleEntries.map((e) => (
        <div key={e.id}
          style={{
            background: bg2,
            border: `1px solid ${e.hidden ? '#f59e0b66' : bdr}`,
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
            opacity: e.hidden ? 0.6 : 1,
          }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', color: t3, marginBottom: 2 }}>
              <strong style={{ color: ink, fontWeight: 600 }}>{e.authorName}</strong> escribió{e.createdAt ? ` · ${formatDate(e.createdAt)}` : ''}:
              {e.hidden && (
                <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 600, fontSize: '0.7rem' }}>
                  · OCULTA
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.88rem', color: ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontStyle: e.hidden ? 'italic' : 'normal' }}>
              {e.text}
            </div>
          </div>
          {canModerate && !readOnly && (
            <button type="button"
              onClick={() => handleToggleHidden(e.id, e.hidden)}
              disabled={busy}
              title={e.hidden ? 'Mostrar nota' : 'Ocultar nota'}
              style={{
                background: 'none', border: 'none',
                cursor: busy ? 'wait' : 'pointer',
                color: e.hidden ? '#10b981' : '#9ca3af',
                padding: 4, flexShrink: 0,
              }}>
              {e.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          )}
        </div>
      ))}

      {/* Add input */}
      {canAdd && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAdd() }
            }}
            placeholder="Escribe una nota… (Ctrl+Enter para enviar)"
            rows={2}
            style={{
              flex: 1,
              background: bg2, border: `1px solid ${bdr}`, borderRadius: 8,
              padding: '8px 10px',
              fontFamily: 'inherit', fontSize: '0.85rem',
              color: ink, outline: 'none', resize: 'vertical',
              minHeight: 40, boxSizing: 'border-box',
            }}
          />
          <button type="button"
            onClick={handleAdd}
            disabled={busy || !text.trim()}
            style={{
              background: 'var(--accent, #d97706)', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '0 14px',
              cursor: busy || !text.trim() ? 'not-allowed' : 'pointer',
              opacity: busy || !text.trim() ? 0.6 : 1,
              fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap',
            }}>
            <Send className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>
      )}
    </div>
  )
}
