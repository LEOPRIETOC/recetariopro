import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { cn } from '../lib/utils'

function downloadTemplate(columns, exampleRows, fileName) {
  const ws = XLSX.utils.aoa_to_sheet([columns, ...exampleRows])
  // Auto-width columns
  ws['!cols'] = columns.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
  XLSX.writeFile(wb, fileName)
}

async function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Error leyendo archivo'))
    reader.readAsArrayBuffer(file)
  })
}

export function ImportModule({
  moduleName,
  description,
  templateColumns,
  templateExample,
  templateFileName,
  onImport,
  isDark,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [allRows, setAllRows] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [report, setReport] = useState(null)

  const border = isDark ? 'border-gray-700' : 'border-gray-200'
  const subText = isDark ? 'text-gray-400' : 'text-gray-500'
  const card = isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'

  const handleFile = async (file) => {
    if (!file) return
    setParsing(true)
    setAllRows(null)
    setReport(null)
    try {
      const rows = await parseXLSX(file)
      setAllRows(rows)
    } catch {
      alert('No se pudo leer el archivo. Asegúrate de que sea un Excel válido (.xlsx / .xls)')
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleConfirm = async () => {
    if (!allRows?.length || !onImport) return
    setImporting(true)
    setProgress(0)
    try {
      const result = await onImport(allRows, setProgress)
      setReport(result)
      setAllRows(null)
    } catch (err) {
      setReport({ created: 0, updated: 0, errors: [err.message || 'Error inesperado'] })
    } finally {
      setImporting(false)
      setProgress(0)
    }
  }

  const previewRows = allRows?.slice(0, 5) || []
  const previewCols = allRows?.length ? Object.keys(allRows[0]).slice(0, 6) : []

  return (
    <div className={cn('rounded-xl border p-5 space-y-4', card)}>
      {/* Header */}
      <div>
        <h3 className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
          {moduleName}
        </h3>
        <p className={cn('text-xs mt-0.5', subText)}>{description}</p>
      </div>

      <div className="space-y-3">
        {/* Step 1 */}
        <div className="flex items-start gap-3">
          <span className={cn(
            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
          )} style={{ backgroundColor: 'var(--accent)' }}>1</span>
          <div className="flex-1">
            <p className={cn('text-xs font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')}>
              Descarga la plantilla
            </p>
            <button
              onClick={() => downloadTemplate(templateColumns, templateExample, templateFileName)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                isDark
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-600 hover:bg-white'
              )}
            >
              ⬇ Descargar plantilla Excel
            </button>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-3">
          <span className={cn(
            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
          )} style={{ backgroundColor: 'var(--accent)' }}>2</span>
          <div className="flex-1">
            <p className={cn('text-xs font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')}>
              Sube tu archivo lleno
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                dragging
                  ? 'border-amber-400 bg-amber-50/10'
                  : isDark
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-300 hover:border-gray-400'
              )}
            >
              <p className={cn('text-xs', subText)}>
                {parsing ? 'Leyendo archivo...' : '📊 Arrastra o haz clic para seleccionar el Excel'}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      {allRows && (
        <div className="space-y-3">
          <p className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
            {allRows.length} registros encontrados — primeras filas:
          </p>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
            <table className="text-xs w-full">
              <thead>
                <tr style={{ background: isDark ? '#1f2937' : '#f9fafb' }}>
                  {previewCols.map((col) => (
                    <th key={col} className={cn('px-2 py-1.5 text-left font-semibold border-b', isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600')}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className={isDark ? 'border-gray-700' : 'border-gray-100'} style={{ borderBottom: '1px solid' }}>
                    {previewCols.map((col) => (
                      <td key={col} className={cn('px-2 py-1 truncate max-w-[120px]', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importing ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                <span>Importando...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? '#374151' : '#e5e7eb' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAllRows(null)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                  isDark ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-300 text-gray-500 hover:bg-gray-100'
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="text-xs px-4 py-1.5 rounded-lg font-semibold text-white transition-colors"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Confirmar importación ({allRows.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Report */}
      {report && (
        <div className={cn('rounded-lg p-3 space-y-1.5 text-xs border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
          <div className="flex gap-4">
            <span className="text-green-500 font-medium">✅ Creados: {report.created}</span>
            <span className="text-blue-500 font-medium">🔄 Actualizados: {report.updated}</span>
            {report.errors?.length > 0 && (
              <span className="text-red-500 font-medium">❌ Errores: {report.errors.length}</span>
            )}
          </div>
          {report.errors?.length > 0 && (
            <div className="space-y-0.5 max-h-24 overflow-y-auto">
              {report.errors.map((e, i) => (
                <p key={i} className="text-red-400">{e}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => setReport(null)}
            className={cn('text-xs mt-1', subText, 'hover:underline')}
          >
            Cerrar reporte
          </button>
        </div>
      )}
    </div>
  )
}
