// Auditoria de formato — recorre las colecciones del restaurante actual
// y reporta los registros que NO cumplen las 5 reglas de casing del proyecto:
//   1. Recetas / sub-recetas → TODO MAYUSCULAS
//   2. Menus (categorias)     → Title Case
//   3. Ingredientes / MPs     → Sentence case (1ra letra en mayus)
//   4. Unidades de medida     → TODO MAYUSCULAS
//   5. Preparacion            → 1ra de cada renglon en mayus
//
// No modifica datos. Solo lee + lista. La correccion la decide el usuario.

import { useState, useMemo } from 'react'
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  toTitleCase,
  toSentenceCase,
  capitalizeLines,
  violatesUpper,
  violatesTitleCase,
  violatesSentenceCase,
  violatesLineCase,
  cn,
} from '../../lib/utils'
import * as XLSX from 'xlsx'

const ENTITY_LABEL = {
  recipe:    'Receta',
  subrecipe: 'Sub-receta',
  mp:        'Materia prima',
  category:  'Menú',
  mpcat:     'Cat. MP',
  unit:      'Unidad',
}

async function runAudit(restaurantId) {
  if (!restaurantId) return []
  const issues = []

  const [recsSnap, mpsSnap, catsSnap, mpCatsSnap, unitsSnap] = await Promise.all([
    getDocs(collection(db, 'restaurants', restaurantId, 'recipes')),
    getDocs(collection(db, 'restaurants', restaurantId, 'materias_primas')),
    getDocs(collection(db, 'restaurants', restaurantId, 'mp_categories')).catch(() => null),
    getDocs(collection(db, 'restaurants', restaurantId, 'mp_categories')).catch(() => null),
    getDocs(collection(db, 'restaurants', restaurantId, 'units')).catch(() => null),
  ])

  // Categorias de menu (recetas) — pueden estar en 'categories'
  const categoriesSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories')).catch(() => null)

  // Recetas y sub-recetas
  recsSnap.docs.forEach((d) => {
    const r = { id: d.id, ...d.data() }
    const isSub = r.isSubRecipe === true || r.type === 'subrecipe'
    const kind = isSub ? 'subrecipe' : 'recipe'

    if (violatesUpper(r.name)) {
      issues.push({
        kind, id: r.id, code: r.code || '', field: 'name',
        current: r.name, suggested: String(r.name || '').toUpperCase(),
      })
    }

    if (violatesLineCase(r.preparation)) {
      issues.push({
        kind, id: r.id, code: r.code || '', field: 'preparation',
        current: r.preparation, suggested: capitalizeLines(r.preparation || ''),
      })
    }

    // Ingredientes embebidos en la receta
    ;(r.ingredients || []).forEach((ing, idx) => {
      const desc = ing?.description || ing?.ingredientName || ''
      if (violatesSentenceCase(desc)) {
        issues.push({
          kind, id: r.id, code: r.code || '', field: `ingredients[${idx}].description`,
          current: desc, suggested: toSentenceCase(desc),
        })
      }
      const u = ing?.unit || ''
      if (violatesUpper(u)) {
        issues.push({
          kind, id: r.id, code: r.code || '', field: `ingredients[${idx}].unit`,
          current: u, suggested: String(u || '').toUpperCase(),
        })
      }
    })

    // Unidad de rendimiento de sub-receta
    if (isSub && violatesUpper(r.yieldUnit)) {
      issues.push({
        kind, id: r.id, code: r.code || '', field: 'yieldUnit',
        current: r.yieldUnit, suggested: String(r.yieldUnit || '').toUpperCase(),
      })
    }
  })

  // Materias primas
  mpsSnap.docs.forEach((d) => {
    const m = { id: d.id, ...d.data() }
    const name = m.name || m.description || ''
    if (violatesSentenceCase(name)) {
      issues.push({
        kind: 'mp', id: m.id, code: m.code || '', field: 'name',
        current: name, suggested: toSentenceCase(name),
      })
    }
    if (violatesUpper(m.unit)) {
      issues.push({
        kind: 'mp', id: m.id, code: m.code || '', field: 'unit',
        current: m.unit, suggested: String(m.unit || '').toUpperCase(),
      })
    }
    if (violatesUpper(m.useUnit)) {
      issues.push({
        kind: 'mp', id: m.id, code: m.code || '', field: 'useUnit',
        current: m.useUnit, suggested: String(m.useUnit || '').toUpperCase(),
      })
    }
    if (violatesUpper(m.purchaseUnit)) {
      issues.push({
        kind: 'mp', id: m.id, code: m.code || '', field: 'purchaseUnit',
        current: m.purchaseUnit, suggested: String(m.purchaseUnit || '').toUpperCase(),
      })
    }
  })

  // Categorias de menu
  ;(categoriesSnap?.docs || []).forEach((d) => {
    const c = { id: d.id, ...d.data() }
    if (violatesTitleCase(c.name)) {
      issues.push({
        kind: 'category', id: c.id, code: c.code || '', field: 'name',
        current: c.name, suggested: toTitleCase(c.name),
      })
    }
  })

  // Categorias de MP — Title Case (mismo criterio)
  ;(mpCatsSnap?.docs || []).forEach((d) => {
    const c = { id: d.id, ...d.data() }
    if (violatesTitleCase(c.name)) {
      issues.push({
        kind: 'mpcat', id: c.id, code: c.code || '', field: 'name',
        current: c.name, suggested: toTitleCase(c.name),
      })
    }
  })

  // Unidades — abreviation y nombre
  ;(unitsSnap?.docs || []).forEach((d) => {
    const u = { id: d.id, ...d.data() }
    if (violatesUpper(u.abbreviation)) {
      issues.push({
        kind: 'unit', id: u.id, code: u.code || '', field: 'abbreviation',
        current: u.abbreviation, suggested: String(u.abbreviation || '').toUpperCase(),
      })
    }
    if (violatesSentenceCase(u.name)) {
      issues.push({
        kind: 'unit', id: u.id, code: u.code || '', field: 'name',
        current: u.name, suggested: toSentenceCase(u.name),
      })
    }
  })

  return issues
}

