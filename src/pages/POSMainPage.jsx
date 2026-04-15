import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ToggleLeft, ToggleRight, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import {
  subscribeRecipes, subscribeCategories, toggleRecipeActive, updateRecipeOrder,
} from '../services/restaurants'
import { SUBRECIPES_CATEGORY_ID } from '../components/layout/POSLayout'
import { cn, formatNumber, calculateMargin } from '../lib/utils'
import { useToast } from '../components/ui/toast'

// ── Sortable data hook ─────────────────────────────────────────────────────────
function useSortableData(data) {
  const [sortKey, setSortKey] = useState('order')
  const [sortDir, setSortDir] = useState('asc')

  const requestSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => [...(data || [])].sort((a, b) => {
    if (sortKey === 'order') return (a.order || 0) - (b.order || 0)
    const aV = a[sortKey] ?? ''
    const bV = b[sortKey] ?? ''
    const cmp = typeof aV === 'number' && typeof bV === 'number' ? aV - bV : String(aV).localeCompare(String(bV))
    return sortDir === 'asc' ? cmp : -cmp
  }), [data, sortKey, sortDir])

  return { sorted, requestSort, sortKey, sortDir }
}

// ── Column defaults ────────────────────────────────────────────────────────────
const MENU_DEFAULT_COLS = [
  { id: 'foto',         label: 'Foto',         visible: true, sortable: false },
  { id: 'codigo',       label: 'Código',        visible: true, sortable: true  },
  { id: 'nombre',       label: 'Nombre',        visible: true, sortable: true  },
  { id: 'costo',        label: 'Costo',         visible: true, sortable: true  },
  { id: 'precio',       label: 'Precio',        visible: true, sortable: true  },
  { id: 'margen',       label: 'Margen %',      visible: true, sortable: true  },
  { id: 'creacion',     label: 'Creación',      visible: true, sortable: true  },
  { id: 'verificacion', label: 'Verificación',  visible: true, sortable: true  },
]

const SUB_DEFAULT_COLS = [
  { id: 'foto',         label: 'Foto',          visible: true, sortable: false },
  { id: 'codigo',       label: 'Código',         visible: true, sortable: true  },
  { id: 'nombre',       label: 'Nombre',         visible: true, sortable: true  },
  { id: 'rendimiento',  label: 'Rendimiento',    visible: true, sortable: true  },
  { id: 'costo',        label: 'Costo',          visible: true, sortable: true  },
  { id: 'creacion',     label: 'Creación',       visible: true, sortable: true  },
  { id: 'verificacion', label: 'Verificación',   visible: true, sortable: true  },
]

const MENU_FIELD_MAP = { codigo: 'code', nombre: 'name', costo: 'costPerPortion', precio: 'salePrice', margen: 'salePrice', creacion: 'createdAt', verificacion: 'verified' }
const SUB_FIELD_MAP  = { codigo: 'code', nombre: 'name', rendimiento: 'yieldAmount', costo: 'costPerPortion', creacion: 'createdAt', verificacion: 'verified' }

function loadCols(key, defaults) {
  try {
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved)
      const merged = parsed
        .filter(c => defaults.find(d => d.id === c.id))
        .map(c => ({ ...defaults.find(d => d.id === c.id), visible: c.visible }))
      defaults.forEach(d => { if (!merged.find(c => c.id === d.id)) merged.push(d) })
      return merged
    }
  } catch {}
  return defaults
}

