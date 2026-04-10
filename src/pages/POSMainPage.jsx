import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
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
import { Badge } from '../components/ui/badge'
import { useToast } from '../components/ui/toast'

// ── Sortable columns hook ──────────────────────────────────────────────────
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

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <span className="opacity-20 ml-1 text-xs">↕</span>
    return sortDir === 'asc'
      ? <ChevronUp className="inline h-3 w-3 ml-1" style={{ color: 'var(--accent)' }} />
      : <ChevronDown className="inline h-3 w-3 ml-1" style={{ color: 'var(--accent)' }} />
  }

  return { sorted, requestSort, sortKey, sortDir, SortIcon }
}

// ── Recipe Card (sortable) ────────────────────────────────────────────────────
function RecipeCard({ recipe, categories, showCosts, isAdmin, isDark, onToggle }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: recipe.id })
  const cat = categories?.find((c) => c.id === recipe?.categoryId)
  const margin = calculateMargin(recipe?.costPerPortion || 0, recipe?.salePrice || 0)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="relative group"
    >
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
        {/* Photo or color strip */}
        {recipe.photoURL ? (
          <img src={recipe.photoURL} alt={recipe.name || ''} className="w-full h-36 object-cover" />
        ) : (
          <div className="w-full h-2" style={{ backgroundColor: 'var(--accent)', opacity: 0.25 }} />
        )}

        <div className="p-3">
          {cat && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 inline-block"
              style={{ background: 'var(--accent)', color: 'white', opacity: 0.85 }}>
              {cat.name}
            </span>
          )}
          {recipe.isSubRecipe && !cat && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 inline-block bg-purple-100 text-purple-700">
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

      {/* Drag handle */}
      {isAdmin && (
        <div {...attributes} {...listeners}
          className={cn('absolute top-2 left-2 p-1 rounded-lg cursor-grab opacity-0 group-hover:opacity-100 transition-opacity', isDark ? 'bg-gray-800 text-gray-500' : 'bg-white/80 text-gray-400')}>
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Status toggle */}
      {isAdmin && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(recipe) }}
          className={cn('absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg', isDark ? 'bg-gray-800' : 'bg-white/80')}
        >
          {recipe.active !== false
            ? <ToggleRight className="h-4 w-4 text-emerald-500" />
            : <ToggleLeft className="h-4 w-4 text-gray-400" />}
        </button>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function POSMainPage() {
  const navigate = useNavigate()
  const { currentRestaurant, theme, showCosts, selectedCategory, globalSearch } = useAppStore()
  const { isAdmin } = useAuth()
  const { error } = useToast()
  const isDark = theme === 'night'

  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [viewMode, setViewMode] = useState('grid')
  const [activeId, setActiveId] = useState(null)

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

  const { sorted: sortedRecipes, requestSort, SortIcon } = useSortableData(recipes)

  const isSubSection = selectedCategory === SUBRECIPES_CATEGORY_ID

  const filtered = useMemo(() => {
    const isSub = (r) => r.isSubRecipe === true || r.type === 'subrecipe'
    return (sortedRecipes || []).filter((r) => {
      // Sub-recetas section: only sub-recipes; other sections: no sub-recipes
      if (isSubSection && !isSub(r)) return false
      if (!isSubSection && isSub(r)) return false
      // Only show active recipes in main view
      if (r.active === false) return false
      // Category filter
      if (!isSubSection && selectedCategory && r.categoryId !== selectedCategory) return false
      // Global search
      const q = (globalSearch || '').toLowerCase()
      if (q) {
        return r.name?.toLowerCase()?.includes(q) ||
          r.code?.toLowerCase()?.includes(q) ||
          (r.ingredients || []).some((i) => i.description?.toLowerCase()?.includes(q))
      }
      return true
    })
  }, [sortedRecipes, selectedCategory, globalSearch, isSubSection])

  const handleToggle = async (recipe) => {
    try {
      await toggleRecipeActive(currentRestaurant.id, recipe.id, !recipe.active)
    } catch { error('Error') }
  }

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = (recipes || []).findIndex((r) => r.id === active.id)
    const newIndex = (recipes || []).findIndex((r) => r.id === over.id)
    const reordered = [...(recipes || [])]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    setRecipes(reordered)
    try { await updateRecipeOrder(currentRestaurant.id, reordered) } catch { error('Error') }
    setActiveId(null)
  }

  const selectedCat = isSubSection
    ? { name: 'Sub-recetas' }
    : (categories || []).find((c) => c.id === selectedCategory)

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
          {/* View toggle */}
          <div className={cn('flex rounded-lg border overflow-hidden', isDark ? 'border-gray-700' : 'border-gray-200')}>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('px-2.5 py-1.5 text-xs transition-colors', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50')}
              style={viewMode === 'grid' ? { backgroundColor: 'var(--accent)' } : {}}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('px-2.5 py-1.5 text-xs transition-colors', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50')}
              style={viewMode === 'list' ? { backgroundColor: 'var(--accent)' } : {}}
            >
              Lista
            </button>
          </div>

          {/* Single context-aware create button — admin only */}
          {isAdmin && selectedCategory !== null && (
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
          {isAdmin && (
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
          <SortableContext items={(filtered || []).map((r) => r.id).filter(Boolean)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filtered.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  categories={categories}
                  showCosts={showCosts}
                  isAdmin={isAdmin}
                  isDark={isDark}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* List view */}
      {filtered.length > 0 && viewMode === 'list' && (
        <div className={cn('rounded-2xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={cn('text-xs uppercase tracking-wider', isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400')}>
                <tr>
                  {[
                    ['name','Nombre'],['code','Código'],['categoryId','Menú'],
                    ...(showCosts ? [['salePrice','Precio'],['costPerPortion','Costo'],['margin','Margen']] : []),
                    ['active','Estado'],['createdAt','Creación'],
                  ].map(([k, label]) => (
                    <th key={k} className="px-4 py-3 text-left cursor-pointer select-none" style={{ ':hover': { color: 'var(--accent)' } }} onClick={() => requestSort(k)}>
                      {label}<SortIcon k={k} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cat = (categories || []).find((c) => c.id === r?.categoryId)
                  const margin = calculateMargin(r?.costPerPortion || 0, r?.salePrice || 0)
                  return (
                    <tr key={r.id} onClick={() => navigate(`/recipes/${r.id}`)}
                      className={cn('border-t cursor-pointer transition-colors', isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.photoURL
                            ? <img src={r.photoURL} className="w-8 h-8 rounded-lg object-cover" alt="" />
                            : <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--accent)', opacity: 0.2 }} />}
                          <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-800')}>{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.code}</td>
                      <td className="px-4 py-3">{cat && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: 0.85 }}>
                          {cat.name}
                        </span>
                      )}</td>
                      {showCosts && <>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--accent)' }}>{formatNumber(r.salePrice)}</td>
                        <td className={cn('px-4 py-3', isDark ? 'text-gray-300' : 'text-gray-700')}>{formatNumber(r.costPerPortion)}</td>
                        <td className={cn('px-4 py-3 font-medium', margin>=60?'text-emerald-500':margin>=40?'text-amber-500':'text-red-500')}>{margin.toFixed(1)}%</td>
                      </>}
                      <td className="px-4 py-3">
                        <Badge variant={r.active!==false ? 'success' : 'secondary'}>
                          {r.active!==false ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td className={cn('px-4 py-3 text-xs', isDark?'text-gray-600':'text-gray-400')}>
                        {r.createdAt?.toDate?.()?.toLocaleDateString('es-ES') || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
