import { cn } from '../lib/utils'
import { ImportModule } from './ImportModule'
import {
  importMenus, importSuppliers, importUnits,
  importMaterias, importRecipes, importSubrecipes,
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
    templateColumns: ['ITEM', 'REFERENCIA', 'NOMBRE', 'COSTO', 'UNIDAD_COMPRA', 'UNIDAD_USO', 'CODIGO_PROVEEDOR', 'PROVEEDOR', 'CATEGORIA'],
    templateExample: [
      [1, 'MP-001', 'Pollo entero', 12500, 'kg', 'kg', 'PRV001', 'Distribuidora Central', 'Carnes'],
      [2, 'MP-002', 'Arroz blanco', 2800, 'kg', 'g', 'PRV002', 'Carnes El Campesino', 'Granos'],
    ],
    templateFileName: 'plantilla_materias_primas.xlsx',
    importFn: importMaterias,
  },
  {
    key: 'subrecipes',
    moduleName: '5. Sub-recetas',
    description: 'Importa sub-recetas (bases, salsas, preparaciones previas). Una fila por ingrediente.',
    templateColumns: ['ITEM', 'REFERENCIA', 'NOMBRE_RECETA', 'MENU_CODIGO', 'PRECIO_VENTA', 'ITEM_MP', 'REFERENCIA_MP', 'NOMBRE_MP', 'CANTIDAD', 'UNIDAD'],
    templateExample: [
      [1, 'SUB-001', 'Salsa bechamel', '', 0, 1, 'MP-002', 'Mantequilla', 0.1, 'kg'],
      [1, 'SUB-001', 'Salsa bechamel', '', 0, 2, 'MP-003', 'Leche entera', 0.5, 'lt'],
    ],
    templateFileName: 'plantilla_subrecetas.xlsx',
    importFn: importSubrecipes,
  },
  {
    key: 'recipes',
    moduleName: '6. Recetas',
    description: 'Importa recetas completas. Una fila por ingrediente — filas con el mismo ITEM se agrupan en una receta.',
    templateColumns: ['ITEM', 'REFERENCIA', 'NOMBRE_RECETA', 'MENU_CODIGO', 'PRECIO_VENTA', 'ITEM_MP', 'REFERENCIA_MP', 'NOMBRE_MP', 'CANTIDAD', 'UNIDAD'],
    templateExample: [
      [1, 'REC-001', 'Pollo a la plancha', 'MEN02', 28000, 1, 'MP-001', 'Pollo entero', 0.25, 'kg'],
      [1, 'REC-001', 'Pollo a la plancha', 'MEN02', 28000, 2, 'MP-002', 'Arroz blanco', 0.15, 'kg'],
      [2, 'REC-002', 'Pasta carbonara', 'MEN02', 24000, 3, 'MP-004', 'Pasta spaghetti', 0.12, 'kg'],
    ],
    templateFileName: 'plantilla_recetas.xlsx',
    importFn: importRecipes,
  },
]

export function ImportTab({ restaurantId, isDark }) {
  const subText = isDark ? 'text-gray-400' : 'text-gray-500'

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
