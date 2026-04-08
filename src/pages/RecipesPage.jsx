import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Filter, BookOpen, Grid, List, ToggleLeft, ToggleRight, GripVertical, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  subscribeRecipes, subscribeCategories, toggleRecipeActive,
  updateRecipeOrder, createRecipe, updateRecipe,
} from '../services/restaurants'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useToast } from '../components/ui/toast'
import { cn, formatCurrency, calculateMargin } from '../lib/utils'

function SortableRecipeCard({ recipe, categories, showCosts, isAdmin, isDark, onToggle }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: recipe.id })

  const category = categories.find((c) => c.id === recipe.categoryId)
  const margin = calculateMargin(recipe.costPerPortion || 0, recipe.salePrice || 0)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <Card
        className={cn(
          'overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer',
          !recipe.active && 'opacity-60',
          isDark && 'bg-gray-900 border-gray-800 hover:border-gold-700'
        )}
      >
        {/* Drag handle */}
        {isAdmin && (
          <div
            {...attributes}
            {...listeners}
            className={cn(
              'absolute top-2 right-2 z-10 p-1 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-opacity',
              isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'
            )}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        <div onClick={() => navigate(`/recipes/${recipe.id}`)}>
          {/* Photo */}
          {recipe.photoURL ? (
            <img
              src={recipe.photoURL}
              alt={recipe.name}
              className="w-full h-40 object-cover"
            />
          ) : (
            <div className={cn(
              'w-full h-40 flex items-center justify-center',
              isDark ? 'bg-gray-800' : 'bg-gradient-to-br from-amber-50 to-yellow-50'
            )}>
              <BookOpen className={cn('h-10 w-10', isDark ? 'text-gray-700' : 'text-amber-200')} />
            </div>
          )}

          <CardContent className="p-4">
            {/* Category badge */}
            {category && (
              <div className="mb-2">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: (category.color || '#d97706') + '20', color: category.color || '#d97706' }}
                >
                  {category.name}
                </span>
              </div>
            )}

            <h3 className={cn('font-display font-semibold text-sm leading-tight line-clamp-2', isDark ? 'text-white' : 'text-gray-900')}>
              {recipe.name}
            </h3>

            {recipe.code && (
              <p className={cn('text-xs font-mono mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                #{recipe.code}
              </p>
            )}

            <div className={cn('flex items-center gap-1 mt-2 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              <span>{recipe.portions} porciones</span>
              {recipe.isSubRecipe && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">Sub-receta</Badge>
              )}
            </div>

            {showCosts && (
              <div className={cn('mt-3 pt-3 border-t grid grid-cols-3 gap-2', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Costo</p>
                  <p className={cn('text-xs font-semibold', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    {formatCurrency(recipe.costPerPortion)}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Precio</p>
                  <p className={cn('text-xs font-semibold text-gold-600')}>
                    {formatCurrency(recipe.salePrice)}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Margen</p>
                  <p className={cn('text-xs font-semibold', margin >= 60 ? 'text-emerald-500' : margin >= 40 ? 'text-amber-500' : 'text-red-500')}>
                    {margin.toFixed(0)}%
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </div>

        {/* Status toggle (admin only) */}
        {isAdmin && (
          <button
            className={cn(
              'absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg',
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            )}
            onClick={(e) => { e.stopPropagation(); onToggle(recipe) }}
            title={recipe.active ? 'Desactivar' : 'Activar'}
          >
            {recipe.active !== false
              ? <ToggleRight className="h-5 w-5 text-emerald-500" />
              : <ToggleLeft className={cn('h-5 w-5', isDark ? 'text-gray-600' : 'text-gray-400')} />}
          </button>
        )}
      </Card>
    </div>
  )
}

export default function RecipesPage() {
  const { t } = useTranslation()
  const { currentRestaurant, theme, globalSearch, showCosts } = useAppStore()
  const { isAdmin } = useAuth()
  const { success, error } = useToast()
  const isDark = theme === 'night'

  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState(globalSearch || '')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterActive, setFilterActive] = useState('all')
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

  useEffect(() => { setSearch(globalSearch || '') }, [globalSearch])

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      const q = search.toLowerCase()
      const matchSearch = !q || r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q) ||
        r.ingredients?.some((i) => i.description?.toLowerCase().includes(q))
      const matchCat = filterCategory === 'all' || r.categoryId === filterCategory
      const matchActive = filterActive === 'all' ||
        (filterActive === 'active' && r.active !== false) ||
        (filterActive === 'inactive' && r.active === false)
      return matchSearch && matchCat && matchActive
    })
  }, [recipes, search, filterCategory, filterActive])

  const handleToggle = async (recipe) => {
    try {
      await toggleRecipeActive(currentRestaurant.id, recipe.id, !recipe.active)
      success(t('common.success'))
    } catch {
      error(t('common.error'))
    }
  }

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = recipes.findIndex((r) => r.id === active.id)
    const newIndex = recipes.findIndex((r) => r.id === over.id)
    const reordered = [...recipes]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    setRecipes(reordered)
    try {
      await updateRecipeOrder(currentRestaurant.id, reordered)
    } catch {
      error(t('common.error'))
    }
    setActiveId(null)
  }

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws)
        const created = []
        const updated = []
        for (const row of rows) {
          const code = (row.codigo || row.code || '').toString().trim()
          const name = row.nombre || row.name || ''
          const existing = code
            ? await getDocs(query(collection(db, 'restaurants', currentRestaurant.id, 'recipes'), where('code', '==', code)))
            : { docs: [] }
          if (existing.docs.length > 0) {
            await updateRecipe(currentRestaurant.id, existing.docs[0].id, { name, code })
            updated.push({ code, name })
          } else {
            await createRecipe(currentRestaurant.id, { name, code, categoryId: '', ingredients: [] })
            created.push({ code, name })
          }
        }
        success(t('common.success'), `${created.length} creadas, ${updated.length} actualizadas`)
        const toRows = (arr) => arr.map((r) => `<tr><td>${r.code || '—'}</td><td>${r.name}</td></tr>`).join('')
        const html = `<html><head><title>Importación recetas</title>
          <style>body{font-family:sans-serif;padding:24px}h2{margin-bottom:4px}table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f5f5f5}h3{margin-top:20px;margin-bottom:4px}</style>
          </head><body>
          <h2>Resumen de importación</h2><p style="color:#666;font-size:13px">${new Date().toLocaleString('es-ES')}</p>
          <h3>✅ Creadas (${created.length})</h3>
          <table><tr><th>Código</th><th>Nombre</th></tr>${toRows(created)}</table>
          <h3>🔄 Actualizadas (${updated.length})</h3>
          <table><tr><th>Código</th><th>Nombre</th></tr>${toRows(updated)}</table>
          <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800)}<\/script>
          </body></html>`
        const win = window.open('', '_blank', 'width=700,height=600')
        if (win) { win.document.write(html); win.document.close() }
      } catch {
        error(t('common.error'))
      }
      e.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }, [currentRestaurant?.id])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {t('recipes.title')}
          </h1>
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {filtered.length} de {recipes.length} recetas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <label>
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4" /> {t('recipes.importFromExcel')}
                </span>
              </Button>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </label>
          )}
          <Link to="/recipes/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> {t('recipes.newRecipe')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('recipes.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('common.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')} categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="active">{t('common.active')}</SelectItem>
            <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
          </SelectContent>
        </Select>
        <div className={cn('flex rounded-lg border overflow-hidden', isDark ? 'border-gray-700' : 'border-gray-200')}>
          <button
            onClick={() => setViewMode('grid')}
            className={cn('px-3 py-2 transition-colors', viewMode === 'grid' ? 'bg-gold-600 text-white' : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50')}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('px-3 py-2 transition-colors', viewMode === 'list' ? 'bg-gold-600 text-white' : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50')}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category quick filters */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              filterCategory === 'all'
                ? 'bg-gold-600 text-white border-gold-600'
                : isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            )}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                filterCategory === cat.id
                  ? 'text-white border-transparent'
                  : isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
              style={filterCategory === cat.id ? { background: cat.color || '#d97706', borderColor: cat.color } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid/List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className={cn('h-12 w-12 mx-auto mb-3', isDark ? 'text-gray-700' : 'text-gray-200')} />
          <p className={cn('text-sm mb-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {search ? t('common.noResults') : t('recipes.noRecipes')}
          </p>
          <Link to="/recipes/new">
            <Button>
              <Plus className="h-4 w-4" /> {t('recipes.newRecipe')}
            </Button>
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filtered.map((r) => r.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((recipe) => (
                <SortableRecipeCard
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
      ) : (
        // List view
        <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn('border-b text-xs uppercase tracking-wider', isDark ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400')}>
                  <th className="text-left px-6 py-3">Receta</th>
                  <th className="text-left px-6 py-3">Categoría</th>
                  <th className="text-left px-6 py-3">Porciones</th>
                  {showCosts && <th className="text-right px-6 py-3">Costo</th>}
                  {showCosts && <th className="text-right px-6 py-3">Precio</th>}
                  {showCosts && <th className="text-right px-6 py-3">Margen</th>}
                  <th className="text-center px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((recipe) => {
                  const cat = categories.find((c) => c.id === recipe.categoryId)
                  const margin = calculateMargin(recipe.costPerPortion || 0, recipe.salePrice || 0)
                  return (
                    <tr
                      key={recipe.id}
                      className={cn(
                        'border-b last:border-0 transition-colors cursor-pointer',
                        isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-50 hover:bg-gray-50'
                      )}
                      onClick={() => window.location.href = `/recipes/${recipe.id}`}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {recipe.photoURL
                            ? <img src={recipe.photoURL} className="w-8 h-8 rounded-lg object-cover" alt="" />
                            : <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isDark ? 'bg-gray-800' : 'bg-gold-50')}>
                                <BookOpen className="h-4 w-4 text-gold-500" />
                              </div>
                          }
                          <div>
                            <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-800')}>{recipe.name}</p>
                            {recipe.code && <p className={cn('text-xs font-mono', isDark ? 'text-gray-600' : 'text-gray-400')}>#{recipe.code}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {cat && <Badge variant="secondary" style={{ background: (cat.color || '#d97706') + '20', color: cat.color || '#d97706' }}>{cat.name}</Badge>}
                      </td>
                      <td className={cn('px-6 py-3', isDark ? 'text-gray-400' : 'text-gray-500')}>{recipe.portions}</td>
                      {showCosts && <td className={cn('px-6 py-3 text-right', isDark ? 'text-gray-300' : 'text-gray-700')}>{formatCurrency(recipe.costPerPortion)}</td>}
                      {showCosts && <td className="px-6 py-3 text-right text-gold-600 font-medium">{formatCurrency(recipe.salePrice)}</td>}
                      {showCosts && (
                        <td className={cn('px-6 py-3 text-right font-medium', margin >= 60 ? 'text-emerald-500' : margin >= 40 ? 'text-amber-500' : 'text-red-500')}>
                          {margin.toFixed(1)}%
                        </td>
                      )}
                      <td className="px-6 py-3 text-center">
                        <Badge variant={recipe.active !== false ? 'success' : 'secondary'}>
                          {recipe.active !== false ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
