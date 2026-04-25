import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { parseWorkbook, validateSheets, executeBulkImport, generateMasterTemplate } from '../services/bulkImportService'

// ── Sheet labels ──────────────────────────────────────────────────────────────

const SHEET_INFO = {
  unidades:    { label: 'Unidades',       order: 1 },
  menus:       { label: 'Menús',          order: 2 },
  proveedores: { label: 'Proveedores',    order: 3 },
  materias:    { label: 'Materias Primas',order: 4 },
  subrecetas:  { label: 'Sub-recetas',    order: 5 },
  recetas:     { label: 'Recetas',        order: 6 },
}

// ── Issue list component ──────────────────────────────────────────────────────

function IssueList({ issues, type, isDark }) {
  const [open, setOpen] = useState(false)
  if (!issues.length) return null
  const isErr = type === 'error'
  const color = isErr ? '#ef4444' : '#f59e0b'
  const bg    = isErr ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)') : (isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)')

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color, fontSize: '0.78rem', fontWeight: 600, padding: 0 }}
      >
        {isErr ? <XCircle size={13} /> : <AlertTriangle size={13} />}
        {issues.length} {isErr ? 'error' : 'advertencia'}{issues.length !== 1 ? 's' : ''}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ marginTop: 6, background: bg, borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {issues.map((issue, i) => (
            <div key={i} style={{ fontSize: '0.75rem' }}>
              <span style={{ color, fontWeight: 600 }}>
                {issue.row ? `Fila ${issue.row} · ` : ''}{issue.field}:
              </span>
              <span style={{ color: isDark ? '#d1d5db' : '#374151', marginLeft: 4 }}>{issue.message}</span>
              {issue.fix && (
                <div style={{ color: isDark ? '#6b7280' : '#9ca3af', marginTop: 2, paddingLeft: 8 }}>
                  → {issue.fix}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sheet summary card ────────────────────────────────────────────────────────

function SheetCard({ sheetKey, data, isDark }) {
  const info = SHEET_INFO[sheetKey]
  const hasErrors   = data.errors.length > 0
  const hasWarnings = data.warnings.length > 0
  const allOk       = !hasErrors && !hasWarnings

  const borderColor = hasErrors   ? '#ef4444'
                    : hasWarnings ? '#f59e0b'
                    : data.found  ? '#22c55e'
                    : isDark      ? '#374151' : '#e5e7eb'

  const bg = isDark ? '#111712' : '#fff'

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 10, padding: '12px 14px', background: bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', background: isDark ? '#1f2937' : '#f3f4f6', borderRadius: 4, padding: '2px 6px' }}>
            {info.order}
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: isDark ? '#f0ece4' : '#111827' }}>
            {info.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data.found && (
            <span style={{ fontSize: '0.72rem', color: isDark ? '#6b7280' : '#9ca3af' }}>
              {data.rows} fila{data.rows !== 1 ? 's' : ''}
            </span>
          )}
          {!data.found && (
            <span style={{ fontSize: '0.72rem', color: isDark ? '#4b5563' : '#d1d5db' }}>No incluida</span>
          )}
          {data.found && allOk   && <CheckCircle size={15} color="#22c55e" />}
          {data.found && hasErrors   && <XCircle    size={15} color="#ef4444" />}
          {data.found && !hasErrors && hasWarnings && <AlertTriangle size={15} color="#f59e0b" />}
        </div>
      </div>
      {data.found && (
        <>
          <IssueList issues={data.errors}   type="error"   isDark={isDark} />
          <IssueList issues={data.warnings} type="warning" isDark={isDark} />
        </>
      )}
    </div>
  )
}

// ── Import result card ────────────────────────────────────────────────────────

function ResultCard({ sheetKey, result, isDark }) {
  const info = SHEET_INFO[sheetKey]
  const hasErrors = result.errors?.length > 0

  return (
    <div style={{ border: `1px solid ${hasErrors ? '#ef4444' : '#22c55e'}`, borderRadius: 10, padding: '10px 14px', background: isDark ? '#111712' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isDark ? '#f0ece4' : '#111827' }}>{info.label}</span>
        <CheckCircle size={14} color={hasErrors ? '#f59e0b' : '#22c55e'} />
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem' }}>
        <span style={{ color: '#22c55e' }}>+{result.created ?? 0} creados</span>
        <span style={{ color: 'var(--accent)' }}>~{result.updated ?? 0} actualizados</span>
        {hasErrors && <span style={{ color: '#ef4444' }}>{result.errors.length} errores</span>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BulkImportTab({ restaurantId, isDark }) {
  const [step, setStep]             = useState('upload')   // upload | validating | validated | importing | done
  const [sheets, setSheets]         = useState(null)
  const [fileName, setFileName]     = useState('')
  const [unknownSheets, setUnknown] = useState([])
  const [validation, setValidation] = useState(null)
  const [progress, setProgress]     = useState(null)
  const [results, setResults]       = useState(null)
  const [dragOver, setDragOver]     = useState(false)
  const fileRef = useRef()

  const t2 = isDark ? '#8a8578' : '#6b7280'
  const t3 = isDark ? '#4a4840' : '#9ca3af'
  const b1 = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setFileName(file.name)
    setStep('validating')
    setValidation(null)
    setResults(null)
    try {
      const { sheets: parsed, unknown } = await parseWorkbook(file)
      setSheets(parsed)
      setUnknown(unknown.filter(n => !['INSTRUCCIONES', 'instrucciones'].includes(n)))
      const val = await validateSheets(parsed, restaurantId)
      setValidation(val)
      setStep('validated')
    } catch (err) {
      console.error(err)
      setStep('upload')
      alert('Error al leer el archivo: ' + err.message)
    }
  }, [restaurantId])

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileChange = (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!sheets || !validation?.canImport) return
    setStep('importing')
    try {
      const res = await executeBulkImport(restaurantId, sheets, (p) => setProgress(p))
      setResults(res)
      setStep('done')
    } catch (err) {
      console.error(err)
      alert('Error durante la importación: ' + err.message)
      setStep('validated')
    }
  }

  const reset = () => {
    setStep('upload'); setSheets(null); setFileName(''); setValidation(null)
    setProgress(null); setResults(null); setUnknown([])
  }

  // ── Upload step ────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: isDark ? '#f0ece4' : '#111827', margin: 0 }}>Importación Masiva</h3>
            <p style={{ fontSize: '0.8rem', color: t3, marginTop: 3 }}>Un solo archivo Excel con todas las hojas: Unidades, Menús, Proveedores, Materias Primas, Sub-recetas y Recetas</p>
          </div>
          <button
            onClick={generateMasterTemplate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${b1}`, background: 'transparent', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <Download size={14} /> Descargar plantilla
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : b1}`,
            borderRadius: 14,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <FileSpreadsheet size={40} style={{ color: 'var(--accent)', margin: '0 auto 12px', opacity: 0.7 }} />
          <p style={{ fontWeight: 600, color: isDark ? '#f0ece4' : '#111827', marginBottom: 4 }}>
            Arrastra tu archivo Excel aquí
          </p>
          <p style={{ fontSize: '0.8rem', color: t3 }}>o haz clic para seleccionar · .xlsx / .xls</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileChange} />
        </div>

        {/* Sheet reference */}
        <div style={{ border: `1px solid ${b1}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: isDark ? '#111712' : '#f9fafb', borderBottom: `1px solid ${b1}` }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hojas esperadas en el archivo</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {Object.entries(SHEET_INFO).sort((a,b) => a[1].order - b[1].order).map(([key, info]) => (
              <div key={key} style={{ padding: '10px 14px', borderRight: '1px solid ' + b1, borderBottom: '1px solid ' + b1, fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: 6 }}>{info.order}.</span>
                <span style={{ color: isDark ? '#d1d5db' : '#374151', fontWeight: 600 }}>{key.toUpperCase()}</span>
                <div style={{ fontSize: '0.72rem', color: t3, marginTop: 2 }}>{info.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Validating step ────────────────────────────────────────────────────────
  if (step === 'validating') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
        <Loader2 size={36} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: isDark ? '#d1d5db' : '#374151', fontWeight: 600 }}>Validando {fileName}…</p>
        <p style={{ color: t3, fontSize: '0.8rem' }}>Verificando referencias cruzadas con la base de datos</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Validated step ─────────────────────────────────────────────────────────
  if (step === 'validated' && validation) {
    const foundSheets = Object.values(validation.sheets).filter(s => s.found).length
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.8rem', color: t3, margin: 0 }}>
              <span style={{ fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>{fileName}</span>
              {' · '}{foundSheets} hoja{foundSheets !== 1 ? 's' : ''} detectada{foundSheets !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={reset} style={{ fontSize: '0.78rem', color: t3, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Cambiar archivo
          </button>
        </div>

        {/* Unknown sheets warning */}
        {unknownSheets.length > 0 && (
          <div style={{ background: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#f59e0b' }}>
            <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
            Hojas no reconocidas (se ignorarán): {unknownSheets.join(', ')}
          </div>
        )}

        {/* Global status banner */}
        {validation.canImport ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 14px' }}>
            <CheckCircle size={18} color="#22c55e" />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#22c55e', fontSize: '0.88rem' }}>Validación completada — listo para importar</p>
              {validation.totalWarnings > 0 && (
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#f59e0b' }}>{validation.totalWarnings} advertencia{validation.totalWarnings !== 1 ? 's' : ''} no bloqueante{validation.totalWarnings !== 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px' }}>
            <XCircle size={18} color="#ef4444" />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#ef4444', fontSize: '0.88rem' }}>{validation.totalErrors} error{validation.totalErrors !== 1 ? 'es' : ''} bloqueante{validation.totalErrors !== 1 ? 's' : ''} — corrige el archivo antes de importar</p>
              {validation.totalWarnings > 0 && (
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#f59e0b' }}>{validation.totalWarnings} advertencia{validation.totalWarnings !== 1 ? 's' : ''} adicional{validation.totalWarnings !== 1 ? 'es' : ''}</p>
              )}
            </div>
          </div>
        )}

        {/* Per-sheet cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(validation.sheets)
            .sort((a, b) => SHEET_INFO[a[0]].order - SHEET_INFO[b[0]].order)
            .map(([key, data]) => (
              <SheetCard key={key} sheetKey={key} data={data} isDark={isDark} />
            ))}
        </div>

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={!validation.canImport}
          style={{
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            background: validation.canImport ? 'var(--accent)' : isDark ? '#374151' : '#e5e7eb',
            color: validation.canImport ? '#fff' : t3,
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: validation.canImport ? 'pointer' : 'not-allowed',
            transition: 'opacity 0.2s',
          }}
          onMouseOver={e => { if (validation.canImport) e.currentTarget.style.opacity = '0.85' }}
          onMouseOut={e => { e.currentTarget.style.opacity = '1' }}
        >
          {validation.canImport ? 'Importar todo' : `Corrige ${validation.totalErrors} error${validation.totalErrors !== 1 ? 'es' : ''} para continuar`}
        </button>
      </div>
    )
  }

  // ── Importing step ─────────────────────────────────────────────────────────
  if (step === 'importing') {
    const totalSteps = progress?.totalSteps || 1
    const globalPct  = progress
      ? Math.round(((progress.stepIndex * 100) + progress.pct) / totalSteps)
      : 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 700, color: isDark ? '#f0ece4' : '#111827', marginBottom: 4 }}>
            Importando {progress?.label || '…'}
          </p>
          <p style={{ fontSize: '0.8rem', color: t3 }}>
            Paso {(progress?.stepIndex ?? 0) + 1} de {totalSteps}
          </p>
        </div>

        <div style={{ background: isDark ? '#1f2937' : '#f3f4f6', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 99, width: `${globalPct}%`, transition: 'width 0.3s' }} />
        </div>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Done step ──────────────────────────────────────────────────────────────
  if (step === 'done' && results) {
    const totalCreated = Object.values(results).reduce((s, r) => s + (r.created || 0), 0)
    const totalUpdated = Object.values(results).reduce((s, r) => s + (r.updated || 0), 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '14px 16px' }}>
          <CheckCircle size={22} color="#22c55e" />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#22c55e', fontSize: '0.95rem' }}>Importación completada</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: t2 }}>
              {totalCreated} registro{totalCreated !== 1 ? 's' : ''} creado{totalCreated !== 1 ? 's' : ''}
              {totalUpdated > 0 && ` · ${totalUpdated} actualizado${totalUpdated !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Per-sheet results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(results)
            .sort((a, b) => SHEET_INFO[a[0]].order - SHEET_INFO[b[0]].order)
            .map(([key, result]) => (
              <ResultCard key={key} sheetKey={key} result={result} isDark={isDark} />
            ))}
        </div>

        <button
          onClick={reset}
          style={{ padding: '10px', borderRadius: 10, border: `1px solid ${b1}`, background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Importar otro archivo
        </button>
      </div>
    )
  }

  return null
}