// ─── Backup completo del restaurante ──────────────────────────────────────────
const BACKUP_COLLECTIONS = [
  'recipes', 'materias_primas', 'categories', 'mp_categories',
  'units', 'suppliers', 'sales_data',
]

async function downloadBackup(restaurantId, restaurantName) {
  if (!restaurantId) throw new Error('No hay restaurante activo')
  const out = { restaurantId, restaurantName, exportedAt: new Date().toISOString(), collections: {} }

  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, 'restaurants', restaurantId, colName))
      out.collections[colName] = snap.docs.map((d) => ({ _id: d.id, ...d.data() }))
    } catch (err) {
      console.warn(`[backup] no pude leer ${colName}`, err?.message)
      out.collections[colName] = { error: err?.message || 'unreadable' }
    }
  }

  // JSON
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const safeName = (restaurantName || 'restaurante').replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const jsonBlob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
  const jsonUrl = URL.createObjectURL(jsonBlob)
  const a = document.createElement('a')
  a.href = jsonUrl
  a.download = `respaldo_${safeName}_${stamp}.json`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(jsonUrl)

  // Excel — una hoja por coleccion (campos top-level del doc; las columnas
  // anidadas como ingredients[] van como JSON en una celda)
  const wb = XLSX.utils.book_new()
  for (const [colName, docs] of Object.entries(out.collections)) {
    if (!Array.isArray(docs) || docs.length === 0) continue
    const flat = docs.map((d) => {
      const row = {}
      for (const [k, v] of Object.entries(d)) {
        row[k] = (v && typeof v === 'object') ? JSON.stringify(v) : v
      }
      return row
    })
    const ws = XLSX.utils.json_to_sheet(flat)
    XLSX.utils.book_append_sheet(wb, ws, colName.slice(0, 31))
  }
  XLSX.writeFile(wb, `respaldo_${safeName}_${stamp}.xlsx`)

  return out
}

