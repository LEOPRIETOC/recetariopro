import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { X, Package, Ruler, Tag, Users, BarChart3, Settings, CreditCard, Sun, Moon, Plus, Pencil, Trash2, Upload, Download, ChevronUp, ChevronDown, History, ShoppingCart, Palette, FileText, ToggleLeft, ToggleRight, Truck, LayoutGrid, List as ListIcon, GripVertical, FolderOpen, FileUp } from 'lucide-react'
import { ImportTab } from '../ImportTab'
import * as XLSX from 'xlsx'
import {
  DndContext as DndCtx, PointerSensor as PtrSensor, useSensor as useSen, useSensors as useSens, closestCenter as closestCtr,
} from '@dnd-kit/core'
import {
  SortableContext as SortCtx, verticalListSortingStrategy as vList, arrayMove as arrMove, useSortable as useDndSortable,
} from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { cn, formatNumber, toTitleCase } from '../../lib/utils'
import {
  subscribeIngredients, createIngredient, updateIngredient, deleteIngredient,
  importIngredients, subscribeCategories, createCategory, updateCategory, deleteCategory,
  updateCategoryOrder,
  subscribeRecipes, subscribeSalesData, importSalesData, getNextIngredientCode,
  getNextCategoryCode,
  updateRestaurantSettings, subscribeVersions, toggleRecipeActive, updateAccentColor,
  subscribeMpCategories, getNextMpCategoryCode, createMpCategory, updateMpCategory,
  deleteMpCategory, checkMpCategoryInUse,
} from '../../services/restaurants'
import {
  subscribeSuppliers, createSupplier, updateSupplier, deleteSupplier, getNextSupplierCode,
} from '../../services/suppliers'
import { subscribeUnits, createUnit, updateUnit, deleteUnit, DEFAULT_UNITS } from '../../services/units'
import { useToast } from '../ui/toast'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'

const TABS = [
  { id: 'ingredients', icon: Package, label: 'Materias primas' },
  { id: 'mp_categories', icon: FolderOpen, label: 'Categorías' },
  { id: 'units', icon: Ruler, label: 'Unidades' },
  { id: 'categories', icon: Tag, label: 'Menús' },
  { id: 'suppliers', icon: Truck, label: 'Proveedores' },
  { id: 'import', icon: FileUp, label: 'Importación masiva' },
  { id: 'sales', icon: ShoppingCart, label: 'Ventas' },
  { id: 'analytics', icon: BarChart3, label: 'Análisis BCG' },
  { id: 'recipes', icon: FileText, label: 'Gestión recetas' },
  { id: 'versions', icon: History, label: 'Historial versiones' },
  { id: 'users', icon: Users, label: 'Usuarios' },
  { id: 'appearance', icon: Settings, label: 'Personalización' },
  { id: 'subscription', icon: CreditCard, label: 'Suscripción' },
]

const ACCENT_PALETTE = [
  '#d97706','#f59e0b','#f97316','#ef4444','#e11d48',
  '#a855f7','#8b5cf6','#6366f1','#3b82f6','#0ea5e9',
  '#06b6d4','#14b8a6','#10b981','#22c55e','#84cc16',
  '#78716c',
]

// ── Sort hook ────────────────────────────────────────────────────────────────
function useTableSort(data, defaultKey = null) {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState('asc')

  const requestSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...(data || [])].sort((a, b) => {
    if (!sortKey) return 0
    const aV = a[sortKey] ?? ''
    const bV = b[sortKey] ?? ''
    const cmp = typeof aV === 'number' && typeof bV === 'number'
      ? aV - bV
      : String(aV).localeCompare(String(bV))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <span className="opacity-20 ml-1">↕</span>
    return sortDir === 'asc'
      ? <ChevronUp className="inline h-3 w-3 ml-1 text-gold-500" />
      : <ChevronDown className="inline h-3 w-3 ml-1 text-gold-500" />
  }

  return { sorted, requestSort, sortKey, sortDir, SortIcon }
}

