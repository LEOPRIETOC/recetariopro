import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Filter, BookOpen, LayoutGrid, List as ListIcon, ToggleLeft, ToggleRight, GripVertical, Upload } from 'lucide-react'
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

function SortableRecipeCard({ recipe, categories, canSeeCosts, isAdmin, canEdit, isDark, onToggle }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: recipe.id })

  const category = categories.find((c) => c.id === recipe.categoryId)

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
        {canEdit && (
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

            {canSeeCosts && (
              <div style={{
                display:'flex',
                justifyContent:'space-between',
                marginTop:8,
                paddingTop:8,
                borderTop:'1px solid var(--b1)'
              }}>
                <div>
                  <div style={{fontSize:'0.6rem',color:'var(--t3)'}}>Costo</div>
                  <div style={{fontSize:'0.8rem',fontWeight:600,color:'var(--t2)'}}>
                    {recipe.totalCost
                      ? `$${Number(recipe.totalCost).toLocaleString('es-CO')}`
                      : '—'}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'0.6rem',color:'var(--t3)'}}>Precio</div>
                  <div style={{fontSize:'0.8rem',fontWeight:600,color:'var(--accent)'}}>
                    {recipe.sellingPrice
                      ? `$${Number(recipe.sellingPrice).toLocaleString('es-CO')}`
                      : '—'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </div>

        {/* Status toggle (admin only) */}
        {canEdit && (
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
  const { currentRestaurant, theme, globalSearch } = useAppStore()
  const { isAdmin, canEdit, canSeeCosts } = useAuth()
  const { success, error } = useToast()
  const isDark = theme === 'night'

  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState(globalSearch || '')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterActive, setFilterActive] = useState('all')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('pos-view-mode') || 'grid')
  const [activeId, setActiveId] = useState(null)

  // ── Columnas reordenables (vista lista) ──────────────────────────────────
  const DEFAULT_LIST_COLUMNS = [
    { id: 'foto',         label: 'Foto',       visible: true, sortable: false },
    { id: 'codigo',       label: 'Código',     visible: true, sortable: true  },
    { id: 'nombre',       label: 'Nombre',     visible: true, sortable: true  },
    { id: 'costo',        label: 'Costo',      visible: true, sortable: true  },
    { id: 'precio',       label: 'Precio',     visible: true, sortable: true  },
    { id: 'margen',       label: 'Margen',     visible: true, sortable: true  },
    { id: 'creacion',     label: 'Creación',   visible: true, sortable: true  },
    { id: 'verificacion', label: 'Verificado', visible: true, sortable: true  },
  ]
  const [listColumns, setListColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('pos-columns-order')
      if (saved) {
        const parsed = JSON.parse(saved)
        const merged = parsed
          .filter(c => DEFAULT_LIST_COLUMNS.find(d => d.id === c.id))
          .map(c => ({ ...DEFAULT_LIST_COLUMNS.find(d => d.id === c.id), visible: c.visible }))
        DEFAULT_LIST_COLUMNS.forEach(d => { if (!merged.find(c => c.id === d.id)) merged.push(d) })
        return merged
      }
    } catch {}
    return DEFAULT_LIST_COLUMNS
  })
  const [dragCol, setDragCol] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [sortField, setSortField] = useState('nombre')
  const [sortDir, setSortDir] = useState('asc')

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

  const reorderListColumns = (fromId, toId) => {
    setListColumns(prev => {
      const cols = [...prev]
      const fromIdx = cols.findIndex(c => c.id === fromId)
      const toIdx = cols.findIndex(c => c.id === toId)
      const [moved] = cols.splice(fromIdx, 1)
      cols.splice(toIdx, 0, moved)
      localStorage.setItem('pos-columns-order', JSON.stringify(cols))
      return cols
    })
  }

  const toggleListSort = (colId) => {
    if (sortField === colId) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(colId); setSortDir('asc') }
  }

  const sortedFiltered = [...filtered].sort((a, b) => {
    let va, vb
    switch (sortField) {
      case 'codigo':       va = a.code || '';                              vb = b.code || '';                              break
      case 'costo':        va = a.totalCost ?? 0;                          vb = b.totalCost ?? 0;                          break
      case 'precio':       va = a.sellingPrice ?? 0;                       vb = b.sellingPrice ?? 0;                       break
      case 'margen':       va = calculateMargin(a.totalCost || 0, a.sellingPrice || 0); vb = calculateMargin(b.totalCost || 0, b.sellingPrice || 0); break
      case 'creacion':     va = a.createdAt?.toMillis?.() ?? 0;            vb = b.createdAt?.toMillis?.() ?? 0;            break
      case 'verificacion': va = a.verified ? 1 : 0;                        vb = b.verified ? 1 : 0;                        break
      default:             va = a.name || '';                               vb = b.name || ''
    }
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const renderListCell = (colId, recipe, cat) => {
    switch (colId) {
      case 'foto':
        return (
          <td key={colId} className="px-4 py-2.5">
            {recipe.photoURL
              ? <img src={recipe.photoURL} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              : <div className={cn('flex items-center justify-center rounded-lg', isDark ? 'bg-gray-800' : 'bg-amber-50')} style={{ width: 36, height: 36 }}>
                  <BookOpen className="h-4 w-4 text-amber-400" />
                </div>
            }
          </td>
        )
      case 'codigo':
        return <td key={colId} className={cn('px-4 py-2.5 font-mono text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{recipe.code ? `#${recipe.code}` : '—'}</td>
      case 'nombre':
        return (
          <td key={colId} className={cn('px-4 py-2.5 font-medium', isDark ? 'text-white' : 'text-gray-800')}>
            <div className="max-w-xs truncate">{recipe.name}</div>
            {cat && <div className="text-xs mt-0.5" style={{ color: cat.color || '#d97706' }}>{cat.name}</div>}
          </td>
        )
      case 'costo':
        return <td key={colId} className={cn('px-4 py-2.5 text-xs', isDark ? 'text-gray-300' : 'text-gray-700')}>{recipe.totalCost != null ? `$${Number(recipe.totalCost).toLocaleString('es-CO')}` : '—'}</td>
      case 'precio':
        return <td key={colId} className="px-4 py-2.5 text-xs text-amber-600 font-medium">{recipe.sellingPrice != null ? `$${Number(recipe.sellingPrice).toLocaleString('es-CO')}` : '—'}</td>
      case 'margen': {
        const m = calculateMargin(recipe.totalCost || 0, recipe.sellingPrice || 0)
        return <td key={colId} className={cn('px-4 py-2.5 text-xs font-medium', m >= 60 ? 'text-emerald-500' : m >= 40 ? 'text-amber-500' : 'text-red-500')}>{recipe.sellingPrice ? `${Math.round(m)}%` : '—'}</td>
      }
      case 'creacion':
        return <td key={colId} className={cn('px-4 py-2.5 text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>{recipe.createdAt?.toDate?.()?.toLocaleDateString('es-ES') || '—'}</td>
      case 'verificacion':
        return (
          <td key={colId} className="px-4 py-2.5 text-xs">
            {recipe.verified
              ? <span className="text-emerald-500 font-semibold">✓ Sí</span>
              : <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>—</span>
            }
          </td>
        )
      default:
        return <td key={colId} />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Recetas v3.0 TEST
          </h1>
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {filtered.length} de {recipes.length} recetas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
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
      <div className="flex flex-wrap gap-3 items-center">
        <div className={cn('flex items-center gap-1 rounded-lg border p-0.5')} style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
          <button onClick={() => { setViewMode('grid'); localStorage.setItem('pos-view-mode', 'grid') }} className="p-1.5 rounded-md transition-colors" style={viewMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
            <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
          <button onClick={() => { setViewMode('list'); localStorage.setItem('pos-view-mode', 'list') }} className="p-1.5 rounded-md transition-colors" style={viewMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
            <ListIcon className={cn('h-3.5 w-3.5', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
        </div>
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
                  canSeeCosts={canSeeCosts}
                  isAdmin={isAdmin}
                  canEdit={canEdit}
                  isDark={isDark}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        // List view — columnas reordenables
        <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn('border-b text-xs uppercase tracking-wider', isDark ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400')}>
                  {listColumns.filter(c => c.visible && (canSeeCosts || !['costo','precio','margen'].includes(c.id))).map((col) => (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={() => setDragCol(col.id)}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
                      onDrop={() => { if (dragCol && dragCol !== col.id) reorderListColumns(dragCol, col.id); setDragCol(null); setDragOver(null) }}
                      onDragEnd={() => { setDragCol(null); setDragOver(null) }}
                      onClick={col.sortable ? () => toggleListSort(col.id) : undefined}
                      className="text-left px-4 py-3"
                      style={{
                        cursor: col.sortable ? 'pointer' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        background: dragOver === col.id ? (isDark ? '#374151' : '#f3f4f6') : undefined,
                        borderLeft: dragOver === col.id ? '2px solid var(--accent)' : undefined,
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ opacity: 0.35, fontSize: '0.65rem' }}>⠿</span>
                        {col.label}
                        {col.sortable && sortField === col.id && (
                          <span style={{ color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="text-left px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((recipe) => {
                  const cat = categories.find((c) => c.id === recipe.categoryId)
                  return (
                    <tr
                      key={recipe.id}
                      className={cn(
                        'border-b last:border-0 transition-colors cursor-pointer',
                        isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-50 hover:bg-gray-50'
                      )}
                      onClick={() => navigate(`/recipes/${recipe.id}`)}
                    >
                      {listColumns.filter(c => c.visible && (canSeeCosts || !['costo','precio','margen'].includes(c.id))).map(col => renderListCell(col.id, recipe, cat))}
                      <td className="px-4 py-2.5 text-center">
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