// ── Recipe Card (grid) ─────────────────────────────────────────────────────────
function RecipeCard({ recipe, categories, showCosts, canEdit, isDark, onToggle }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: recipe.id })
  const cat = categories?.find((c) => c.id === recipe?.categoryId)
  const margin = calculateMargin(recipe?.costPerPortion || 0, recipe?.salePrice || 0)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="relative group"
      style={{ position: 'relative' }}
    >
      {/* Verificación badge */}
      {recipe.verified && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.30)',
          borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', color: 'var(--green)', fontWeight: 700,
        }}>✓</div>
      )}

      <div
        onClick={() => navigate(`/recipes/${recipe.id}`)}
        className={cn(
          'rounded-2xl overflow-hidden cursor-pointer transition-all duration-200',
          'hover:shadow-lg hover:-translate-y-0.5',
          !recipe.active && 'opacity-50',
          isDark ? 'bg-gray-900 border border-gray-800 hover:border-gray-600' : 'bg-white border border-gray-100 shadow-sm hover:shadow-md'
        )}
        style={isDark ? {} : { borderTopColor: 'var(--accent)', borderTopWidth: 2 }}
      >
        {recipe.photoURL
          ? <img src={recipe.photoURL} alt={recipe.name || ''} className="w-full h-36 object-cover" />
          : <div className="w-full h-2" style={{ backgroundColor: 'var(--accent)', opacity: 0.25 }} />
        }
        <div className="p-3">
          {cat && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 inline-block"
              style={{ background: 'var(--accent)', color: 'white', opacity: 0.85 }}>
              {cat.name}
            </span>
          )}
          {recipe.isSubRecipe && !cat && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 inline-block"
              style={{ background: 'var(--goldBg)', color: 'var(--accent)' }}>
              Sub-receta
            </span>
          )}
          <h3 className={cn('font-display font-semibold text-sm leading-tight line-clamp-2', isDark ? 'text-white' : 'text-gray-900')}>
            {recipe.name}
          </h3>
          {recipe.code && (
            <p className={cn('text-xs font-mono mt-0.5', isDark ? 'text-gray-600' : 'text-gray-400')}>#{recipe.code}</p>
          )}
          {showCosts && (recipe.salePrice || 0) > 0 && (
            <div className={cn('flex items-center justify-between mt-2 pt-2 border-t text-xs', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>{formatNumber(recipe.salePrice)}</span>
              <span className={cn('font-medium', margin >= 60 ? 'text-emerald-500' : margin >= 40 ? 'text-amber-500' : 'text-red-500')}>
                {margin.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>
      {canEdit && (
        <div {...attributes} {...listeners}
          className={cn('absolute top-2 left-2 p-1 rounded-lg cursor-grab opacity-0 group-hover:opacity-100 transition-opacity',
            isDark ? 'bg-gray-800 text-gray-500' : 'bg-white/80 text-gray-400')}>
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  )
}

// ── renderCell helper ──────────────────────────────────────────────────────────
function renderCell(colId, recipe) {
  switch (colId) {
    case 'foto':
      return (
        <td key={colId} style={{ padding: '8px 12px' }}>
          {recipe.photoURL
            ? <img src={recipe.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
            : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🍽</div>
          }
        </td>
      )
    case 'codigo':
      return (
        <td key={colId} style={{ padding: '8px 12px' }}>
          <span style={{ background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.72rem', padding: '3px 10px', borderRadius: 6, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            {recipe.code || '—'}
          </span>
        </td>
      )
    case 'nombre':
      return (
        <td key={colId} style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recipe.name}
        </td>
      )
    case 'costo':
      return (
        <td key={colId} style={{ padding: '8px 12px', color: 'var(--t2)', fontSize: '0.84rem' }}>
          {recipe.costPerPortion ? `$${Number(recipe.costPerPortion).toLocaleString('es-CO')}` : '—'}
        </td>
      )
    case 'precio':
      return (
        <td key={colId} style={{ padding: '8px 12px', color: 'var(--accent)', fontWeight: 600, fontSize: '0.84rem' }}>
          {recipe.salePrice ? `$${Number(recipe.salePrice).toLocaleString('es-CO')}` : '—'}
        </td>
      )
    case 'margen': {
      const costo = recipe.costPerPortion || 0
      const precio = recipe.salePrice || 0
      const margen = precio > 0 ? (((precio - costo) / precio) * 100).toFixed(1) : null
      return (
        <td key={colId} style={{ padding: '8px 12px' }}>
          {margen !== null
            ? <span style={{ fontSize: '0.82rem', fontWeight: 600, color: margen >= 60 ? 'var(--green)' : margen >= 40 ? 'var(--orange)' : 'var(--red)' }}>{margen}%</span>
            : <span style={{ color: 'var(--t3)' }}>—</span>}
        </td>
      )
    }
    case 'rendimiento':
      return (
        <td key={colId} style={{ padding: '8px 12px', color: 'var(--t2)', fontSize: '0.84rem' }}>
          {recipe.yieldAmount ? `${recipe.yieldAmount} ${recipe.yieldUnit || ''}` : '—'}
        </td>
      )
    case 'creacion':
      return (
        <td key={colId} style={{ padding: '8px 12px', color: 'var(--t3)', fontSize: '0.78rem' }}>
          {recipe.createdAt?.toDate?.()?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'}
        </td>
      )
    case 'verificacion':
      return (
        <td key={colId} style={{ padding: '8px 12px' }}>
          {recipe.verified
            ? <span style={{ color: 'var(--green)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                ✓ {recipe.verifiedAt?.toDate?.()?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              </span>
            : <span style={{ color: 'var(--t3)', fontSize: '0.78rem' }}>Sin verificar</span>}
        </td>
      )
    default:
      return <td key={colId} />
  }
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function POSMainPage() {
  const navigate = useNavigate()
  const { currentRestaurant, theme, showCosts, selectedCategory, globalSearch } = useAppStore()
  const { isAdmin, canEdit } = useAuth()
  const { error } = useToast()
  const isDark = theme === 'night'

  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('pos-main-view-mode') || 'grid')
  const [activeId, setActiveId] = useState(null)

  const [menuColumns, setMenuColumns] = useState(() => loadCols('menu-columns-order', MENU_DEFAULT_COLS))
  const [subColumns,  setSubColumns]  = useState(() => loadCols('subrecipe-columns-order', SUB_DEFAULT_COLS))
  const [dragCol,  setDragCol]  = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!currentRestaurant?.id) return
    const u1 = subscribeRecipes(currentRestaurant.id, setRecipes)
    const u2 = subscribeCategories(currentRestaurant.id, setCategories)
    return () => { u1(); u2() }
  }, [currentRestaurant?.id])

  const { sorted: sortedRecipes, requestSort, sortKey, sortDir } = useSortableData(recipes)

  const isSubSection = selectedCategory === SUBRECIPES_CATEGORY_ID

  const filtered = useMemo(() => {
    const isSub = (r) => r.isSubRecipe === true || r.type === 'subrecipe'
    return (sortedRecipes || []).filter((r) => {
      if (isSubSection && !isSub(r)) return false
      if (!isSubSection && isSub(r)) return false
      if (r.active === false) return false
      if (!isSubSection && selectedCategory && r.categoryId !== selectedCategory) return false
      const q = (globalSearch || '').toLowerCase()
      if (q) return r.name?.toLowerCase()?.includes(q) || r.code?.toLowerCase()?.includes(q) || (r.ingredients || []).some(i => i.description?.toLowerCase()?.includes(q))
      return true
    })
  }, [sortedRecipes, selectedCategory, globalSearch, isSubSection])

  const handleToggle = async (recipe) => {
    try { await toggleRecipeActive(currentRestaurant.id, recipe.id, !recipe.active) }
    catch { error('Error') }
  }

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = (recipes || []).findIndex(r => r.id === active.id)
    const newIndex = (recipes || []).findIndex(r => r.id === over.id)
    const reordered = [...(recipes || [])]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    setRecipes(reordered)
    try { await updateRecipeOrder(currentRestaurant.id, reordered) } catch { error('Error') }
    setActiveId(null)
  }

  const reorderCols = (setter, storageKey, fromId, toId) => {
    if (!fromId || fromId === toId) return
    setter(prev => {
      const cols = [...prev]
      const fi = cols.findIndex(c => c.id === fromId)
      const ti = cols.findIndex(c => c.id === toId)
      if (fi < 0 || ti < 0) return prev
      const [removed] = cols.splice(fi, 1)
      cols.splice(ti, 0, removed)
      localStorage.setItem(storageKey, JSON.stringify(cols))
      return cols
    })
  }

  const selectedCat = isSubSection
    ? { name: 'Sub-recetas' }
    : (categories || []).find(c => c.id === selectedCategory)

  // Decide which column set to use for list view
  const activeCols      = isSubSection ? subColumns    : menuColumns
  const setActiveCols   = isSubSection ? setSubColumns : setMenuColumns
  const activeStorageKey = isSubSection ? 'subrecipe-columns-order' : 'menu-columns-order'
  const activeFieldMap  = isSubSection ? SUB_FIELD_MAP : MENU_FIELD_MAP

  const thBase = {
    padding: '9px 12px', textAlign: 'left', fontSize: '0.68rem',
    textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)',
    fontWeight: 700, background: 'var(--bg3)', borderBottom: '1px solid var(--b1)',
    whiteSpace: 'nowrap', userSelect: 'none',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('font-display text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {selectedCat ? selectedCat.name : 'Recetas'}
          </h1>
          <p className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {filtered.length} receta{filtered.length !== 1 ? 's' : ''}
            {globalSearch ? ` · "${globalSearch}"` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('flex rounded-lg border overflow-hidden', isDark ? 'border-gray-700' : 'border-gray-200')}>
            <button
              onClick={() => { setViewMode('grid'); localStorage.setItem('pos-main-view-mode', 'grid') }}
              className={cn('px-2.5 py-1.5 text-xs transition-colors', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50')}
              style={viewMode === 'grid' ? { backgroundColor: 'var(--accent)' } : {}}
            >Grid</button>
            <button
              onClick={() => { setViewMode('list'); localStorage.setItem('pos-main-view-mode', 'list') }}
              className={cn('px-2.5 py-1.5 text-xs transition-colors', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50')}
              style={viewMode === 'list' ? { backgroundColor: 'var(--accent)' } : {}}
            >Lista</button>
          </div>
          {canEdit && selectedCategory !== null && (
            <button
              onClick={() => navigate(isSubSection ? '/recipes/new?type=subrecipe' : '/recipes/new')}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-sm font-medium transition-all"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="h-4 w-4" />
              {isSubSection ? 'Nueva sub-receta' : 'Nueva receta'}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">{isSubSection ? '🧪' : '🍽️'}</div>
          <p className={cn('text-base font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {globalSearch ? 'Sin resultados para tu búsqueda' : 'No hay recetas aún'}
          </p>
          {canEdit && (
            <button
              onClick={() => navigate(isSubSection ? '/recipes/new?type=subrecipe' : '/recipes/new')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="h-4 w-4" /> Crear primera receta
            </button>
          )}
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && viewMode === 'grid' && (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(r => r.id).filter(Boolean)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filtered.map(recipe => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  categories={categories}
                  showCosts={showCosts}
                  isAdmin={isAdmin}
                  canEdit={canEdit}
                  isDark={isDark}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* List view — columnas reordenables */}
      {filtered.length > 0 && viewMode === 'list' && (
        <div style={{ borderRadius: 12, border: '1px solid var(--b1)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr>
                  {activeCols.filter(c => c.visible).map(col => (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={() => setDragCol(col.id)}
                      onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                      onDrop={() => { reorderCols(setActiveCols, activeStorageKey, dragCol, col.id); setDragCol(null); setDragOver(null) }}
                      onDragEnd={() => { setDragCol(null); setDragOver(null) }}
                      onClick={() => col.sortable && requestSort(activeFieldMap[col.id] || col.id)}
                      style={{
                        ...thBase,
                        cursor: col.sortable ? 'pointer' : 'grab',
                        background: dragOver === col.id ? (isDark ? '#374151' : '#e9ecef') : 'var(--bg3)',
                        borderLeft: dragOver === col.id ? '2px solid var(--accent)' : undefined,
                      }}
                    >
                      {col.label}
                      {col.sortable && sortKey === (activeFieldMap[col.id] || col.id) && (
                        <span style={{ marginLeft: 4, color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                      {col.sortable && sortKey !== (activeFieldMap[col.id] || col.id) && (
                        <span style={{ marginLeft: 4, color: 'var(--t3)', opacity: 0.5 }}>⇅</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid var(--b1)', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => navigate(`/recipes/${r.id}`)}
                  >
                    {activeCols.filter(c => c.visible).map(col => renderCell(col.id, r))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
