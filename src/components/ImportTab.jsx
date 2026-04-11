import { useState } from 'react'
import { cn } from '../lib/utils'
import { ImportModule } from './ImportModule'
import {
  importMenus, importSuppliers, importUnits,
  importMaterias, importRecipes, importSubrecipes,
  fixRecipeCategoryIds, exportRecipes, fixSubrecipeTypes,
} from '../services/importService'

const ORDER_STEPS = [
  { n: '1️⃣', label: 'Unidades de medida' },
  { n: '2️⃣', label: 'Menús' },
  { n: '3️⃣', label: 'Proveedores' },
  { n: '4️⃣', label: 'Materias Primas' },
  { n: '5️⃣', label: 'Sub-recetas' },
  { n: '6️⃣', label: 'Recetas' },
]

const MODULES = [
  {
    key: 'units',
    moduleName: '1. Unidades de medida',
    description: 'Importa unidades de medida (kg, lt, und, etc.) con su código, abreviación y equivalencia.',
    templateColumns: ['CODIGO', 'MEDIDA', 'DESCRIPCION', 'EQUIVALENCIA'],
    templateExample: [
      ['KG', 'kg', 'Kilogramo', 1],
      ['G', 'g', 'Gramo', 0.001],
      ['LT', 'lt', 'Litro', 1],
      ['ML', 'ml', 'Mililitro', 0.001],
    ],
    templateFileName: 'plantilla_unidades.xlsx',
    importFn: importUnits,
  },
  {
    key: 'menus',
    moduleName: '2. Menús / Categorías',
    description: 'Importa las categorías del menú. El código debe coincidir con MENU_CODIGO en el archivo de recetas.',
    templateColumns: ['CODIGO_MENU', 'NOMBRE_MENU'],
    templateExample: [
      ['MEN01', 'Entradas'],
      ['MEN02', 'Platos Principales'],
      ['MEN03', 'Postres'],
    ],
    templateFileName: 'plantilla_menus.xlsx',
    importFn: importMenus,
  },
  {
    key: 'suppliers',
    moduleName: '3. Proveedores',
    description: 'Importa el catálogo de proveedores con código, nombre y datos de contacto opcionales.',
    templateColumns: ['CODIGO_PROVEEDOR', 'NOMBRE_PROVEEDOR', 'CONTACTO', 'CELULAR', 'DIRECCION'],
    templateExample: [
      ['PRV001', 'Distribuidora Central', 'Juan Pérez', '3001234567', 'Calle 10 # 20-30'],
      ['PRV002', 'Carnes El Campesino', 'María López', '3109876543', ''],
    ],
    templateFileName: 'plantilla_proveedores.xlsx',
    importFn: importSuppliers,
  },
  {
    key: 'materias',
    moduleName: '4. Materias Primas',
    description: 'Importa ingredientes y materias primas. El código MP se genera automáticamente.',
    templateColumns: ['REFERENCIA', 'NOMBRE', 'UNIDAD_USO', 'UNIDAD_COMPRA', 'CANT_PRESENTACION', 'COSTO', 'CODIGO_PROVEEDOR', 'CATEGORIA'],
    templateExample: [
      ['MP1000002', 'ACEITE PARA FREIR', 'ML', 'MILILITROS', 1000, 0, '', 'Aceites'],
      ['MP1000058', 'ARROZ SUSHI', 'G', 'KG', 1000, 5000, '8355533', 'Granos'],
    ],
    templateFileName: 'plantilla_materias_primas.xlsx',
    importFn: importMaterias,
  },
  {
    key: 'subrecipes',
    moduleName: '5. Sub-recetas',
    description: 'Importa sub-recetas (bases, preparaciones previas). Una fila por ingrediente — misma REFERENCIA agrupa la sub-receta. Requiere RENDIMIENTO y UNIDAD_RENDIMIENTO.',
    templateColumns: ['REFERENCIA', 'NOMBRE_RECETA', 'RENDIMIENTO', 'UNIDAD_RENDIMIENTO', 'REFERENCIA_MP', 'NOMBRE_MP', 'CANTIDAD', 'UNIDAD', 'DESPERDICIO', 'PREPARACION'],
    templateExample: [
      ['ONISUB001', 'Arroz Shari', 1000, 'G', 'MP1000001', 'Arroz Shari', 800, 'G', 0, ''],
      ['ONISUB001', 'Arroz Shari', 1000, 'G', 'MP1000002', 'Vinagre de arroz', 50, 'ML', 0, ''],
    ],
    templateFileName: 'plantilla_subrecetas.xlsx',
    importFn: importSubrecipes,
  },
  {
    key: 'recipes',
    moduleName: '6. Recetas',
    description: 'Importa recetas completas. Una fila por ingrediente — misma REFERENCIA agrupa la receta. Requiere CODIGO_MENU que ya exista en Firestore.',
    templateColumns: ['REFERENCIA', 'NOMBRE_RECETA', 'CODIGO_MENU', 'PRECIO_VENTA', 'REFERENCIA_MP', 'NOMBRE_MP', 'CANTIDAD', 'UNIDAD', 'DESPERDICIO', 'PREPARACION'],
    templateExample: [
      ['ONIREC001', 'Nigiri Salmón', 'ONI01', 15000, 'ONISUB001', 'Arroz Shari', 30, 'G', 0, ''],
      ['ONIREC001', 'Nigiri Salmón', 'ONI01', 15000, 'MP1000002', 'Salmón fresco', 20, 'G', 5, ''],
      ['ONIREC002', 'Nigiri Atún', 'ONI01', 15000, 'ONISUB001', 'Arroz Shari', 30, 'G', 0, ''],
    ],
    templateFileName: 'plantilla_recetas.xlsx',
    importFn: importRecipes,
  },
]