// ── Combobox input with autocomplete suggestions ─────────────────────────────
function ComboInput({ value, onChange, suggestions, placeholder, isDark }) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value || '')
  const containerRef = useRef(null)

  useEffect(() => { setInputVal(value || '') }, [value])

  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions.filter((s) => s.toLowerCase().includes(inputVal.toLowerCase()))

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputVal}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value
          setInputVal(v)
          onChange(v.charAt(0).toUpperCase() + v.slice(1))
          setOpen(true)
        }}
        className={cn(
          'w-full h-9 px-3 text-sm rounded-lg border outline-none transition-colors focus:ring-2 focus:border-transparent',
          isDark
            ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:ring-gray-600'
            : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-gray-300'
        )}
      />
      {open && filtered.length > 0 && (
        <ul className={cn(
          'absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-40 overflow-y-auto text-sm',
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        )}>
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); setInputVal(s); onChange(s); setOpen(false) }}
              className={cn('px-3 py-2 cursor-pointer transition-colors', isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-800')}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Ingredients Tab ──────────────────────────────────────────────────────────
function IngredientsTab({ restaurantId, isDark }) {
  const { success, error } = useToast()
  const [ingredients, setIngredients] = useState([])
  const [units, setUnits] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'create' | 'edit'
  const [saving, setSaving] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [dupErrors, setDupErrors] = useState({})
  const scrollBodyRef = useRef(null)
  const { sorted, requestSort, SortIcon } = useTableSort(ingredients, 'code')

  const schema = z.object({
    item: z.string().optional(),
    reference: z.string().optional(),
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    unit: z.string().min(1, 'Requerido'),
    unitName: z.string().optional(),
    quantityPerPresentation: z.coerce.number().min(0.001, 'Debe ser > 0'),
    value: z.coerce.number().min(0, 'Debe ser ≥ 0'),
    category: z.string().optional(),
    supplier: z.string().optional(),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { item: '', reference: '', name: '', unit: '', unitName: '', quantityPerPresentation: 1, value: 0, category: '', supplier: '' },
  })

  const watchedValue = parseFloat(watch('value')) || 0
  const watchedQty = parseFloat(watch('quantityPerPresentation')) || 0
  const watchedUnitName = watch('unitName') || ''
  const pricePerUnit = watchedQty > 0 ? watchedValue / watchedQty : 0

  const [suppliers, setSuppliers] = useState([])
  const [mpCategories, setMpCategories] = useState([])
  const categorySuggestions = mpCategories.map((c) => c.name).filter(Boolean)
  const supplierSuggestions = suppliers.map((s) => s.name).filter(Boolean)

  useEffect(() => {
    if (!restaurantId) return
    const u1 = subscribeIngredients(restaurantId, setIngredients)
    const u2 = subscribeUnits(restaurantId, setUnits)
    const u3 = subscribeSuppliers(restaurantId, setSuppliers)
    const u4 = subscribeMpCategories(restaurantId, setMpCategories)
    return () => { u1(); u2(); u3(); u4() }
  }, [restaurantId])

  const goToList = () => { setViewMode('list'); setEditing(null); reset(); setDupErrors({}) }

  const openNew = async () => {
    const code = await getNextIngredientCode(restaurantId)
    setNextCode(code)
    setEditing(null)
    setDupErrors({})
    reset({ item: '', reference: '', name: '', unit: '', unitName: '', quantityPerPresentation: 1, value: 0, category: '', supplier: '' })
    setViewMode('create')
  }

  const openEdit = (ing) => {
    setEditing(ing)
    setNextCode(ing.code)
    setDupErrors({})
    const rawUnit = ing.useUnit || ing.unit || ''
    const matchedUnit = units.find((u) => u.abbreviation?.toUpperCase().trim() === rawUnit.toUpperCase().trim())
    reset({
      item: ing.item || '',
      reference: ing.reference || '',
      name: ing.name || ing.description || '',
      unit: matchedUnit?.abbreviation || rawUnit,
      unitName: matchedUnit?.name || ing.unitName || rawUnit,
      quantityPerPresentation: ing.quantityPerPresentation ?? 1,
      value: ing.value ?? ing.pricePerUnit ?? 0,
      category: ing.category || '',
      supplier: ing.supplier || '',
    })
    setViewMode('edit')
  }

  const checkDuplicate = (field, value) => {
    if (!value) { setDupErrors((p) => ({ ...p, [field]: undefined })); return }
    const dup = ingredients.find((i) => {
      if (editing && i.id === editing.id) return false
      const fieldVal = field === 'name' ? (i.name || i.description || '') : (i[field] || '')
      return fieldVal.toLowerCase() === value.toLowerCase()
    })
    setDupErrors((p) => ({
      ...p,
      [field]: dup ? `Ya existe: ${dup.name || dup.description || dup.item}` : undefined,
    }))
  }

  const onSubmit = async (data) => {
    if (Object.values(dupErrors).some(Boolean)) { error('Corrige los errores de duplicado'); return }
    setSaving(true)
    try {
      const qty = parseFloat(data.quantityPerPresentation) || 0
      const val = parseFloat(data.value) || 0
      const payload = {
        ...data,
        name: toTitleCase(data.name),
        useUnit: data.unit,
        pricePerUnit: qty > 0 ? val / qty : 0,
      }
      if (editing) {
        await updateIngredient(restaurantId, editing.id, payload)
      } else {
        await createIngredient(restaurantId, { ...payload, code: nextCode })
      }
      success('Guardado correctamente')
      goToList()
    } catch { error('Error al guardar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta materia prima?')) return
    try { await deleteIngredient(restaurantId, id); success('Eliminado') } catch { error('Error') }
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const existingCodes = ingredients.map((i) => i.code)
        await importIngredients(restaurantId, rows, existingCodes)
        success(`${rows.length} materias importadas`)
      } catch { error('Error al importar') }
      e.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(ingredients.map((i) => ({
      CODIGO: i.code || '',
      ITEM: i.item || '',
      REFERENCIA: i.reference || '',
      NOMBRE: i.name || i.description || '',
      UNIDAD: i.useUnit || i.unit || '',
      UNIDAD_COMPRA: i.purchaseUnit || '',
      CANT_PRESENTACION: i.quantityPerPresentation || '',
      VALOR: i.value || '',
      PRECIO_POR_UNIDAD: i.pricePerUnit || '',
      CATEGORIA: i.category || '',
      CODIGO_PROVEEDOR: i.supplierCode || '',
      PROVEEDOR: i.supplier || '',
    })))
    ws['!cols'] = Array(12).fill({ wch: 18 })
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Materias')
    XLSX.writeFile(wb, 'materias_primas_recetariopro.xlsx')
  }

  const filtered = sorted.filter((i) => {
    const q = search.toLowerCase()
    return !q
      || i.name?.toLowerCase().includes(q)
      || i.description?.toLowerCase().includes(q)
      || i.code?.toLowerCase().includes(q)
      || i.item?.toLowerCase().includes(q)
      || i.category?.toLowerCase().includes(q)
      || i.supplier?.toLowerCase().includes(q)
  })

  // ── FORM VIEW (create / edit) ────────────────────────────────────────────
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          type="button"
          onClick={goToList}
          className={cn(
            'flex items-center gap-1.5 text-sm font-medium transition-colors',
            isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          )}
        >
          ← Volver al listado
        </button>

        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border space-y-4', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>

          {/* Row: Código · Referencia */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '140px 1fr' }}>
            <div className="space-y-1">
              <Label>Código</Label>
              <div className={cn('h-9 flex items-center px-3 rounded-lg border text-xs font-mono font-semibold', isDark ? 'bg-gray-700 border-gray-600 text-gold-400' : 'bg-gray-100 border-gray-200 text-gold-700')}>
                {nextCode}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input
                {...register('reference')}
                placeholder="MP1000001"
                className={dupErrors.reference ? 'border-red-400' : ''}
                onBlur={(e) => checkDuplicate('reference', e.target.value)}
              />
              {dupErrors.reference && <p className="text-xs text-red-500">{dupErrors.reference}</p>}
            </div>
          </div>

          {/* Row: Nombre — full width */}
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input
              {...register('name')}
              placeholder="Harina de trigo"
              className={errors.name || dupErrors.name ? 'border-red-400' : ''}
              onChange={(e) => { const v = e.target.value; setValue('name', v.charAt(0).toUpperCase() + v.slice(1)) }}
              onBlur={(e) => { const v = toTitleCase(e.target.value); setValue('name', v); checkDuplicate('name', v) }}
            />
            {(errors.name || dupErrors.name) && <p className="text-xs text-red-500">{errors.name?.message || dupErrors.name}</p>}
          </div>

          {/* Row: Unidad · Cant./Presentación · Valor · Precio/Unidad */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Unidad *</Label>
              <Select value={watch('unit') || ''} onValueChange={(v) => {
                const found = units.find((u) => u.abbreviation === v)
                setValue('unit', v)
                setValue('unitName', found?.name || v)
                setValue('useUnit', v)
                setValue('purchaseUnit', v)
              }}>
                <SelectTrigger className={errors.unit ? 'border-red-400' : ''}><SelectValue placeholder="kg, lt..." /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</SelectItem>)}
                  {units.length === 0 && <SelectItem value="und">und</SelectItem>}
                </SelectContent>
              </Select>
              {errors.unit && <p className="text-xs text-red-500">{errors.unit.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Cant./Presentación *</Label>
              <Input type="number" step="0.001" min="0.001" {...register('quantityPerPresentation')} className={errors.quantityPerPresentation ? 'border-red-400' : ''} />
              {errors.quantityPerPresentation && <p className="text-xs text-red-500">{errors.quantityPerPresentation.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Valor presentación *</Label>
              <Input type="number" step="0.01" min="0" {...register('value')} className={errors.value ? 'border-red-400' : ''} />
              {errors.value && <p className="text-xs text-red-500">{errors.value.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="truncate block">Precio por {watchedUnitName || 'unidad'}</Label>
              <div className={cn('h-9 flex items-center px-3 rounded-lg border text-sm font-semibold', isDark ? 'bg-gray-700 border-gray-600 text-gold-400' : 'bg-white border-gray-200 text-gold-700')}>
                {pricePerUnit > 0 ? formatNumber(pricePerUnit) : '—'}
              </div>
              <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Valor ÷ Cantidad</p>
            </div>
          </div>

          {/* Row: Categoría · Proveedor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoría</Label>
              {mpCategories.length === 0 ? (
                <p className={cn('text-xs px-3 py-2 rounded-lg border', isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400')}>
                  Crea categorías en <span className="font-medium">Configuración → Categorías</span>
                </p>
              ) : (
                <ComboInput
                  value={watch('category') || ''}
                  onChange={(v) => setValue('category', v)}
                  suggestions={categorySuggestions}
                  placeholder="Seleccionar categoría..."
                  isDark={isDark}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <ComboInput
                value={watch('supplier') || ''}
                onChange={(v) => setValue('supplier', v)}
                suggestions={supplierSuggestions}
                placeholder="Nombre del proveedor"
                isDark={isDark}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={goToList}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : 'Guardar'}</Button>
          </div>
        </form>
      </div>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────
  const rowBg = isDark ? '#111827' : '#ffffff'
  const headBg = isDark ? '#1f2937' : '#f9fafb'
  const borderColor = isDark ? '#1f2937' : '#f3f4f6'
  const scrollTrack = isDark ? '#0f172a' : '#e5e7eb'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        #materias-scroll-body::-webkit-scrollbar { height: 10px; width: 8px; display: block !important; }
        #materias-scroll-body::-webkit-scrollbar-track { background: ${scrollTrack}; border-radius: 4px; }
        #materias-scroll-body::-webkit-scrollbar-thumb { background: var(--accent, #8b5cf6); border-radius: 4px; min-width: 40px; }
        #materias-scroll-body { scrollbar-width: auto; scrollbar-color: var(--accent, #8b5cf6) ${scrollTrack}; }
      `}</style>

      {/* Toolbar — never scrolls */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código, item..."
              className={cn('w-full pl-3 pr-3 h-8 text-sm rounded-lg border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-200 placeholder:text-gray-400')}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Exportar</Button>
          <label>
            <Button variant="outline" size="sm" asChild><span className="cursor-pointer"><Upload className="h-4 w-4" /> Importar</span></Button>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nueva materia prima</Button>
        </div>
      </div>

      {/* Table — fills remaining height, scrolls both axes */}
      <div
        id="materias-scroll-body"
        ref={scrollBodyRef}
        style={{ flex: 1, overflowX: 'scroll', overflowY: 'auto' }}
      >
        <table style={{ width: '100%', minWidth: '1250px', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <colgroup>
            <col style={{ width: '90px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '190px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '105px' }} />
            <col style={{ width: '105px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '130px' }} />
            <col style={{ width: '75px' }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: headBg }}>
            <tr>
              {[
                ['code', 'Código', true, false],
                ['reference', 'Referencia', false, false],
                ['name', 'Nombre', false, false],
                ['unit', 'Unidad', false, false],
                ['quantityPerPresentation', 'Cant/Present.', false, false],
                ['value', 'Valor', false, false],
                ['pricePerUnit', 'Precio/Unidad', false, false],
                ['category', 'Categoría', false, false],
                ['supplier', 'Proveedor', false, false],
              ].map(([k, label, stickyL]) => (
                <th
                  key={k}
                  onClick={() => requestSort(k)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isDark ? '#6b7280' : '#9ca3af',
                    background: headBg,
                    borderBottom: `1px solid ${borderColor}`,
                    ...(stickyL ? { position: 'sticky', left: 0, zIndex: 20, boxShadow: '2px 0 6px rgba(0,0,0,0.12)' } : {}),
                  }}
                >
                  {label}<SortIcon k={k} />
                </th>
              ))}
              <th style={{
                textAlign: 'right',
                padding: '8px 12px',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: isDark ? '#6b7280' : '#9ca3af',
                background: headBg,
                borderBottom: `1px solid ${borderColor}`,
                position: 'sticky',
                right: 0,
                zIndex: 20,
                boxShadow: '-2px 0 6px rgba(0,0,0,0.12)',
              }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', fontSize: '0.875rem', color: isDark ? '#4b5563' : '#9ca3af' }}>
                  Sin resultados
                </td>
              </tr>
            ) : filtered.map((ing) => (
              <tr
                key={ing.id}
                className={cn('group', isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50')}
                style={{ borderTop: `1px solid ${borderColor}` }}
              >
                {/* Código — sticky left */}
                <td style={{
                  padding: '10px 12px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: isDark ? '#d97706' : '#92400e',
                  background: rowBg,
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  boxShadow: '2px 0 6px rgba(0,0,0,0.12)',
                  whiteSpace: 'nowrap',
                }}>
                  {ing.code}
                </td>
                <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>{ing.reference || '—'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: isDark ? '#f9fafb' : '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.name || ing.description}</td>
                <td style={{ padding: '10px 12px', color: isDark ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>{ing.useUnit || ing.unit || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isDark ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>{ing.quantityPerPresentation ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isDark ? '#d1d5db' : '#374151', whiteSpace: 'nowrap' }}>{ing.value != null ? formatNumber(ing.value) : '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: isDark ? '#d97706' : '#92400e', whiteSpace: 'nowrap' }}>{formatNumber(ing.pricePerUnit)}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{ing.category && <Badge variant="secondary">{ing.category}</Badge>}</td>
                <td style={{ padding: '10px 12px', color: isDark ? '#9ca3af' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.supplier || '—'}</td>
                {/* Acciones — sticky right */}
                <td style={{
                  padding: '10px 8px',
                  background: rowBg,
                  position: 'sticky',
                  right: 0,
                  zIndex: 5,
                  boxShadow: '-2px 0 6px rgba(0,0,0,0.12)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                    <button onClick={() => openEdit(ing)} className="p-1.5 rounded-lg hover:bg-gold-50 text-gray-400 hover:text-gold-600"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(ing.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Units Tab ────────────────────────────────────────────────────────────────
function UnitsTab({ restaurantId, isDark }) {
  const { success, error } = useToast()
  const [units, setUnits] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const schema = z.object({
    name: z.string().min(2),
    abbreviation: z.string().min(1).max(6),
    type: z.string().min(1),
  })
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!restaurantId) return
    return subscribeUnits(restaurantId, setUnits)
  }, [restaurantId])

  const seedDefaults = async () => {
    try {
      await Promise.all(DEFAULT_UNITS.map((u) => createUnit(restaurantId, u)))
      success('Unidades predeterminadas agregadas')
    } catch { error('Error') }
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { ...data, name: toTitleCase(data.name) }
      if (editing) await updateUnit(restaurantId, editing.id, payload)
      else await createUnit(restaurantId, payload)
      success('Guardado')
      setShowForm(false)
      reset()
      setEditing(null)
    } catch { error('Error') }
    finally { setSaving(false) }
  }

  const openEdit = (u) => { setEditing(u); reset({ name: u.name, abbreviation: u.abbreviation, type: u.type }); setShowForm(true) }

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(units.map((u) => ({
      CODIGO: u.code || '',
      MEDIDA: u.abbreviation || '',
      DESCRIPCION: u.name || '',
      EQUIVALENCIA: u.equivalence || 1,
    })))
    ws['!cols'] = Array(4).fill({ wch: 18 })
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Unidades')
    XLSX.writeFile(wb, 'unidades_recetariopro.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>{units.length} unidades registradas</p>
        <div className="flex gap-2">
          {units.length === 0 && <Button variant="outline" size="sm" onClick={seedDefaults}>Cargar predeterminadas</Button>}
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Exportar</Button>
          <Button size="sm" onClick={() => { setEditing(null); reset({ name: '', abbreviation: '', type: 'Peso' }); setShowForm(true) }}><Plus className="h-4 w-4" /> Nueva</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border space-y-3', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input {...register('name')} onBlur={(e) => { const v = toTitleCase(e.target.value); if (v) setValue('name', v) }} placeholder="Kilogramo" className={errors.name ? 'border-red-400' : ''} />
            </div>
            <div className="space-y-1">
              <Label>Abreviatura *</Label>
              <Input {...register('abbreviation')} placeholder="kg" className={errors.abbreviation ? 'border-red-400' : ''} />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={watch('type') || 'Peso'} onValueChange={(v) => setValue('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Peso','Volumen','Unidad','Otro'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : 'Guardar'}</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {units.map((u) => (
          <div key={u.id} className={cn('flex items-center justify-between p-3 rounded-xl border group', isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('font-mono text-sm font-bold', isDark ? 'text-gold-400' : 'text-gold-700')}>{u.abbreviation}</span>
                <Badge variant="secondary" className="text-xs">{u.type}</Badge>
              </div>
              <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>{u.name}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(u)} className="p-1 rounded hover:bg-gold-50 text-gray-400 hover:text-gold-600"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={async () => { if (!confirm('¿Eliminar?')) return; try { await deleteUnit(restaurantId, u.id); } catch { } }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MP Categories Tab (Categorías de materias primas) ────────────────────────
function MpCategoriesTab({ restaurantId, isDark }) {
  const { success, error } = useToast()
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [catCode, setCatCode] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cfg_mpcat_view') || 'list')
  const [dupError, setDupError] = useState(null)

  const schema = z.object({ name: z.string().min(2, 'Mínimo 2 caracteres') })
  const { register, handleSubmit, reset, setValue, watch: watchForm, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => { if (!restaurantId) return; return subscribeMpCategories(restaurantId, setCategories) }, [restaurantId])

  const openNew = async () => {
    setEditing(null); setDupError(null); reset({ name: '' })
    const code = await getNextMpCategoryCode(restaurantId).catch(() => '')
    setCatCode(code); setShowForm(true)
  }
  const openEdit = (c) => { setEditing(c); setCatCode(c.code || ''); setDupError(null); reset({ name: c.name }); setShowForm(true) }

  const checkDup = (value) => {
    if (!value) { setDupError(null); return }
    const dup = categories.find((c) => (!editing || c.id !== editing.id) && c.name.toLowerCase() === value.toLowerCase())
    setDupError(dup ? `Ya existe: ${dup.name}` : null)
  }

  const onSubmit = async (data) => {
    if (dupError) return
    setSaving(true)
    try {
      const name = data.name.charAt(0).toUpperCase() + data.name.slice(1).toLowerCase()
      if (editing) await updateMpCategory(restaurantId, editing.id, { name, code: catCode })
      else await createMpCategory(restaurantId, { name, code: catCode })
      success('Guardado'); setShowForm(false); reset(); setEditing(null)
    } catch { error('Error') } finally { setSaving(false) }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`¿Eliminar "${cat.name}"?`)) return
    try {
      const inUse = await checkMpCategoryInUse(restaurantId, cat.name)
      if (inUse) { error(`"${cat.name}" está en uso en materias primas. Reasigna antes de eliminar.`); return }
      await deleteMpCategory(restaurantId, cat.id); success('Eliminada')
    } catch { error('Error') }
  }

  const setView = (v) => { localStorage.setItem('cfg_mpcat_view', v); setViewMode(v) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
          <button onClick={() => setView('grid')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
            <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
          <button onClick={() => setView('list')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
            <ListIcon className={cn('h-3.5 w-3.5', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nueva categoría</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border space-y-3', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <div className={cn('px-3 py-2 h-9 rounded-lg text-sm font-mono font-bold flex items-center', isDark ? 'bg-gray-700 text-gold-400' : 'bg-gray-100 text-gold-700')}>
                {catCode || '—'}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                {...register('name')}
                onChange={(e) => { const v = e.target.value; setValue('name', v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()); setDupError(null) }}
                onBlur={(e) => checkDup(e.target.value)}
                className={errors.name || dupError ? 'border-red-400' : ''}
                placeholder="Nombre de la categoría"
              />
              {(errors.name || dupError) && <p className="text-xs text-red-500">{errors.name?.message || dupError}</p>}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving || !!dupError}>{saving ? '...' : 'Guardar'}</Button>
          </div>
        </form>
      )}

      {categories.length === 0 && !showForm ? (
        <div className={cn('text-center py-12 rounded-xl border-2 border-dashed', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400')}>
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">Sin categorías</p>
          <p className="text-xs">Crea categorías para organizar tus materias primas</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <div key={cat.id} className={cn('group rounded-xl border p-3', isDark ? 'border-gray-800' : 'border-gray-200')}>
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  {cat.code && <p className="font-mono text-xs mb-0.5" style={{ color: 'var(--accent)' }}>{cat.code}</p>}
                  <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-800')}>{cat.name}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => openEdit(cat)} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(cat)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
          {categories.map((cat) => (
            <div key={cat.id} className={cn('flex items-center gap-3 px-3 py-2.5 border-b last:border-0', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>{cat.code || '—'}</span>
              <span className={cn('flex-1 text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>{cat.name}</span>
              <button onClick={() => openEdit(cat)} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => handleDelete(cat)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Categories (Menús) Tab ────────────────────────────────────────────────────
// ── Sortable row/card helpers for CategoriesTab ──────────────────────────────
function SortableCatItem({ cat, isDark, onEdit, onDelete, mode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDndSortable({ id: cat.id })
  const style = { transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const dragHandle = (
    <button type="button" {...attributes} {...listeners}
      className={cn('flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded touch-none', isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500')}>
      <GripVertical className="h-4 w-4" />
    </button>
  )
  if (mode === 'list') {
    return (
      <div ref={setNodeRef} style={style}
        className={cn('flex items-center gap-2 px-3 py-2 border-b last:border-0', isDark ? 'border-gray-800' : 'border-gray-100')}>
        {dragHandle}
        <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>{cat.code || '—'}</span>
        <span className={cn('flex-1 text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>{cat.name}</span>
        {cat.description && <span className={cn('text-xs hidden sm:block', isDark ? 'text-gray-500' : 'text-gray-400')}>{cat.description}</span>}
        <button onClick={onEdit} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )
  }
  return (
    <div ref={setNodeRef} style={style} className={cn('group rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
      <div className="h-2" style={{ background: 'var(--accent)' }} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          {dragHandle}
          <div className="flex-1 min-w-0">
            {cat.code && <p className="font-mono text-xs mb-0.5" style={{ color: 'var(--accent)' }}>{cat.code}</p>}
            <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-800')}>{cat.name}</p>
            {cat.description && <p className={cn('text-xs truncate', isDark ? 'text-gray-500' : 'text-gray-400')}>{cat.description}</p>}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={onDelete} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoriesTab({ restaurantId, isDark }) {
  const { success, error } = useToast()
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [catCode, setCatCode] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cfg_cat_view') || 'grid')

  const sensors = useSens(useSen(PtrSensor, { activationConstraint: { distance: 5 } }))
  const schema = z.object({ name: z.string().min(2), description: z.string().optional() })
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => { if (!restaurantId) return; return subscribeCategories(restaurantId, setCategories) }, [restaurantId])

  const openNew = async () => {
    setEditing(null); reset({ name: '', description: '' })
    const code = await getNextCategoryCode(restaurantId).catch(() => '')
    setCatCode(code); setShowForm(true)
  }
  const openEdit = (c) => { setEditing(c); setCatCode(c.code || ''); reset({ name: c.name, description: c.description || '' }); setShowForm(true) }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { ...data, code: catCode, name: data.name.charAt(0).toUpperCase() + data.name.slice(1).toLowerCase() }
      if (editing) await updateCategory(restaurantId, editing.id, payload)
      else await createCategory(restaurantId, { ...payload, order: Date.now() })
      success('Guardado'); setShowForm(false); reset(); setEditing(null)
    } catch { error('Error') } finally { setSaving(false) }
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldI = categories.findIndex((c) => c.id === active.id)
    const newI = categories.findIndex((c) => c.id === over.id)
    const next = arrMove(categories, oldI, newI)
    setCategories(next)
    updateCategoryOrder(restaurantId, next.map((c) => c.id))
  }

  const setView = (v) => { localStorage.setItem('cfg_cat_view', v); setViewMode(v) }

  const handleExportCats = () => {
    const ws = XLSX.utils.json_to_sheet(categories.map((c) => ({
      CODIGO_MENU: c.code || '',
      NOMBRE_MENU: c.name || '',
      ORDEN: c.order ?? '',
    })))
    ws['!cols'] = Array(3).fill({ wch: 20 })
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Menús')
    XLSX.writeFile(wb, 'menus_recetariopro.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
          <button onClick={() => setView('grid')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
            <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
          <button onClick={() => setView('list')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
            <ListIcon className={cn('h-3.5 w-3.5', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCats}><Download className="h-4 w-4" /> Exportar</Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nuevo menú</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border space-y-3', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '12px' }}>
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <div className={cn('px-3 py-2 h-9 rounded-lg text-sm font-mono font-bold flex items-center', isDark ? 'bg-gray-700 text-gold-400' : 'bg-gray-100 text-gold-700')}>
                {catCode || '—'}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input {...register('name')}
                onChange={(e) => { const v = e.target.value; setValue('name', v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()) }}
                className={errors.name ? 'border-red-400' : ''} placeholder="Nombre del menú" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input {...register('description')} placeholder="Descripción opcional" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : 'Guardar'}</Button>
          </div>
        </form>
      )}

      <DndCtx sensors={sensors} collisionDetection={closestCtr} onDragEnd={handleDragEnd}>
        <SortCtx items={categories.map((c) => c.id)} strategy={vList}>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <SortableCatItem key={cat.id} cat={cat} isDark={isDark} mode="grid"
                  onEdit={() => openEdit(cat)}
                  onDelete={async () => { if (!confirm('¿Eliminar este menú?')) return; try { await deleteCategory(restaurantId, cat.id) } catch {} }} />
              ))}
            </div>
          ) : (
            <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
              {categories.map((cat) => (
                <SortableCatItem key={cat.id} cat={cat} isDark={isDark} mode="list"
                  onEdit={() => openEdit(cat)}
                  onDelete={async () => { if (!confirm('¿Eliminar este menú?')) return; try { await deleteCategory(restaurantId, cat.id) } catch {} }} />
              ))}
            </div>
          )}
        </SortCtx>
      </DndCtx>
    </div>
  )
}

// ── Contrasts Tab ─────────────────────────────────────────────────────────────
function ContrastsTab({ restaurantId, isDark }) {
  const { accentColor, setAccentColor } = useAppStore()
  const { success } = useToast()

  const handleSelect = async (color) => {
    setAccentColor(color)
    if (restaurantId) {
      try { await updateAccentColor(restaurantId, color) } catch { /* silent */ }
    }
    success('Color de acento actualizado')
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <p className={cn('text-sm font-semibold mb-1', isDark ? 'text-white' : 'text-gray-900')}>Color de acento global</p>
        <p className={cn('text-xs mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
          Este color se aplica a todos los botones, pestañas activas, bordes e íconos de acento en toda la aplicación.
        </p>
        <div className="grid grid-cols-8 gap-3">
          {ACCENT_PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => handleSelect(color)}
              title={color}
              className={cn(
                'w-10 h-10 rounded-full transition-all hover:scale-110',
                accentColor === color && 'ring-4 ring-offset-2 scale-110'
              )}
              style={{ background: color, '--tw-ring-color': color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Color personalizado</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor || '#d97706'}
            onChange={(e) => handleSelect(e.target.value)}
            className="w-12 h-10 rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--accent)' }}
          />
          <span className={cn('text-sm font-mono', isDark ? 'text-gray-300' : 'text-gray-700')}>
            {accentColor || '#d97706'}
          </span>
        </div>
      </div>

      <div className={cn('p-4 rounded-xl border', isDark ? 'border-gray-700' : 'border-gray-200')}>
        <p className={cn('text-xs font-medium mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>Vista previa</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: 'var(--accent)' }}>
            Botón primario
          </button>
          <button className="px-4 py-2 rounded-lg text-sm font-medium border-2" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            Botón outline
          </button>
          <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Texto de acento</span>
          <div className="h-1.5 w-24 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Suppliers Tab ─────────────────────────────────────────────────────────────
function SuppliersTab({ restaurantId, isDark }) {
  const { success, error } = useToast()
  const [suppliers, setSuppliers] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cfg_sup_view') || 'list')

  const schema = z.object({
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    contact: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    address: z.string().optional(),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!restaurantId) return
    return subscribeSuppliers(restaurantId, setSuppliers)
  }, [restaurantId])

  const openNew = async () => {
    setEditing(null)
    reset({ name: '', contact: '', phone: '', email: '', address: '' })
    const code = await getNextSupplierCode(restaurantId).catch(() => '')
    setNextCode(code)
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setNextCode(s.code || '')
    reset({ name: s.name || '', contact: s.contact || '', phone: s.phone || '', email: s.email || '', address: s.address || '' })
    setShowForm(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { ...data, name: toTitleCase(data.name) }
      if (editing) await updateSupplier(restaurantId, editing.id, payload)
      else await createSupplier(restaurantId, { ...payload, code: nextCode })
      success('Guardado')
      setShowForm(false); reset(); setEditing(null)
    } catch { error('Error al guardar') } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este proveedor?')) return
    try { await deleteSupplier(restaurantId, id); success('Eliminado') } catch { error('Error') }
  }

  const setView = (v) => { localStorage.setItem('cfg_sup_view', v); setViewMode(v) }

  const handleExportSup = () => {
    const ws = XLSX.utils.json_to_sheet(suppliers.map((s) => ({
      CODIGO_PROVEEDOR: s.code || '',
      NOMBRE_PROVEEDOR: s.name || '',
      CONTACTO: s.contact || '',
      CELULAR: s.phone || '',
      DIRECCION: s.address || '',
    })))
    ws['!cols'] = Array(5).fill({ wch: 20 })
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Proveedores')
    XLSX.writeFile(wb, 'proveedores_recetariopro.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
          <button onClick={() => setView('grid')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
            <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
          <button onClick={() => setView('list')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
            <ListIcon className={cn('h-3.5 w-3.5', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportSup}><Download className="h-4 w-4" /> Exportar</Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nuevo proveedor</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border space-y-3', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '12px' }}>
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <div className={cn('px-3 py-2 h-9 rounded-lg text-sm font-mono font-bold flex items-center', isDark ? 'bg-gray-700 text-gold-400' : 'bg-gray-100 text-gold-700')}>
                {nextCode || '—'}
              </div>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Nombre *</Label>
              <Input {...register('name')} className={errors.name ? 'border-red-400' : ''} placeholder="Nombre del proveedor" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="space-y-1">
              <Label>Contacto</Label>
              <Input {...register('contact')} placeholder="Nombre del contacto" />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input {...register('phone')} placeholder="+34 600 000 000" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...register('email')} placeholder="email@proveedor.com" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input {...register('address')} placeholder="Dirección" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : 'Guardar'}</Button>
          </div>
        </form>
      )}

      {suppliers.length === 0 && !showForm ? (
        <div className={cn('text-center py-12 rounded-xl border-2 border-dashed', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400')}>
          <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">Sin proveedores</p>
          <p className="text-xs">Agrega proveedores para asignarlos a tus materias primas</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {suppliers.map((s) => (
            <div key={s.id} className={cn('group rounded-xl border p-3', isDark ? 'border-gray-800' : 'border-gray-200')}>
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  {s.code && <p className="font-mono text-xs mb-0.5" style={{ color: 'var(--accent)' }}>{s.code}</p>}
                  <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-800')}>{s.name}</p>
                  {s.contact && <p className={cn('text-xs truncate mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.contact}</p>}
                  {s.phone && <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.phone}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
          {suppliers.map((s) => (
            <div key={s.id} className={cn('flex items-center gap-3 px-3 py-2.5 border-b last:border-0', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>{s.code || '—'}</span>
              <span className={cn('flex-1 text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>{s.name}</span>
              {s.contact && <span className={cn('text-xs hidden sm:block', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.contact}</span>}
              {s.phone && <span className={cn('text-xs hidden md:block', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.phone}</span>}
              <button onClick={() => openEdit(s)} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => handleDelete(s.id)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Recipe Management Tab ─────────────────────────────────────────────────────
function RecipeManagementTab({ restaurantId, isDark, onClose }) {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [menuFilter, setMenuFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!restaurantId) return
    const u1 = subscribeRecipes(restaurantId, setRecipes)
    const u2 = subscribeCategories(restaurantId, setCategories)
    return () => { u1(); u2() }
  }, [restaurantId])

  const filtered = (recipes || []).filter((r) => {
    if (statusFilter === 'active' && r.active === false) return false
    if (statusFilter === 'inactive' && r.active !== false) return false
    if (typeFilter === 'recipe' && r.isSubRecipe) return false
    if (typeFilter === 'subrecipe' && !r.isSubRecipe) return false
    if (menuFilter !== 'all' && r.categoryId !== menuFilter) return false
    const q = (search || '').toLowerCase()
    if (q) return r.name?.toLowerCase()?.includes(q) || r.code?.toLowerCase()?.includes(q)
    return true
  })

  const handleToggle = async (r) => {
    try {
      await toggleRecipeActive(restaurantId, r.id, !r.active)
      success(r.active !== false ? 'Desactivada' : 'Activada')
    } catch { error('Error') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar receta..." className={cn('flex-1 min-w-32 px-3 h-8 text-sm rounded-lg border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="recipe">Recetas</SelectItem>
            <SelectItem value="subrecipe">Sub-recetas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={menuFilter} onValueChange={setMenuFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los menús</SelectItem>
            {(categories || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{filtered.length} recetas</p>
      <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className={cn('text-xs uppercase tracking-wider sticky top-0', isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400')}>
              <tr>
                {['Nombre','Código','Menú','Tipo','Estado','Creación',''].map((h) => (
                  <th key={h} className="text-left px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className={cn('text-center py-8 text-sm', isDark ? 'text-gray-600' : 'text-gray-400')}>Sin resultados</td></tr>
              ) : filtered.map((r) => {
                const cat = (categories || []).find((c) => c.id === r.categoryId)
                return (
                  <tr key={r.id} className={cn('border-t', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    <td className={cn('px-3 py-2.5 font-medium max-w-48 truncate', isDark ? 'text-white' : 'text-gray-800')}>{r.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.code}</td>
                    <td className="px-3 py-2.5 text-xs">{cat?.name || '—'}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-xs">{r.isSubRecipe ? 'Sub' : 'Receta'}</Badge></td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => handleToggle(r)} className="flex items-center gap-1 text-xs">
                        {r.active !== false
                          ? <><ToggleRight className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600">Activa</span></>
                          : <><ToggleLeft className="h-4 w-4 text-gray-400" /><span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Inactiva</span></>}
                      </button>
                    </td>
                    <td className={cn('px-3 py-2.5 text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>
                      {r.createdAt?.toDate?.()?.toLocaleDateString('es-ES') || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => { onClose(); navigate(`/recipes/${r.id}`) }}
                        className="text-xs px-2 py-1 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Sales Tab (Ventas) ────────────────────────────────────────────────────────
function SalesTab({ restaurantId, isDark, onViewBCG }) {
  const { success, error } = useToast()
  const [salesData, setSalesData] = useState([])

  useEffect(() => {
    if (!restaurantId) return
    return subscribeSalesData(restaurantId, setSalesData)
  }, [restaurantId])

  const handleImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        await importSalesData(restaurantId, rows)
        success(`${rows.length} registros importados`)
      } catch { error('Error al importar') }
      e.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { recipeName: 'Ejemplo Pizza Margherita', quantity: 25, revenue: 375.00, period: '2024-01' },
      { recipeName: 'Ejemplo Tiramisú', quantity: 15, revenue: 135.00, period: '2024-01' },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
    XLSX.writeFile(wb, 'plantilla_ventas.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className={cn('text-sm flex-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{salesData.length} registros de ventas</p>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}><Download className="h-4 w-4" /> Descargar plantilla</Button>
        <label>
          <Button variant="outline" size="sm" asChild><span className="cursor-pointer"><Upload className="h-4 w-4" /> Importar ventas</span></Button>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </label>
        <Button size="sm" onClick={onViewBCG}><BarChart3 className="h-4 w-4" /> Ver Análisis BCG</Button>
      </div>

      {salesData.length === 0 ? (
        <div className={cn('text-center py-12 rounded-xl border-2 border-dashed', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400')}>
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">Sin datos de ventas</p>
          <p className="text-xs">Descarga la plantilla y sube tus datos de ventas en Excel</p>
          <p className="text-xs mt-1 opacity-60">Columnas: recipeName, quantity, revenue, period</p>
        </div>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className={cn('text-xs uppercase tracking-wider sticky top-0', isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400')}>
                <tr>
                  {['Receta', 'Cantidad', 'Ingresos', 'Período'].map((h) => (
                    <th key={h} className="text-left px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salesData.map((s, i) => (
                  <tr key={i} className={cn('border-t', isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50')}>
                    <td className={cn('px-4 py-2.5 font-medium', isDark ? 'text-white' : 'text-gray-800')}>{s.recipeName}</td>
                    <td className={cn('px-4 py-2.5', isDark ? 'text-gray-300' : 'text-gray-600')}>{s.quantity}</td>
                    <td className={cn('px-4 py-2.5 font-medium', isDark ? 'text-gold-400' : 'text-gold-700')}>{formatNumber(s.revenue)}</td>
                    <td className={cn('px-4 py-2.5 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.period || '—'}</td>
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

// ── Analytics Tab (BCG) ───────────────────────────────────────────────────────
function AnalyticsTab({ restaurantId, isDark, onGoToSales }) {
  const [recipes, setRecipes] = useState([])
  const [salesData, setSalesData] = useState([])

  useEffect(() => {
    if (!restaurantId) return
    const u1 = subscribeRecipes(restaurantId, setRecipes)
    const u2 = subscribeSalesData(restaurantId, setSalesData)
    return () => { u1(); u2() }
  }, [restaurantId])

  const bcgData = recipes.filter((r) => r.active !== false).map((recipe) => {
    const sales = salesData.filter((s) => s.recipeName?.toLowerCase() === recipe.name?.toLowerCase())
    const qty = sales.reduce((a, s) => a + (s.quantity || 0), 0)
    const margin = recipe.salePrice > 0 ? ((recipe.salePrice - (recipe.costPerPortion || 0)) / recipe.salePrice) * 100 : 0
    const pops = salesData.map((s) => s.quantity || 0)
    const midPop = pops.length ? (Math.max(...pops) + Math.min(...pops)) / 2 : 50
    const quadrant = qty >= midPop && margin >= 50 ? '⭐ Estrella' : qty >= midPop ? '🐄 Vaca lechera' : margin >= 50 ? '❓ Interrogante' : '🐕 Perro'
    return { name: recipe.name, qty, margin, quadrant }
  }).filter((d) => d.qty > 0 || salesData.length === 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>{salesData.length} registros de ventas · {bcgData.length} recetas analizadas</p>
        {salesData.length === 0 && (
          <Button variant="outline" size="sm" onClick={onGoToSales}><ShoppingCart className="h-4 w-4" /> Importar ventas</Button>
        )}
      </div>
      {salesData.length === 0 ? (
        <div className={cn('text-center py-12 rounded-xl border-2 border-dashed', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400')}>
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Importa datos de ventas en la pestaña Ventas para ver el análisis BCG</p>
          <p className="text-xs mt-2 opacity-60">Columnas: recipeName, quantity, revenue, period</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bcgData.map((d, i) => (
            <div key={i} className={cn('flex items-center justify-between p-3 rounded-xl border', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <span className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>{d.name}</span>
              <div className="flex items-center gap-3">
                <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{d.qty.toFixed(0)} uds · {d.margin.toFixed(1)}%</span>
                <Badge variant="secondary">{d.quadrant}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Versions Tab ─────────────────────────────────────────────────────────────
function VersionsTab({ restaurantId, isDark }) {
  const { success } = useToast()
  const [recipes, setRecipes] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [versions, setVersions] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!restaurantId) return
    return subscribeRecipes(restaurantId, setRecipes)
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId || !selectedId) { setVersions([]); return }
    return subscribeVersions(restaurantId, selectedId, setVersions)
  }, [restaurantId, selectedId])

  const filtered = recipes.filter((r) => !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.code?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Recipe selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Seleccionar receta</Label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar receta..."
            className={cn('w-full px-3 h-8 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-gold-500',
              isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-200')}
          />
          <div className={cn('rounded-xl border overflow-hidden max-h-80 overflow-y-auto', isDark ? 'border-gray-800' : 'border-gray-200')}>
            {filtered.length === 0 ? (
              <p className={cn('text-center py-6 text-sm', isDark ? 'text-gray-600' : 'text-gray-400')}>Sin recetas</p>
            ) : filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm border-b last:border-0 transition-colors',
                  selectedId === r.id
                    ? isDark ? 'bg-gold-900/30 text-gold-300' : 'bg-gold-50 text-gold-800'
                    : isDark ? 'border-gray-800 text-gray-300 hover:bg-gray-800' : 'border-gray-100 text-gray-700 hover:bg-gray-50'
                )}
              >
                <span className="font-medium">{r.name}</span>
                <span className={cn('ml-2 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{r.code} · v{r.version || 1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Versions list */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {selectedId ? `${versions.length} versiones guardadas` : 'Selecciona una receta'}
          </Label>
          <div className={cn('rounded-xl border overflow-hidden max-h-96 overflow-y-auto', isDark ? 'border-gray-800' : 'border-gray-200')}>
            {!selectedId ? (
              <div className={cn('text-center py-12', isDark ? 'text-gray-600' : 'text-gray-400')}>
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecciona una receta para ver su historial</p>
              </div>
            ) : versions.length === 0 ? (
              <p className={cn('text-center py-6 text-sm', isDark ? 'text-gray-600' : 'text-gray-400')}>Sin versiones guardadas</p>
            ) : versions.map((v) => (
              <div key={v.id} className={cn('flex items-center justify-between p-3 border-b last:border-0', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <div>
                  <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>Versión {v.versionNumber}</p>
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    {v.savedAt?.toDate?.()?.toLocaleString() || '—'}
                  </p>
                  {v.ingredients?.length > 0 && (
                    <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-600' : 'text-gray-400')}>
                      {v.ingredients.length} ingredientes
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Personalización Tab (Appearance + Contrasts merged) ──────────────────────
function AppearanceTab({ isDark }) {
  const { i18n } = useTranslation()
  const { theme, setTheme, language, setLanguage, showCosts, setShowCosts, currentRestaurant, accentColor, setAccentColor } = useAppStore()
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!currentRestaurant?.id) return
    setSaving(true)
    try {
      await updateRestaurantSettings(currentRestaurant.id, { showCosts, theme, language })
      success('Configuración guardada')
    } catch { error('Error') } finally { setSaving(false) }
  }

  const handleAccent = async (color) => {
    setAccentColor(color)
    if (currentRestaurant?.id) {
      try { await updateAccentColor(currentRestaurant.id, color) } catch { /* silent */ }
    }
    success('Color de acento actualizado')
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Theme */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Tema</Label>
        <div className="grid grid-cols-2 gap-3">
          {[{ v: 'day', icon: Sun, label: 'Día', preview: 'bg-white border-gray-300' }, { v: 'night', icon: Moon, label: 'Noche', preview: 'bg-gray-900 border-gray-600' }].map(({ v, icon: Icon, label, preview }) => (
            <button key={v} onClick={() => setTheme(v)} className={cn('flex items-center gap-3 p-4 rounded-xl border-2 transition-all', theme === v ? 'border-gold-500 shadow-sm' : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300')}>
              <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center', preview)}>
                <Icon className={cn('h-5 w-5', v === 'day' ? 'text-yellow-500' : 'text-blue-400')} />
              </div>
              <span className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>{label}</span>
              {theme === v && <div className="ml-auto w-2 h-2 rounded-full bg-gold-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Color de acento</Label>
        <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
          Se aplica a botones, pestañas activas, bordes e íconos de acento en toda la aplicación.
        </p>
        <div className="grid grid-cols-8 gap-2">
          {ACCENT_PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => handleAccent(color)}
              title={color}
              className={cn('w-8 h-8 rounded-full transition-all hover:scale-110', accentColor === color && 'ring-4 ring-offset-2 scale-110')}
              style={{ background: color, '--tw-ring-color': color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor || '#d97706'}
            onChange={(e) => handleAccent(e.target.value)}
            className="w-10 h-9 rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--accent)' }}
          />
          <span className={cn('text-sm font-mono', isDark ? 'text-gray-300' : 'text-gray-700')}>{accentColor || '#d97706'}</span>
        </div>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Idioma</Label>
        <Select value={language} onValueChange={(v) => { setLanguage(v); i18n.changeLanguage(v) }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="es">🇪🇸 Español</SelectItem>
            <SelectItem value="en">🇺🇸 English</SelectItem>
            <SelectItem value="pt">🇧🇷 Português</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Show costs */}
      <div className={cn('flex items-center justify-between p-4 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
        <div>
          <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>Mostrar costos a chefs</p>
          <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>Los chefs verán precios y márgenes</p>
        </div>
        <Switch checked={showCosts} onCheckedChange={setShowCosts} />
      </div>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
    </div>
  )
}

// ── Main ConfigModal ──────────────────────────────────────────────────────────
export function ConfigModal() {
  const { configOpen, configTab, setConfigTab, closeConfig, currentRestaurant, theme } = useAppStore()
  const { isAdmin } = useAuth()
  const isDark = theme === 'night'

  if (!configOpen) return null

  const tabs = isAdmin ? TABS : TABS.filter((t) => !['users','subscription'].includes(t.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeConfig} />

      {/* Panel */}
      <div className={cn(
        'relative w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden',
        isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
      )}>
        {/* Left tabs */}
        <div className={cn('w-52 flex-shrink-0 flex flex-col border-r p-3 gap-1', isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-100 bg-gray-50')}>
          {/* Header with close button */}
          <div className="px-2 pb-3 pt-1 flex items-center justify-between">
            <p className={cn('font-display text-base font-bold', isDark ? 'text-white' : 'text-gray-900')}>Configuración</p>
            <button
              onClick={closeConfig}
              className={cn(
                'min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0',
                isDark ? 'text-gray-500 hover:bg-gray-800 hover:text-white' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700'
              )}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {tabs.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setConfigTab(id)} className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left',
              configTab === id
                ? 'text-white shadow-sm'
                : isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-white hover:text-gray-900'
            )}
            style={configTab === id ? { backgroundColor: 'var(--accent, #d97706)' } : {}}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Content — ingredients tab gets full-height flex control, others get padding + y-scroll */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {configTab === 'ingredients' ? (
            <IngredientsTab restaurantId={currentRestaurant?.id} isDark={isDark} />
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              {configTab === 'mp_categories' && <MpCategoriesTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
              {configTab === 'units' && <UnitsTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
              {configTab === 'categories' && <CategoriesTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
              {configTab === 'suppliers' && <SuppliersTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
              {configTab === 'import' && <ImportTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
              {configTab === 'sales' && <SalesTab restaurantId={currentRestaurant?.id} isDark={isDark} onViewBCG={() => setConfigTab('analytics')} />}
              {configTab === 'analytics' && <AnalyticsTab restaurantId={currentRestaurant?.id} isDark={isDark} onGoToSales={() => setConfigTab('sales')} />}
              {configTab === 'recipes' && <RecipeManagementTab restaurantId={currentRestaurant?.id} isDark={isDark} onClose={closeConfig} />}
              {configTab === 'versions' && <VersionsTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
              {configTab === 'appearance' && <AppearanceTab isDark={isDark} />}
              {configTab === 'users' && (
                <div className={cn('text-center py-16', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Gestión de usuarios — próximamente</p>
                </div>
              )}
              {configTab === 'subscription' && (
                <div className={cn('text-center py-16', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Gestión de suscripciones — próximamente</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