// ─── Aplicar correcciones ────────────────────────────────────────────────────
// Agrupa los issues por documento (cada update toca el doc 1 sola vez) y
// los aplica en lotes de hasta 400 (limite de firestore: 500).
async function applyFixes(restaurantId, issues) {
  if (!restaurantId || !issues?.length) return { updated: 0 }

  // Agrupar por (kind + id)
  const byDoc = new Map()
  for (const i of issues) {
    const key = `${i.kind}:${i.id}`
    if (!byDoc.has(key)) byDoc.set(key, { kind: i.kind, id: i.id, fields: [] })
    byDoc.get(key).fields.push(i)
  }

  // Para arrays anidados (ingredients[N].field), necesitamos cargar el doc actual
  const recipesNeedingLoad = []
  for (const docInfo of byDoc.values()) {
    if (docInfo.kind === 'recipe' || docInfo.kind === 'subrecipe') {
      const hasNested = docInfo.fields.some((f) => f.field.startsWith('ingredients['))
      if (hasNested) recipesNeedingLoad.push(docInfo.id)
    }
  }

  const recipeCache = new Map()
  if (recipesNeedingLoad.length) {
    const recsSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
    recsSnap.docs.forEach((d) => recipeCache.set(d.id, d.data()))
  }

  let updated = 0
  let batch = writeBatch(db)
  let ops = 0

  const flush = async () => {
    if (ops === 0) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  const collectionFor = (kind) => ({
    recipe: 'recipes', subrecipe: 'recipes',
    mp: 'materias_primas',
    category: 'categories',
    mpcat: 'mp_categories',
    unit: 'units',
  })[kind]

  for (const docInfo of byDoc.values()) {
    const colName = collectionFor(docInfo.kind)
    if (!colName) continue
    const ref = doc(db, 'restaurants', restaurantId, colName, docInfo.id)
    const updates = { updatedAt: serverTimestamp() }

    // Campos directos
    const directFields = docInfo.fields.filter((f) => !f.field.startsWith('ingredients['))
    for (const f of directFields) {
      updates[f.field] = f.suggested
    }

    // Ingredientes anidados (solo recetas/sub-recetas)
    const ingFields = docInfo.fields.filter((f) => f.field.startsWith('ingredients['))
    if (ingFields.length) {
      const current = recipeCache.get(docInfo.id)
      if (current?.ingredients) {
        const ingredients = current.ingredients.map((ing) => ({ ...ing }))
        for (const f of ingFields) {
          const m = f.field.match(/ingredients\[(\d+)\]\.(\w+)/)
          if (!m) continue
          const idx = parseInt(m[1], 10)
          const subField = m[2]
          if (ingredients[idx]) ingredients[idx][subField] = f.suggested
        }
        updates.ingredients = ingredients
      }
    }

    batch.update(ref, updates)
    ops++
    updated++
    if (ops >= 400) { await flush() }
  }
  await flush()
  return { updated }
}

export default function AuditFormatTab({ restaurantId, isDark }) {
  const [running, setRunning] = useState(false)
  const [issues, setIssues] = useState(null)
  const [filter, setFilter] = useState('all')
  const [backupDone, setBackupDone] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleRun = async () => {
    setRunning(true)
    try {
      const found = await runAudit(restaurantId)
      setIssues(found)
    } catch (err) {
      console.error('[AuditFormat] error', err)
      alert('Error ejecutando auditoría: ' + (err?.message || 'desconocido'))
    } finally {
      setRunning(false)
    }
  }

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      await downloadBackup(restaurantId, '')
      setBackupDone(true)
    } catch (err) {
      console.error('[AuditFormat] backup error', err)
      alert('Error descargando respaldo: ' + (err?.message || 'desconocido'))
    } finally {
      setBackingUp(false)
    }
  }

  const handleApply = async () => {
    if (!issues?.length) return
    setApplying(true)
    try {
      const { updated } = await applyFixes(restaurantId, issues)
      setConfirmOpen(false)
      alert(`Correcciones aplicadas: ${updated} documento(s) actualizado(s).\n\nEjecutá la auditoría de nuevo para verificar.`)
      // Re-correr la auditoria automaticamente para mostrar el resultado
      await handleRun()
    } catch (err) {
      console.error('[AuditFormat] apply error', err)
      alert('Error aplicando correcciones: ' + (err?.message || 'desconocido'))
    } finally {
      setApplying(false)
    }
  }

  const counts = useMemo(() => {
    if (!issues) return null
    const by = {}
    issues.forEach((i) => { by[i.kind] = (by[i.kind] || 0) + 1 })
    return { total: issues.length, by }
  }, [issues])

  const filtered = useMemo(() => {
    if (!issues) return []
    if (filter === 'all') return issues
    return issues.filter((i) => i.kind === filter)
  }, [issues, filter])

  const exportExcel = () => {
    if (!issues?.length) return
    const rows = issues.map((i) => ({
      Tipo: ENTITY_LABEL[i.kind] || i.kind,
      ID: i.id,
      Codigo: i.code || '',
      Campo: i.field,
      Actual: typeof i.current === 'string' ? i.current : JSON.stringify(i.current),
      Sugerido: typeof i.suggested === 'string' ? i.suggested : JSON.stringify(i.suggested),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 26 }, { wch: 40 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria')
    XLSX.writeFile(wb, `auditoria_formato_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const ink   = isDark ? '#f0ece4' : '#111827'
  const t2    = isDark ? '#9ca3af' : '#6b7280'
  const t3    = isDark ? '#6b7280' : '#9ca3af'
  const card  = isDark ? '#111712' : '#fff'
  const b1    = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'
  const stripe = isDark ? '#0d110e' : '#f9fafb'

  const filterTabs = [
    { id: 'all',       label: 'Todo' },
    { id: 'recipe',    label: 'Recetas' },
    { id: 'subrecipe', label: 'Sub-recetas' },
    { id: 'mp',        label: 'Materias' },
    { id: 'category',  label: 'Menús' },
    { id: 'mpcat',     label: 'Cat. MP' },
    { id: 'unit',      label: 'Unidades' },
  ]

  return (
    <div style={{ padding: '16px 20px', fontFamily: "'DM Sans', sans-serif", color: ink }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Auditoría de formato</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: t2 }}>
          Recorre las colecciones del restaurante y lista los registros que no cumplen las reglas
          de casing. <strong>Solo reporta — no modifica.</strong>
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 18px', fontFamily: 'inherit', fontWeight: 700,
            fontSize: '0.85rem', cursor: running ? 'wait' : 'pointer', opacity: running ? 0.7 : 1,
          }}
        >
          {running ? 'Auditando…' : (issues ? 'Auditar de nuevo' : 'Ejecutar auditoría')}
        </button>
        {issues && issues.length > 0 && (
          <button
            type="button"
            onClick={exportExcel}
            style={{
              background: 'transparent', color: 'var(--accent)',
              border: '1px solid var(--accent)', borderRadius: 8,
              padding: '9px 16px', fontFamily: 'inherit', fontWeight: 600,
              fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            Exportar a Excel
          </button>
        )}
      </div>

      {issues && issues.length > 0 && (
        <div style={{
          background: backupDone ? 'rgba(16,185,129,0.08)' : (isDark ? '#1f2937' : '#fef3c7'),
          border: `1px solid ${backupDone ? '#10b981' : '#f59e0b'}`,
          borderRadius: 12, padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 6, color: backupDone ? '#059669' : (isDark ? '#fef3c7' : '#92400e') }}>
            {backupDone ? '✓ Respaldo descargado' : '⚠ Antes de aplicar correcciones, descargá un respaldo'}
          </div>
          <div style={{ fontSize: '0.78rem', color: t2, marginBottom: 10, lineHeight: 1.5 }}>
            La operación es masiva e <strong>irreversible</strong>. Descargá un respaldo
            (JSON + Excel con todas las colecciones) antes de aplicar.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleBackup}
              disabled={backingUp}
              style={{
                background: backupDone ? 'transparent' : '#0833A2',
                color: backupDone ? '#059669' : '#fff',
                border: backupDone ? '1px solid #10b981' : 'none',
                borderRadius: 8, padding: '8px 16px',
                fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem',
                cursor: backingUp ? 'wait' : 'pointer', opacity: backingUp ? 0.7 : 1,
              }}
            >
              {backingUp ? 'Descargando…' : (backupDone ? 'Descargar respaldo de nuevo' : '1. Descargar respaldo')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!backupDone || applying}
              title={!backupDone ? 'Primero descargá el respaldo' : 'Aplicar las correcciones'}
              style={{
                background: backupDone ? '#dc2626' : '#9ca3af',
                color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 16px',
                fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem',
                cursor: !backupDone ? 'not-allowed' : (applying ? 'wait' : 'pointer'),
                opacity: !backupDone ? 0.5 : (applying ? 0.7 : 1),
              }}
            >
              {applying ? 'Aplicando…' : `2. Aplicar ${issues.length} corrección${issues.length === 1 ? '' : 'es'}`}
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: card, border: `1px solid ${b1}`, borderRadius: 16,
            padding: '24px 22px', maxWidth: 440, width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: ink }}>
              Confirmar aplicación
            </h3>
            <p style={{ margin: '10px 0 16px', fontSize: '0.85rem', color: t2, lineHeight: 1.5 }}>
              Se modificarán <strong>{issues?.length || 0}</strong> campo(s) en Firestore.
              Esta operación <strong>no se puede deshacer</strong> desde la app.
              Ya tenés el respaldo descargado por si necesitás restaurar.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={applying}
                style={{
                  background: 'transparent', color: t2,
                  border: `1px solid ${b1}`, borderRadius: 8,
                  padding: '8px 18px', fontFamily: 'inherit', fontWeight: 600,
                  fontSize: '0.85rem', cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                style={{
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontFamily: 'inherit',
                  fontWeight: 700, fontSize: '0.85rem',
                  cursor: applying ? 'wait' : 'pointer', opacity: applying ? 0.7 : 1,
                }}
              >{applying ? 'Aplicando…' : 'Sí, aplicar'}</button>
            </div>
          </div>
        </div>
      )}

      {counts && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Pill label={`Total: ${counts.total}`} accent isDark={isDark} />
          {Object.entries(counts.by).map(([k, n]) => (
            <Pill key={k} label={`${ENTITY_LABEL[k] || k}: ${n}`} isDark={isDark} />
          ))}
        </div>
      )}

      {issues && counts.total > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {filterTabs.map((tab) => {
            const active = filter === tab.id
            const count = tab.id === 'all' ? counts.total : (counts.by[tab.id] || 0)
            if (tab.id !== 'all' && count === 0) return null
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : t2,
                  border: `1px solid ${active ? 'var(--accent)' : b1}`,
                  borderRadius: 999, padding: '4px 12px',
                  fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tab.label} {count > 0 && `(${count})`}
              </button>
            )
          })}
        </div>
      )}

      {issues && counts.total === 0 && (
        <div style={{
          background: card, border: `1px solid ${b1}`, borderRadius: 12,
          padding: '24px 18px', textAlign: 'center', color: t2,
        }}>
          ✓ Todo en orden — no se encontraron formatos incorrectos.
        </div>
      )}

      {issues && filtered.length > 0 && (
        <div style={{
          background: card, border: `1px solid ${b1}`, borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: stripe, zIndex: 1 }}>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Código</Th>
                  <Th>Campo</Th>
                  <Th>Actual</Th>
                  <Th>Sugerido</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => (
                  <tr key={`${i.kind}-${i.id}-${i.field}-${idx}`} style={{
                    borderTop: `1px solid ${b1}`,
                    background: idx % 2 === 0 ? 'transparent' : stripe,
                  }}>
                    <Td>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                        color: 'var(--accent)',
                        padding: '2px 8px', borderRadius: 6,
                      }}>{ENTITY_LABEL[i.kind] || i.kind}</span>
                    </Td>
                    <Td><span style={{ fontFamily: 'monospace', color: t3 }}>{i.code || '—'}</span></Td>
                    <Td><span style={{ fontFamily: 'monospace', color: t2 }}>{i.field}</span></Td>
                    <Td>
                      <span style={{ color: '#dc2626', whiteSpace: 'pre-wrap' }}>
                        {String(i.current ?? '')}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ color: '#059669', whiteSpace: 'pre-wrap' }}>
                        {String(i.suggested ?? '')}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!issues && !running && (
        <div style={{ color: t3, fontSize: '0.85rem' }}>
          Presioná <strong>Ejecutar auditoría</strong> para escanear el restaurante.
        </div>
      )}
    </div>
  )
}

function Pill({ label, accent, isDark }) {
  return (
    <span style={{
      background: accent ? 'var(--accent)' : (isDark ? '#1f2937' : '#f1f5f9'),
      color: accent ? '#fff' : (isDark ? '#cbd5e1' : '#334155'),
      padding: '4px 10px', borderRadius: 999,
      fontSize: '0.75rem', fontWeight: 700,
    }}>{label}</span>
  )
}

function Th({ children }) {
  return (
    <th style={{
      textAlign: 'left', padding: '8px 12px',
      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>{children}</th>
  )
}

function Td({ children }) {
  return <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>{children}</td>
}