export function ImportTab({ restaurantId, isDark }) {
  const subText = isDark ? 'text-gray-400' : 'text-gray-500'
  const [fixing, setFixing] = useState(false)
  const [fixReport, setFixReport] = useState(null)
  const [fixingTypes, setFixingTypes] = useState(false)
  const [fixTypesReport, setFixTypesReport] = useState(null)

  const handleFixTypes = async () => {
    setFixingTypes(true)
    setFixTypesReport(null)
    try {
      const result = await fixSubrecipeTypes(restaurantId)
      setFixTypesReport(result)
    } catch (err) {
      setFixTypesReport({ fixed: 0, skipped: 0, errors: [err.message || 'Error inesperado'] })
    } finally {
      setFixingTypes(false)
    }
  }
  const [exporting, setExporting] = useState(null) // 'recipe' | 'subrecipe' | null

  const handleExport = async (type) => {
    setExporting(type)
    try { await exportRecipes(restaurantId, type) }
    catch (err) { alert('Error al exportar: ' + err.message) }
    finally { setExporting(null) }
  }

  const handleFixCategories = async () => {
    setFixing(true)
    setFixReport(null)
    try {
      const result = await fixRecipeCategoryIds(restaurantId)
      setFixReport(result)
    } catch (err) {
      setFixReport({ fixed: 0, skipped: 0, notFound: 0, errors: [err.message || 'Error inesperado'] })
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Order banner */}
      <div className={cn(
        'rounded-xl border p-4',
        isDark ? 'bg-amber-900/20 border-amber-800/40' : 'bg-amber-50 border-amber-200'
      )}>
        <p className={cn('text-xs font-semibold mb-2', isDark ? 'text-amber-300' : 'text-amber-800')}>
          Orden de importación recomendado
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {ORDER_STEPS.map((s, i) => (
            <span key={i} className={cn('text-xs', isDark ? 'text-amber-400' : 'text-amber-700')}>
              {s.n} {s.label}{i < ORDER_STEPS.length - 1 ? ' →' : ''}
            </span>
          ))}
        </div>
        <p className={cn('text-xs mt-2', isDark ? 'text-amber-500' : 'text-amber-600')}>
          Importa en este orden para que las referencias queden correctamente vinculadas.
        </p>
      </div>

      {/* Recipe export */}
      <div className={cn('rounded-xl border p-4 space-y-3', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
        <div>
          <h3 className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
            Exportar a Excel
          </h3>
          <p className={cn('text-xs mt-0.5', subText)}>Descarga tus recetas y sub-recetas en formato Excel compatible con el importador.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleExport('recipe')}
            disabled={exporting === 'recipe'}
            className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-60', isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-white')}
          >
            {exporting === 'recipe' ? 'Exportando...' : '⬇ Exportar Recetas'}
          </button>
          <button
            onClick={() => handleExport('subrecipe')}
            disabled={exporting === 'subrecipe'}
            className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-60', isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-white')}
          >
            {exporting === 'subrecipe' ? 'Exportando...' : '⬇ Exportar Sub-recetas'}
          </button>
        </div>
      </div>

      {/* Migration tool */}
      <div className={cn('rounded-xl border p-4 space-y-3', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
        <div>
          <h3 className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
            🔧 Corregir vínculos de categorías
          </h3>
          <p className={cn('text-xs mt-0.5', subText)}>
            Si las recetas importadas no aparecen en sus menús, usa esta herramienta para vincular correctamente los categoryId.
          </p>
        </div>
        <button
          onClick={handleFixCategories}
          disabled={fixing}
          className={cn(
            'text-xs px-4 py-2 rounded-lg font-semibold text-white transition-colors disabled:opacity-60',
          )}
          style={{ backgroundColor: '#10b981' }}
        >
          {fixing ? 'Procesando...' : '🔧 Corregir vínculos de categorías'}
        </button>
        <button
          onClick={handleFixTypes}
          disabled={fixingTypes}
          className={cn(
            'text-xs px-4 py-2 rounded-lg font-semibold text-white transition-colors disabled:opacity-60',
          )}
          style={{ backgroundColor: '#6366f1' }}
        >
          {fixingTypes ? 'Procesando...' : '🔧 Corregir tipos de sub-recetas'}
        </button>
        {fixTypesReport && (
          <div className={cn('rounded-lg p-3 text-xs space-y-1 border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
            <div className="flex gap-4">
              <span className="text-green-500 font-medium">✅ Corregidas: {fixTypesReport.fixed}</span>
              <span className="text-blue-500 font-medium">⏭ Omitidas: {fixTypesReport.skipped}</span>
            </div>
            <button onClick={() => setFixTypesReport(null)} className={cn('text-xs hover:underline mt-1', subText)}>Cerrar</button>
          </div>
        )}

        {fixReport && (
          <div className={cn('rounded-lg p-3 text-xs space-y-1 border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
            <div className="flex gap-4">
              <span className="text-green-500 font-medium">✅ Corregidas: {fixReport.fixed}</span>
              <span className="text-blue-500 font-medium">⏭ Omitidas: {fixReport.skipped}</span>
              {fixReport.notFound > 0 && <span className="text-red-500 font-medium">❌ Sin categoría: {fixReport.notFound}</span>}
            </div>
            {fixReport.errors?.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-0.5 mt-1">
                {fixReport.errors.map((e, i) => <p key={i} className="text-red-400">{e}</p>)}
              </div>
            )}
            <button onClick={() => setFixReport(null)} className={cn('text-xs hover:underline mt-1', subText)}>
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Modules */}
      <div className="grid grid-cols-1 gap-4">
        {MODULES.map((mod) => (
          <ImportModule
            key={mod.key}
            moduleName={mod.moduleName}
            description={mod.description}
            templateColumns={mod.templateColumns}
            templateExample={mod.templateExample}
            templateFileName={mod.templateFileName}
            onImport={(rows, onProgress) => mod.importFn(restaurantId, rows, onProgress)}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  )
}
