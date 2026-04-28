import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { X, Package, Ruler, Tag, Users, BarChart3, Settings, CreditCard, Sun, Moon, Plus, Pencil, Trash2, Upload, Download, ChevronUp, ChevronDown, ChevronRight, History, ShoppingCart, Palette, FileText, ToggleLeft, ToggleRight, Truck, LayoutGrid, List as ListIcon, GripVertical, FolderOpen, FileUp, Store, ExternalLink, SlidersHorizontal, FileSpreadsheet, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import BulkImportTab from '../BulkImportTab'
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

import { useAppStore, DEFAULT_ACCENT_DAY, DEFAULT_ACCENT_NIGHT } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useTableSort } from '../../hooks/useTableSort.jsx'
import { cn, formatNumber, toTitleCase } from '../../lib/utils'
import { calcRecipeTotalCost } from '../../utils/costUtils'
import {
  subscribeIngredients, createIngredient, updateIngredient, deleteIngredient,
  importIngredients, subscribeCategories, createCategory, updateCategory, deleteCategory,
  updateCategoryOrder,
  subscribeRecipes, subscribeSalesData, importSalesData, getNextIngredientCode,
  getNextCategoryCode, getNextRecipeCode,
  updateRestaurantSettings, subscribeVersions, toggleRecipeActive, updateAccentColor,
  subscribeMpCategories, getNextMpCategoryCode, createMpCategory, updateMpCategory,
  deleteMpCategory, checkMpCategoryInUse,
} from '../../services/restaurants'
import { setMasterRole, createUserWithRole, updateUserRole } from '../../services/auth'
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../../lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import {
  subscribeSuppliers, createSupplier, updateSupplier, deleteSupplier, getNextSupplierCode,
} from '../../services/suppliers'
import { subscribeUnits, createUnit, updateUnit, deleteUnit, getNextUnitCode, DEFAULT_UNITS } from '../../services/units'
import { logAction, detectChanges, getAuditLogs } from '../../services/auditService'
import { useToast } from '../ui/toast'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'

const PARAM_TABS = [
  { id: 'ingredients',   icon: Package,   label: 'Materias primas' },
  { id: 'mp_categories', icon: FolderOpen, label: 'Categorías MP' },
  { id: 'units',         icon: Ruler,      label: 'Unidades' },
  { id: 'categories',    icon: Tag,        label: 'Menús' },
  { id: 'suppliers',     icon: Truck,      label: 'Proveedores' },
  { id: 'import',        icon: FileUp,     label: 'Importación masiva' },
  { id: 'recipes',       icon: FileText,   label: 'Gestión recetas' },
]

const TABS = [
  { id: 'summary',          icon: FileSpreadsheet, label: 'Resumen' },
  { id: 'sales',            icon: ShoppingCart, label: 'Ventas' },
  { id: 'analytics',        icon: BarChart3,    label: 'Análisis BCG' },
  { id: 'versions',         icon: History,      label: 'Historial versiones' },
  { id: 'users',            icon: Users,        label: 'Usuarios' },
  { id: 'appearance',       icon: Settings,     label: 'Personalización', masterOnly: true },
  { id: 'subscription',     icon: CreditCard,   label: 'Suscripción' },
  { id: 'restaurants_link', icon: Store,        label: 'Restaurantes', masterOnly: true },
]

const ACCENT_PALETTE = [
  '#0833A2','#EA580C','#d97706','#f59e0b','#f97316',
  '#ef4444','#e11d48','#3b82f6','#0ea5e9','#06b6d4',
  '#14b8a6','#10b981','#22c55e','#84cc16','#78716c',
]


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
  const { userProfile } = useAppStore()
  const [ingredients, setIngredients] = useState([])
  const [units, setUnits] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'create' | 'edit'
  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem('mp-display-mode') || 'list')
  const [saving, setSaving] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [dupErrors, setDupErrors] = useState({})
  const scrollBodyRef = useRef(null)
  const { sorted, toggleSort, SortIcon } = useTableSort(ingredients, 'code')

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
        const fieldChanges = detectChanges(editing, payload, [
          'name', 'useUnit', 'quantityPerPresentation', 'value', 'pricePerUnit', 'category', 'supplier',
        ])
        await updateIngredient(restaurantId, editing.id, payload)
        await logAction({
          restaurantId, userId: userProfile?.uid, userName: userProfile?.name || userProfile?.email,
          userRole: userProfile?.role, action: 'edit', module: 'materia',
          entityId: editing.id, entityName: payload.name, entityCode: editing.code || nextCode,
          changes: fieldChanges,
        })
      } else {
        const ref = await createIngredient(restaurantId, { ...payload, code: nextCode })
        await logAction({
          restaurantId, userId: userProfile?.uid, userName: userProfile?.name || userProfile?.email,
          userRole: userProfile?.role, action: 'create', module: 'materia',
          entityId: ref?.id || null, entityName: payload.name, entityCode: nextCode,
          changes: [],
        })
      }
      success('Guardado correctamente')
      goToList()
    } catch { error('Error al guardar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta materia prima?')) return
    try {
      const target = ingredients.find((i) => i.id === id)
      await deleteIngredient(restaurantId, id)
      await logAction({
        restaurantId, userId: userProfile?.uid, userName: userProfile?.name || userProfile?.email,
        userRole: userProfile?.role, action: 'delete', module: 'materia',
        entityId: id, entityName: target?.name, entityCode: target?.code, changes: [],
      })
      success('Eliminado')
    } catch { error('Error') }
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

          {/* Fila 1: Código · Referencia */}
          <div className="row g-3">
            <div className="col-auto" style={{ minWidth: '140px' }}>
              <Label className="form-label">Código</Label>
              <div className={cn('h-9 flex items-center px-3 rounded-lg border text-xs font-mono font-semibold', isDark ? 'bg-gray-700 border-gray-600 text-gold-400' : 'bg-gray-100 border-gray-200 text-gold-700')}>
                {nextCode}
              </div>
            </div>
            <div className="col">
              <Label className="form-label">Referencia</Label>
              <Input
                {...register('reference')}
                placeholder="MP1000001"
                className={dupErrors.reference ? 'border-red-400' : ''}
                onBlur={(e) => checkDuplicate('reference', e.target.value)}
              />
              {dupErrors.reference && <p className="text-xs text-red-500">{dupErrors.reference}</p>}
            </div>
          </div>

          {/* Fila 2: Nombre — ancho completo */}
          <div className="row g-3">
            <div className="col-12">
              <Label className="form-label">Nombre *</Label>
              <Input
                {...register('name')}
                placeholder="Harina de trigo"
                className={errors.name || dupErrors.name ? 'border-red-400' : ''}
                onChange={(e) => { const v = e.target.value.toUpperCase(); setValue('name', v) }}
                onBlur={(e) => { const v = e.target.value.toUpperCase(); setValue('name', v); checkDuplicate('name', v) }}
              />
              {(errors.name || dupErrors.name) && <p className="text-xs text-red-500">{errors.name?.message || dupErrors.name}</p>}
            </div>
          </div>

          {/* Fila 3: Unidad · Cant./Presentación · Valor · Precio/Unidad */}
          <div className="row g-3">
            <div className="col-md-3 col-6">
              <Label className="form-label">Unidad *</Label>
              <Select value={watch('unit') || ''} onValueChange={(v) => {
                const found = units.find((u) => u.abbreviation === v)
                setValue('unit', v); setValue('unitName', found?.name || v)
                setValue('useUnit', v); setValue('purchaseUnit', v)
              }}>
                <SelectTrigger className={errors.unit ? 'border-red-400' : ''}><SelectValue placeholder="kg, lt..." /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</SelectItem>)}
                  {units.length === 0 && <SelectItem value="und">und</SelectItem>}
                </SelectContent>
              </Select>
              {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit.message}</p>}
            </div>
            <div className="col-md-3 col-6">
              <Label className="form-label">Cant./Presentación *</Label>
              <Input type="number" step="0.001" min="0.001" {...register('quantityPerPresentation')} className={errors.quantityPerPresentation ? 'border-red-400' : ''} />
              {errors.quantityPerPresentation && <p className="text-xs text-red-500 mt-1">{errors.quantityPerPresentation.message}</p>}
            </div>
            <div className="col-md-3 col-6">
              <Label className="form-label">Valor presentación *</Label>
              <Input type="number" step="0.01" min="0" {...register('value')} className={errors.value ? 'border-red-400' : ''} />
              {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value.message}</p>}
            </div>
            <div className="col-md-3 col-6">
              <Label className="form-label">Precio por {watchedUnitName || 'unidad'}</Label>
              <Input
                readOnly
                value={pricePerUnit > 0 ? pricePerUnit.toFixed(2) : '—'}
                style={{ color: 'var(--accent)', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Fila 4: Categoría · Proveedor */}
          <div className="row g-3">
            <div className="col-md-6 col-12">
              <Label className="form-label">Categoría</Label>
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
            <div className="col-md-6 col-12">
              <Label className="form-label">Proveedor</Label>
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
        #materias-scroll-body::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 4px; min-width: 40px; }
        #materias-scroll-body { scrollbar-width: auto; scrollbar-color: var(--accent) ${scrollTrack}; }
      `}</style>

      {/* Toolbar — never scrolls */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
            <button onClick={() => { setDisplayMode('grid'); localStorage.setItem('mp-display-mode', 'grid') }} className="p-1.5 rounded-md transition-colors" style={displayMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
              <LayoutGrid className={cn('h-3.5 w-3.5', displayMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
            </button>
            <button onClick={() => { setDisplayMode('list'); localStorage.setItem('mp-display-mode', 'list') }} className="p-1.5 rounded-md transition-colors" style={displayMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
              <ListIcon className={cn('h-3.5 w-3.5', displayMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
            </button>
          </div>
          <div className="relative flex-1 min-w-40">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código, item..."
              className={cn('w-full pl-3 pr-3 h-8 text-sm rounded-lg border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-200 placeholder:text-gray-400')}
            />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nueva materia prima</Button>
        </div>
      </div>

      {/* Grid view */}
      {displayMode === 'grid' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)', fontSize: '0.875rem' }}>Sin resultados</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {filtered.map((ing) => (
                <div key={ing.id} className="group" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 12, overflow: 'hidden', transition: 'all 0.18s', cursor: 'pointer' }}
                  onClick={() => openEdit(ing)}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)' }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ height: 4, background: 'var(--accent)' }} />
                  <div style={{ padding: '10px 12px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff', display: 'inline-block', marginBottom: 6 }}>{ing.code}</span>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.4em' }}>
                      {ing.name || ing.description}
                    </p>
                    {ing.category && (
                      <p style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 4 }}>{ing.category}</p>
                    )}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${isDark ? '#374151' : '#f3f4f6'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '0.58rem', color: 'var(--t3)', marginBottom: 1 }}>Precio/{ing.useUnit || ing.unit || 'u'}</p>
                        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)' }}>
                          {ing.pricePerUnit != null ? `$${Number(ing.pricePerUnit).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table — fills remaining height, scrolls both axes */}
      <div
        id="materias-scroll-body"
        ref={scrollBodyRef}
        style={{ flex: 1, overflowX: 'scroll', overflowY: 'auto', display: displayMode === 'grid' ? 'none' : undefined }}
      >
        <table style={{ width: '100%', minWidth: '900px', tableLayout: 'auto', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
                  onClick={() => toggleSort(k)}
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
                  {label}<SortIcon field={k} />
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
                  background: rowBg,
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  boxShadow: '2px 0 6px rgba(0,0,0,0.12)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--accent)', color: '#fff' }}>{ing.code}</span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: isDark ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>{ing.reference || '—'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: isDark ? '#f9fafb' : '#1f2937', whiteSpace: 'nowrap', minWidth: '160px' }}>{ing.name || ing.description}</td>
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
  const [unitCode, setUnitCode] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('units-view-mode') || 'grid')

  const schema = z.object({
    name: z.string().min(2),
    abbreviation: z.string().min(1).max(6),
    equivalence: z.coerce.number().min(0.0001).optional(),
  })
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) })
  const { sorted: sortedUnits, toggleSort: toggleUnitSort, SortIcon: UnitSortIcon } = useTableSort(units, 'code')

  useEffect(() => {
    if (!restaurantId) return
    return subscribeUnits(restaurantId, setUnits)
  }, [restaurantId])

  const setView = (v) => { localStorage.setItem('units-view-mode', v); setViewMode(v) }

  const seedDefaults = async () => {
    try {
      await Promise.all(DEFAULT_UNITS.map((u) => createUnit(restaurantId, u)))
      success('Unidades predeterminadas agregadas')
    } catch { error('Error') }
  }

  const openNew = async () => {
    setEditing(null); reset({ name: '', abbreviation: '', equivalence: 1 })
    const code = await getNextUnitCode(restaurantId).catch(() => '')
    setUnitCode(code); setShowForm(true)
  }

  const openEdit = (u) => {
    setEditing(u); setUnitCode(u.code || ''); reset({ name: u.name, abbreviation: u.abbreviation || '', equivalence: u.equivalence ?? 1 }); setShowForm(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { name: toTitleCase(data.name), abbreviation: data.abbreviation.toUpperCase(), code: unitCode, equivalence: parseFloat(data.equivalence) || 1 }
      if (editing) await updateUnit(restaurantId, editing.id, payload)
      else await createUnit(restaurantId, payload)
      success('Guardado')
      setShowForm(false); reset(); setEditing(null)
    } catch { error('Error') }
    finally { setSaving(false) }
  }

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(units.map((u) => ({
      CODIGO: u.code || '',
      MEDIDA: u.abbreviation || '',
      DESCRIPCION: u.name || '',
      EQUIVALENCIA: u.equivalence ?? 1,
    })))
    ws['!cols'] = Array(4).fill({ wch: 18 })
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Unidades')
    XLSX.writeFile(wb, 'unidades_recetariopro.xlsx')
  }

  const handleDelete = async (u) => {
    if (!confirm(`¿Eliminar "${u.name}"?`)) return
    try { await deleteUnit(restaurantId, u.id); success('Eliminada') } catch { error('Error') }
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
          {units.length === 0 && <Button variant="outline" size="sm" onClick={seedDefaults}>Cargar predeterminadas</Button>}
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nueva</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="row g-3 mb-3">
            <div className="col-md-3 col-6">
              <Label className="form-label">Código</Label>
              <div className={cn('px-3 py-2 h-9 rounded-lg text-sm font-mono font-bold flex items-center', isDark ? 'bg-gray-700 text-gold-400' : 'bg-gray-100 text-gold-700')}>
                {unitCode || '—'}
              </div>
            </div>
            <div className="col-md-3 col-6">
              <Label className="form-label">Nombre *</Label>
              <Input {...register('name')} onBlur={(e) => { const v = toTitleCase(e.target.value); if (v) setValue('name', v) }} placeholder="Kilogramo" className={errors.name ? 'border-red-400' : ''} />
            </div>
            <div className="col-md-3 col-6">
              <Label className="form-label">Abreviatura *</Label>
              <Input {...register('abbreviation')} onChange={(e) => setValue('abbreviation', e.target.value.toUpperCase())} placeholder="KG" className={errors.abbreviation ? 'border-red-400' : ''} />
            </div>
            <div className="col-md-3 col-6">
              <Label className="form-label">Equivalencia</Label>
              <Input {...register('equivalence')} type="number" step="any" min="0.0001" placeholder="1" className={errors.equivalence ? 'border-red-400' : ''} />
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            {editing && (
              <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(editing)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : 'Guardar'}</Button>
            </div>
          </div>
        </form>
      )}

      {units.length === 0 && !showForm ? (
        <div className={cn('text-center py-12 rounded-xl border-2 border-dashed', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400')}>
          <p className="text-sm font-medium mb-1">Sin unidades</p>
          <p className="text-xs">Carga las predeterminadas o crea una nueva</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {units.map((u) => (
            <div key={u.id} onClick={() => openEdit(u)}
              className={cn('rounded-xl border overflow-hidden cursor-pointer', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ transition: 'all 0.18s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = isDark ? '#1f2937' : '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div className="h-1.5" style={{ background: 'var(--accent)' }} />
              <div className="p-2.5">
                {u.code && <span className="font-mono text-xs px-1.5 py-0.5 rounded inline-block mb-1" style={{ background: 'var(--accent)', color: '#fff' }}>{u.code}</span>}
                <p className="font-mono font-bold text-base leading-tight" style={{ color: 'var(--accent)' }}>{u.abbreviation}</p>
                <p className={cn('text-xs mt-0.5', isDark ? 'text-white' : 'text-gray-800')} style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>{u.name}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
          <div className={cn('flex items-center gap-3 px-3 py-2 border-b', isDark ? 'border-gray-700 text-gray-500 bg-gray-800/50' : 'border-gray-200 text-gray-400 bg-gray-50')} style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span className="w-20 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleUnitSort('code')}>Código<UnitSortIcon field="code" /></span>
            <span className="flex-1 cursor-pointer select-none" onClick={() => toggleUnitSort('name')}>Nombre<UnitSortIcon field="name" /></span>
            <span className="w-20 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleUnitSort('abbreviation')}>Abrev.<UnitSortIcon field="abbreviation" /></span>
            <span className="w-20 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleUnitSort('equivalence')}>Equiv.<UnitSortIcon field="equivalence" /></span>
          </div>
          {sortedUnits.map((u) => (
            <div key={u.id} onClick={() => openEdit(u)}
              className={cn('flex items-center gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer', isDark ? 'border-gray-800' : 'border-gray-100')}
              onMouseOver={e => e.currentTarget.style.background = isDark ? '#1f2937' : '#f9fafb'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 w-20" style={{ background: 'var(--accent)', color: '#fff' }}>{u.code || '—'}</span>
              <span className={cn('flex-1 text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>{u.name}</span>
              <span className="font-mono text-xs font-bold w-20 flex-shrink-0" style={{ color: 'var(--accent)' }}>{u.abbreviation}</span>
              <span className={cn('text-xs w-20 flex-shrink-0', isDark ? 'text-gray-400' : 'text-gray-600')}>{u.equivalence ?? 1}</span>
            </div>
          ))}
        </div>
      )}
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
  const { sorted: sortedMpCats, toggleSort: toggleMpCatSort, SortIcon: MpCatSortIcon } = useTableSort(categories, 'code')

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
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="row g-3 mb-3">
            <div className="col-auto" style={{ minWidth: '100px' }}>
              <Label className="form-label">Código</Label>
              <div className={cn('px-3 py-2 h-9 rounded-lg text-sm font-mono font-bold flex items-center', isDark ? 'bg-gray-700 text-gold-400' : 'bg-gray-100 text-gold-700')}>
                {catCode || '—'}
              </div>
            </div>
            <div className="col">
              <Label className="form-label">Nombre *</Label>
              <Input
                {...register('name')}
                onChange={(e) => { const v = toTitleCase(e.target.value); setValue('name', v); setDupError(null) }}
                onBlur={(e) => checkDup(e.target.value)}
                className={errors.name || dupError ? 'border-red-400' : ''}
                placeholder="Nombre de la categoría"
              />
              {(errors.name || dupError) && <p className="text-xs text-red-500 mt-1">{errors.name?.message || dupError}</p>}
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            {editing && (
              <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(editing)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saving || !!dupError}>{saving ? '...' : 'Guardar'}</Button>
            </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {categories.map((cat) => (
            <div key={cat.id} onClick={() => openEdit(cat)}
              className={cn('group rounded-xl border overflow-hidden cursor-pointer', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ transition: 'all 0.18s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = isDark ? '#1f2937' : '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div className="h-1.5" style={{ background: 'var(--accent)' }} />
              <div className="p-2.5">
                {cat.code && <span className="font-mono text-xs px-1.5 py-0.5 rounded inline-block mb-1" style={{ background: 'var(--accent)', color: '#fff' }}>{cat.code}</span>}
                <p className={cn('text-xs font-medium', isDark ? 'text-white' : 'text-gray-800')} style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>{cat.name}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
          <div className={cn('flex items-center gap-3 px-3 py-2 border-b', isDark ? 'border-gray-700 text-gray-500 bg-gray-800/50' : 'border-gray-200 text-gray-400 bg-gray-50')} style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span className="w-20 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleMpCatSort('code')}>Código<MpCatSortIcon field="code" /></span>
            <span className="flex-1 cursor-pointer select-none" onClick={() => toggleMpCatSort('name')}>Nombre<MpCatSortIcon field="name" /></span>
            <span className="w-16 flex-shrink-0 text-right">Acciones</span>
          </div>
          {sortedMpCats.map((cat) => (
            <div key={cat.id} className={cn('flex items-center gap-3 px-3 py-2.5 border-b last:border-0', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 w-20" style={{ background: 'var(--accent)', color: '#fff' }}>{cat.code || '—'}</span>
              <span className={cn('flex-1 text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>{cat.name}</span>
              <div className="flex gap-1 w-16 justify-end flex-shrink-0">
                <button onClick={() => openEdit(cat)} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(cat)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
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
        <button onClick={onEdit} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )
  }
  return (
    <div ref={setNodeRef} style={style} onClick={onEdit}
      className={cn('group rounded-xl border overflow-hidden cursor-pointer', isDark ? 'border-gray-800' : 'border-gray-200')}
      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseOut={e => { e.currentTarget.style.borderColor = isDark ? '#1f2937' : '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div className="h-1.5" style={{ background: 'var(--accent)' }} />
      <div className="p-2.5">
        {cat.code && <span className="font-mono text-xs px-1.5 py-0.5 rounded inline-block mb-1" style={{ background: 'var(--accent)', color: '#fff' }}>{cat.code}</span>}
        <p className={cn('text-xs font-medium', isDark ? 'text-white' : 'text-gray-800')} style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>{cat.name}</p>
      </div>
    </div>
  )
}

async function getNextMenuCode(restaurantId) {
  try {
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'categories'))
    const codes = snap.docs
      .map(d => d.data().code || '')
      .filter(c => c.startsWith('MEN'))
      .map(c => parseInt(c.replace('MEN', '')) || 0)
    const next = codes.length > 0 ? Math.max(...codes) + 1 : 1
    return `MEN${String(next).padStart(3, '0')}`
  } catch {
    return `MEN${String(Date.now()).slice(-3)}`
  }
}

function CategoriesTab({ restaurantId, isDark }) {
  const { success, error } = useToast()
  const { userProfile } = useAppStore()
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [catCode, setCatCode] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cfg_cat_view') || 'grid')

  const sensors = useSens(useSen(PtrSensor, { activationConstraint: { distance: 5 } }))
  const schema = z.object({ name: z.string().min(2) })
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) })
  const { sorted: sortedMenus, toggleSort: toggleMenuSort, SortIcon: MenuSortIcon } = useTableSort(categories, 'code')

  useEffect(() => { if (!restaurantId) return; return subscribeCategories(restaurantId, setCategories) }, [restaurantId])

  const openNew = async () => {
    setEditing(null); reset({ name: '' })
    setCatCode('Generando...')
    setShowForm(true)
    const code = await getNextMenuCode(restaurantId)
    setCatCode(code)
  }
  const openEdit = (c) => { setEditing(c); setCatCode(c.code || ''); reset({ name: c.name }); setShowForm(true) }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { code: catCode, name: data.name.charAt(0).toUpperCase() + data.name.slice(1).toLowerCase() }
      if (editing) {
        const fieldChanges = detectChanges(editing, payload, ['name', 'code'])
        await updateCategory(restaurantId, editing.id, payload)
        await logAction({
          restaurantId, userId: userProfile?.uid, userName: userProfile?.name || userProfile?.email,
          userRole: userProfile?.role, action: 'edit', module: 'menu',
          entityId: editing.id, entityName: payload.name, entityCode: payload.code, changes: fieldChanges,
        })
      } else {
        const ref = await createCategory(restaurantId, { ...payload, order: Date.now() })
        await logAction({
          restaurantId, userId: userProfile?.uid, userName: userProfile?.name || userProfile?.email,
          userRole: userProfile?.role, action: 'create', module: 'menu',
          entityId: ref?.id || null, entityName: payload.name, entityCode: payload.code, changes: [],
        })
      }
      success('Guardado'); setShowForm(false); reset(); setEditing(null)
    } catch { error('Error') } finally { setSaving(false) }
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldI = sortedMenus.findIndex((c) => c.id === active.id)
    const newI = sortedMenus.findIndex((c) => c.id === over.id)
    const newSorted = arrMove(sortedMenus, oldI, newI)
    setCategories(newSorted)
    updateCategoryOrder(restaurantId, newSorted.map((c) => c.id))
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
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nuevo menú</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="row g-3 mb-3">
            <div className="col-auto" style={{ minWidth: '120px' }}>
              <Label className="form-label">Código</Label>
              <input
                readOnly
                value={catCode || '—'}
                className={cn('px-3 py-2 h-9 rounded-lg text-sm font-mono font-bold w-full border-0 outline-none', isDark ? 'bg-gray-700 text-gold-400' : 'bg-gray-100 text-gold-700')}
              />
            </div>
            <div className="col">
              <Label className="form-label">Nombre *</Label>
              <Input {...register('name')}
                onChange={(e) => { setValue('name', toTitleCase(e.target.value)) }}
                className={errors.name ? 'border-red-400' : ''} placeholder="Nombre del menú" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            {editing && (
              <Button type="button" variant="outline" size="sm"
                onClick={async () => { if (!confirm('¿Eliminar este menú?')) return; try { await deleteCategory(restaurantId, editing.id); setShowForm(false); setEditing(null) } catch {} }}
                style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : 'Guardar'}</Button>
            </div>
          </div>
        </form>
      )}

      <DndCtx sensors={sensors} collisionDetection={closestCtr} onDragEnd={handleDragEnd}>
        <SortCtx items={sortedMenus.map((c) => c.id)} strategy={vList}>
          {viewMode === 'grid' ? (
            <>
              <p className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>Menús registrados ({categories.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {sortedMenus.map((cat) => (
                  <SortableCatItem key={cat.id} cat={cat} isDark={isDark} mode="grid"
                    onEdit={() => openEdit(cat)}
                    onDelete={async () => { if (!confirm('¿Eliminar este menú?')) return; try { await deleteCategory(restaurantId, cat.id); await logAction({ restaurantId, userId: userProfile?.uid, userName: userProfile?.name || userProfile?.email, userRole: userProfile?.role, action: 'delete', module: 'menu', entityId: cat.id, entityName: cat.name, entityCode: cat.code, changes: [] }) } catch {} }} />
                ))}
              </div>
            </>
          ) : (
            <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
              <div className={cn('flex items-center gap-2 px-3 py-2 border-b', isDark ? 'border-gray-700 text-gray-500 bg-gray-800/50' : 'border-gray-200 text-gray-400 bg-gray-50')} style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <span className="w-5 flex-shrink-0" />
                <span className="w-20 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleMenuSort('code')}>Código<MenuSortIcon field="code" /></span>
                <span className="flex-1 cursor-pointer select-none" onClick={() => toggleMenuSort('name')}>Nombre<MenuSortIcon field="name" /></span>
                <span className="w-16 flex-shrink-0 text-right">Acciones</span>
              </div>
              {sortedMenus.map((cat) => (
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
  const { sorted: sortedSuppliers, toggleSort: toggleSupSort, SortIcon: SupSortIcon } = useTableSort(suppliers, 'code')

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
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Nuevo proveedor</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className={cn('p-4 rounded-xl border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="row g-3 mb-3">
            <div className="col-auto" style={{ minWidth: '100px' }}>
              <Label className="form-label">Código</Label>
              <div className={cn('px-3 py-2 h-9 rounded-lg text-sm font-mono font-bold flex items-center', isDark ? 'bg-gray-700 text-gold-400' : 'bg-gray-100 text-gold-700')}>
                {nextCode || '—'}
              </div>
            </div>
            <div className="col-12 col-md">
              <Label className="form-label">Nombre *</Label>
              <Input {...register('name')} className={errors.name ? 'border-red-400' : ''} placeholder="Nombre del proveedor" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-md-6 col-12">
              <Label className="form-label">Contacto</Label>
              <Input {...register('contact')} placeholder="Nombre del contacto" />
            </div>
            <div className="col-md-6 col-12">
              <Label className="form-label">Teléfono</Label>
              <Input {...register('phone')} placeholder="+34 600 000 000" />
            </div>
            <div className="col-md-6 col-12">
              <Label className="form-label">Email</Label>
              <Input {...register('email')} placeholder="email@proveedor.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div className="col-md-6 col-12">
              <Label className="form-label">Dirección</Label>
              <Input {...register('address')} placeholder="Dirección" />
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            {editing && (
              <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(editing.id)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); reset(); setEditing(null) }}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : 'Guardar'}</Button>
            </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {suppliers.map((s) => (
            <div key={s.id} onClick={() => openEdit(s)}
              className={cn('rounded-xl border overflow-hidden cursor-pointer', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ transition: 'all 0.18s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = isDark ? '#1f2937' : '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ height: 6, background: 'var(--accent)' }} />
              <div style={{ padding: '10px 12px' }}>
                {s.code && <span className="font-mono text-xs px-1.5 py-0.5 rounded inline-block mb-1" style={{ background: 'var(--accent)', color: '#fff' }}>{s.code}</span>}
                <p className={cn('text-xs font-medium', isDark ? 'text-white' : 'text-gray-800')} style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>{s.name}</p>
                {s.contact && <p style={{ fontSize: '0.65rem', color: 'var(--t3)', marginTop: 3 }}>{s.contact}</p>}
                {s.phone && <p style={{ fontSize: '0.65rem', color: 'var(--t3)' }}>{s.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
          <div className={cn('flex items-center gap-3 px-3 py-2 border-b', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')} style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: isDark ? '#6b7280' : '#9ca3af' }}>
            <span className="w-20 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleSupSort('code')}>Código<SupSortIcon field="code" /></span>
            <span className="flex-1 cursor-pointer select-none" onClick={() => toggleSupSort('name')}>Nombre<SupSortIcon field="name" /></span>
            <span className="hidden sm:block w-32 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleSupSort('contact')}>Contacto<SupSortIcon field="contact" /></span>
            <span className="hidden md:block w-32 flex-shrink-0 cursor-pointer select-none" onClick={() => toggleSupSort('phone')}>Teléfono<SupSortIcon field="phone" /></span>
            <span className="w-12 flex-shrink-0" />
          </div>
          {sortedSuppliers.map((s) => (
            <div key={s.id} className={cn('flex items-center gap-3 px-3 py-2.5 border-b last:border-0', isDark ? 'border-gray-800' : 'border-gray-100')}>
              <span className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0 w-20" style={{ background: 'var(--accent)', color: '#fff' }}>{s.code || '—'}</span>
              <span className={cn('flex-1 text-sm font-medium', isDark ? 'text-white' : 'text-gray-800')}>{s.name}</span>
              {s.contact && <span className={cn('text-xs hidden sm:block w-32 flex-shrink-0 truncate', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.contact}</span>}
              {s.phone && <span className={cn('text-xs hidden md:block w-32 flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.phone}</span>}
              <div className="flex gap-1 w-12 flex-shrink-0 justify-end">
                <button onClick={() => openEdit(s)} className="p-1 rounded text-gray-400 hover:text-gray-600"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Recipe Management Tab ─────────────────────────────────────────────────────
const GESTION_DEFAULT_COLS = [
  { id: 'foto',         label: 'Foto',         visible: true, sortable: false },
  { id: 'codigo',       label: 'Código',        visible: true, sortable: true  },
  { id: 'nombre',       label: 'Nombre',        visible: true, sortable: true  },
  { id: 'menu',         label: 'Menú',          visible: true, sortable: true  },
  { id: 'costo',        label: 'Costo',         visible: true, sortable: true  },
  { id: 'precio',       label: 'Precio',        visible: true, sortable: true  },
  { id: 'margen',       label: 'Margen %',      visible: true, sortable: true  },
  { id: 'creacion',     label: 'Creación',      visible: true, sortable: true  },
  { id: 'verificacion', label: 'Verificación',  visible: true, sortable: true  },
]

// col id → recipe field name used by useTableSort
const GESTION_FIELD_MAP = {
  codigo:       'code',
  nombre:       'name',
  menu:         'menuName',
  costo:        'totalCost',
  precio:       'sellingPrice',
  margen:       'sellingPrice', // computed, handled in sort override
  creacion:     'createdAt',
  verificacion: 'verified',
}

function RecipeManagementTab({ restaurantId, isDark, onClose }) {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const { currentRestaurant } = useAppStore()
  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [menuFilter, setMenuFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('gestion-view-mode') || 'list')
  const setView = (mode) => { setViewMode(mode); localStorage.setItem('gestion-view-mode', mode) }

  const [columns, setColumns] = useState(() => {
    try {
      // Intentar cargar desde Firestore (en currentRestaurant) o fallback a localStorage
      const fromFirestore = currentRestaurant?.settings?.gestionColumnsOrder
      const raw = fromFirestore || localStorage.getItem('gestion-columns-order')
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        const merged = parsed
          .filter(c => GESTION_DEFAULT_COLS.find(d => d.id === c.id))
          .map(c => ({ ...GESTION_DEFAULT_COLS.find(d => d.id === c.id), visible: c.visible }))
        GESTION_DEFAULT_COLS.forEach(d => { if (!merged.find(c => c.id === d.id)) merged.push(d) })
        return merged
      }
    } catch {}
    return GESTION_DEFAULT_COLS
  })
  const [dragCol, setDragCol] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  useEffect(() => {
    if (!restaurantId) return
    const u1 = subscribeRecipes(restaurantId, setRecipes)
    const u2 = subscribeCategories(restaurantId, setCategories)
    const u3 = subscribeUnits(restaurantId, setUnits)
    return () => { u1(); u2(); u3() }
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

  const { sorted, toggleSort, sortField, sortDir } = useTableSort(filtered, 'name')

  const reorderColumns = (fromId, toId) => {
    if (fromId === toId) return
    const newCols = [...columns]
    const fromIdx = newCols.findIndex(c => c.id === fromId)
    const toIdx = newCols.findIndex(c => c.id === toId)
    const [removed] = newCols.splice(fromIdx, 1)
    newCols.splice(toIdx, 0, removed)
    setColumns(newCols)
    localStorage.setItem('gestion-columns-order', JSON.stringify(newCols))
    if (restaurantId) {
      updateRestaurantSettings(restaurantId, { gestionColumnsOrder: JSON.stringify(newCols) }).catch(() => {})
    }
  }

  const handleEdit = (r) => { onClose(); navigate(`/recipes/${r.id}`, { state: { from: 'gestion' } }) }

  const handleToggle = async (r) => {
    try {
      await toggleRecipeActive(restaurantId, r.id, !r.active)
      success(r.active !== false ? 'Desactivada' : 'Activada')
    } catch { error('Error') }
  }

  const renderCell = (colId, recipe) => {
    switch (colId) {
      case 'foto':
        return (
          <td key={colId} style={{ padding: '8px 12px' }}>
            {recipe.photoURL
              ? <img src={recipe.photoURL} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} alt="" />
              : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'color-mix(in srgb, var(--accent) 8%, var(--bg2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🍽</div>
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
      case 'menu':
        return (
          <td key={colId} style={{ padding: '8px 12px' }}>
            {recipe.menuName ? (
              <span style={{ background: 'var(--goldBg)', border: '1px solid var(--b2)', borderRadius: 6, padding: '2px 8px', fontSize: '0.74rem', color: 'var(--t2)', whiteSpace: 'nowrap' }}>
                {recipe.menuName}
              </span>
            ) : (
              <span style={{ color: 'var(--t3)', fontSize: '0.78rem' }}>—</span>
            )}
          </td>
        )
      case 'costo':
        return (
          <td key={colId} style={{ padding: '8px 12px', color: 'var(--t2)', fontSize: '0.84rem' }}>
            {recipe.totalCost ? `$${Number(recipe.totalCost).toLocaleString('es-CO')}` : '—'}
          </td>
        )
      case 'precio':
        return (
          <td key={colId} style={{ padding: '8px 12px', color: 'var(--accent)', fontWeight: 600, fontSize: '0.84rem' }}>
            {recipe.sellingPrice ? `$${Number(recipe.sellingPrice).toLocaleString('es-CO')}` : '—'}
          </td>
        )
      case 'margen': {
        const costo = recipe.totalCost || 0
        const precio = recipe.sellingPrice || 0
        const margen = precio > 0 ? (((precio - costo) / precio) * 100).toFixed(1) : null
        return (
          <td key={colId} style={{ padding: '8px 12px' }}>
            {margen !== null ? (
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: margen >= 60 ? 'var(--green)' : margen >= 40 ? 'var(--orange)' : 'var(--red)' }}>
                {margen}%
              </span>
            ) : '—'}
          </td>
        )
      }
      case 'creacion':
        return (
          <td key={colId} style={{ padding: '8px 12px', color: 'var(--t3)', fontSize: '0.78rem' }}>
            {recipe.createdAt?.toDate?.()?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'}
          </td>
        )
      case 'verificacion':
        return (
          <td key={colId} style={{ padding: '8px 12px' }}>
            {recipe.verified ? (
              <span style={{ color: 'var(--green)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                ✓ {recipe.verifiedAt?.toDate?.()?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              </span>
            ) : (
              <span style={{ color: 'var(--t3)', fontSize: '0.78rem' }}>Sin verificar</span>
            )}
          </td>
        )
      default:
        return <td key={colId} />
    }
  }

  const thBase = {
    padding: '9px 12px',
    textAlign: 'left',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--t3)',
    fontWeight: 700,
    background: 'color-mix(in srgb, var(--accent) 8%, var(--bg2))',
    borderBottom: '1px solid var(--b1)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }

  return (
    <div className="space-y-4">
      {/* ── Filtros + toggle vista ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Toggle Grid/Lista — siempre a la izquierda */}
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
          <button onClick={() => setView('grid')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
            <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
          <button onClick={() => setView('list')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
            <ListIcon className={cn('h-3.5 w-3.5', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
        </div>
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

      {/* ── Vista Lista ── */}
      {viewMode === 'list' && (
        <div style={{ borderRadius: 12, border: '1px solid var(--b1)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr>
                  {columns.filter(c => c.visible).map((col) => (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={() => setDragCol(col.id)}
                      onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                      onDrop={() => { reorderColumns(dragCol, col.id); setDragCol(null); setDragOver(null) }}
                      onDragEnd={() => { setDragCol(null); setDragOver(null) }}
                      onClick={() => col.sortable && toggleSort(GESTION_FIELD_MAP[col.id] || col.id)}
                      style={{
                        ...thBase,
                        cursor: col.sortable ? 'pointer' : 'grab',
                        background: dragOver === col.id ? (isDark ? '#374151' : '#e9ecef') : 'color-mix(in srgb, var(--accent) 8%, var(--bg2))',
                        borderLeft: dragOver === col.id ? '2px solid var(--accent)' : undefined,
                      }}
                    >
                      {col.label}
                      {col.sortable && sortField === (GESTION_FIELD_MAP[col.id] || col.id) && (
                        <span style={{ marginLeft: 4, color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                      {col.sortable && sortField !== (GESTION_FIELD_MAP[col.id] || col.id) && (
                        <span style={{ marginLeft: 4, color: 'var(--t3)', opacity: 0.5 }}>⇅</span>
                      )}
                    </th>
                  ))}
                  <th style={{ ...thBase, cursor: 'default' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={columns.filter(c => c.visible).length + 1}
                      style={{ textAlign: 'center', padding: '32px 0', color: 'var(--t3)', fontSize: '0.85rem' }}>
                      Sin resultados
                    </td>
                  </tr>
                ) : sorted.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid var(--b1)', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {columns.filter(c => c.visible).map(col => renderCell(col.id, r))}
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleEdit(r)}
                          style={{ border: '1px solid var(--accent)', borderRadius: 6, background: 'transparent', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vista Grid ── */}
      {viewMode === 'grid' && (
        filtered.length === 0
          ? <p className={cn('text-center py-8 text-sm', isDark ? 'text-gray-600' : 'text-gray-400')}>Sin resultados</p>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              {filtered.map((r) => {
                const cost = calcRecipeTotalCost(r)
                const price = parseFloat(r.sellingPrice) || 0
                return (
                  <div
                    key={r.id}
                    onClick={() => handleEdit(r)}
                    style={{
                      border: `1px solid ${isDark ? '#1f2937' : '#f3f4f6'}`,
                      borderTop: '2px solid var(--accent)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: r.active === false
                        ? (isDark ? '#0d1117' : '#f5f5f5')
                        : (isDark ? '#111827' : '#fff'),
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    {r.photoURL
                      ? <img src={r.photoURL} alt={r.name || ''} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: 8, backgroundColor: 'var(--accent)', opacity: 0.25 }} />
                    }
                    <div style={{ padding: 10 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                        {r.isSubRecipe && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--goldBg)', color: 'var(--accent)' }}>
                            Sub-receta
                          </span>
                        )}
                        {r.active === false && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(220,38,38,0.12)', color: 'var(--red, #dc2626)' }}>
                            Inactiva
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.5em' }}>
                        {r.name}
                      </div>
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: '0.6rem', color: 'var(--t3)' }}>Precio</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: price > 0 ? 'var(--accent)' : 'var(--t3)' }}>
                            {price > 0 ? `$${price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: '0.6rem', color: 'var(--t3)' }}>Costo</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: cost > 0 ? 'var(--t2)' : 'var(--t3)' }}>
                            {cost > 0 ? `$${cost.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
      )}

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

// ── Historial / Auditoría Tab ─────────────────────────────────────────────────
function VersionsTab({ restaurantId, isDark }) {
  const { userProfile } = useAppStore()
  const TABS = [
    { id: 'recipe',    label: 'Recetas' },
    { id: 'subrecipe', label: 'Sub-recetas' },
    { id: 'materia',   label: 'Materias Primas' },
    { id: 'menu',      label: 'Menús' },
    { id: 'user',      label: 'Usuarios' },
  ]

  const [activeTab, setActiveTab] = useState('recipe')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalInCollection, setTotalInCollection] = useState(null)
  const [creatingTest, setCreatingTest] = useState(false)

  // Verificar total de documentos en la colección (sin filtro)
  useEffect(() => {
    if (!restaurantId) return
    getDocs(collection(db, 'restaurants', restaurantId, 'audit_logs'))
      .then((snap) => {
        console.log('[historial] Total documentos en audit_logs:', snap.size)
        setTotalInCollection(snap.size)
      })
      .catch((err) => console.error('[historial] Error verificando colección:', err))
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return
    console.log('[historial] Cargando módulo:', activeTab, '| restaurantId:', restaurantId)
    setLoading(true)
    getAuditLogs(restaurantId, activeTab, 100)
      .then((result) => { console.log('[historial] Logs recibidos:', result.length); setLogs(result) })
      .finally(() => setLoading(false))
  }, [restaurantId, activeTab])

  const handleCreateTestLog = async () => {
    setCreatingTest(true)
    await logAction({
      restaurantId,
      userId: userProfile?.uid || 'test',
      userName: userProfile?.name || userProfile?.email || 'Test',
      userRole: userProfile?.role || 'admin',
      action: 'create',
      module: activeTab,
      entityId: 'test-' + Date.now(),
      entityName: 'Log de prueba (' + activeTab + ')',
      entityCode: 'TEST001',
      changes: [{ field: 'prueba', before: 'antes', after: 'después' }],
    })
    // Recargar
    const result = await getAuditLogs(restaurantId, activeTab, 100)
    setLogs(result)
    const snap = await getDocs(collection(db, 'restaurants', restaurantId, 'audit_logs'))
    setTotalInCollection(snap.size)
    setCreatingTest(false)
  }

  const actionBg = (a) => a === 'create' ? 'rgba(22,163,74,0.15)' : a === 'edit' ? 'rgba(234,88,12,0.15)' : 'rgba(220,38,38,0.15)'
  const actionColor = (a) => a === 'create' ? 'var(--green)' : a === 'edit' ? 'var(--accent)' : 'var(--red)'
  const actionLabel = (a) => a === 'create' ? '+ Creó' : a === 'edit' ? '✏ Editó' : '✕ Eliminó'

  const borderCol = isDark ? '#1f2937' : '#e5e7eb'
  const t2 = isDark ? '#9ca3af' : '#6b7280'
  const t3 = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div className="space-y-4">
      {/* Diagnóstico + botón test */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: t3 }}>
          {totalInCollection === null ? 'Verificando colección…' : `Total en colección: ${totalInCollection} docs`}
        </span>
        <button
          onClick={handleCreateTestLog}
          disabled={creatingTest}
          style={{
            background: 'none', border: `1px dashed ${t3}`, borderRadius: 6,
            padding: '4px 12px', fontSize: '0.75rem', color: t2,
            cursor: creatingTest ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: creatingTest ? 0.5 : 1,
          }}
        >
          {creatingTest ? 'Creando…' : '+ Crear log de prueba'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${borderCol}`, paddingBottom: 0 }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.82rem', fontWeight: 600, padding: '8px 14px', borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : t2,
              transition: 'all 0.15s',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Logs */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: t3 }}>
          <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p style={{ fontSize: '0.88rem' }}>Sin registros para este módulo</p>
        </div>
      ) : (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {logs.map((log) => (
            <div key={log.id} style={{ background: isDark ? '#1f2937' : '#fff', border: `1px solid ${borderCol}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: log.changes?.length > 0 ? 10 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: actionBg(log.action), color: actionColor(log.action) }}>
                    {actionLabel(log.action)}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: isDark ? '#f9fafb' : '#111827' }}>{log.entityName || '—'}</span>
                  {log.entityCode && <span style={{ fontSize: '0.75rem', color: t3 }}>({log.entityCode})</span>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontSize: '0.75rem', color: t2, fontWeight: 500 }}>{log.userName}</div>
                  <div style={{ fontSize: '0.7rem', color: t3 }}>
                    {log.timestamp?.toDate?.()?.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'}
                  </div>
                </div>
              </div>

              {/* Cambios */}
              {(log.changes?.length > 0 || log.ingredientsAfter || log.ingredientsBefore) && (() => {
                // Recipe-level field changes (name, price, etc.)
                const fieldChanges = (log.changes || []).filter(c => c.field !== 'ingrediente' && !c.item)

                // Build full ingredient table when snapshots are available
                const hasSnapshots = log.ingredientsAfter || log.ingredientsBefore
                const ingBefore = log.ingredientsBefore || []
                const ingAfter  = log.ingredientsAfter  || []

                const key = (ing) => ing.reference || ing.ingredientName || ing.description || ''

                const allIngredients = (() => {
                  if (!hasSnapshots) return []
                  const seen = new Set()
                  const rows = []
                  // All after-ingredients first
                  ingAfter.forEach(ing => {
                    const k = key(ing)
                    if (!seen.has(k)) { seen.add(k); rows.push({ k, after: ing, before: ingBefore.find(b => key(b) === k) || null }) }
                  })
                  // Removed (only in before)
                  ingBefore.forEach(ing => {
                    const k = key(ing)
                    if (!seen.has(k)) { seen.add(k); rows.push({ k, after: null, before: ing }) }
                  })
                  return rows
                })()

                const fieldLabel = (f) => ({
                  sellingPrice: 'Precio de venta',
                  name: 'Nombre',
                  preparation: 'Preparación',
                  yieldAmount: 'Rendimiento',
                  yieldUnit: 'Unidad rendimiento',
                  totalCost: 'Costo total',
                  manualCost: 'Costo manual',
                }[f] ?? f)

                const ingAction = ({ before, after }) => {
                  if (!before) return { label: 'Adicionado', color: 'var(--green, #16a34a)' }
                  if (!after)  return { label: 'Eliminado',  color: 'var(--red, #dc2626)' }
                  const changed = before.quantity !== after.quantity || before.wasteMargin !== after.wasteMargin || before.unit !== after.unit
                  return changed
                    ? { label: 'Modificado', color: 'var(--accent)' }
                    : { label: '—', color: t3 }
                }

                const ingVal = (ing) => ing ? `${ing.quantity ?? ''}${ing.unit ?? ''}${ing.wasteMargin ? ` / D:${ing.wasteMargin}%` : ''}` : '—'

                const thStyle = { padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: t3, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.06em' }
                const cellStyle = (border) => ({ padding: '5px 10px', borderTop: border ? `1px solid ${borderCol}` : 'none' })

                return (
                  <div style={{ background: isDark ? '#111827' : '#f9fafb', borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                      <thead>
                        <tr style={{ background: isDark ? '#0f172a' : '#f3f4f6' }}>
                          <th style={{ ...thStyle, width: '32%' }}>Ingrediente</th>
                          <th style={{ ...thStyle, width: '16%' }}>Acción</th>
                          <th style={{ ...thStyle, width: '26%', color: 'var(--green, #16a34a)' }}>Nuevo</th>
                          <th style={{ ...thStyle, width: '26%', color: 'var(--red, #dc2626)' }}>Anterior</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Recipe-level field changes */}
                        {fieldChanges.map((change, i) => (
                          <tr key={`f${i}`} style={{ background: i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') }}>
                            <td style={{ ...cellStyle(true), color: isDark ? '#e5e7eb' : '#374151', fontWeight: 600, fontStyle: 'italic' }}>{fieldLabel(change.field)}</td>
                            <td style={{ ...cellStyle(true), color: 'var(--accent)', fontWeight: 600 }}>Modificado</td>
                            <td style={{ ...cellStyle(true), color: 'var(--green, #16a34a)' }}>{change.after != null ? String(change.after) : '—'}</td>
                            <td style={{ ...cellStyle(true), color: 'var(--red, #dc2626)' }}>{change.before != null ? String(change.before) : '—'}</td>
                          </tr>
                        ))}
                        {/* Full ingredient table */}
                        {hasSnapshots ? allIngredients.map(({ k, before, after }, i) => {
                          const act = ingAction({ before, after })
                          const rowBg = (fieldChanges.length + i) % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)')
                          return (
                            <tr key={`ing${i}`} style={{ background: rowBg }}>
                              <td style={{ ...cellStyle(true), color: isDark ? '#f9fafb' : '#111827', fontWeight: 500 }}>{after?.ingredientName || before?.ingredientName || after?.description || before?.description || k}</td>
                              <td style={{ ...cellStyle(true), color: act.color, fontWeight: 700, fontSize: '0.72rem' }}>{act.label}</td>
                              <td style={{ ...cellStyle(true), color: 'var(--green, #16a34a)' }}>{ingVal(after)}</td>
                              <td style={{ ...cellStyle(true), color: 'var(--red, #dc2626)' }}>{ingVal(before)}</td>
                            </tr>
                          )
                        }) : (log.changes || []).filter(c => c.field === 'ingrediente' || c.item).map((change, i) => {
                          // Fallback for old logs without snapshots
                          const isAdded = change.field === 'ingrediente' && change.action === 'added'
                          const isRemoved = change.field === 'ingrediente' && change.action === 'removed'
                          const act = isAdded ? { label: 'Adicionado', color: 'var(--green, #16a34a)' }
                                    : isRemoved ? { label: 'Eliminado', color: 'var(--red, #dc2626)' }
                                    : { label: 'Modificado', color: 'var(--accent)' }
                          return (
                            <tr key={`old${i}`} style={{ background: i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') }}>
                              <td style={{ ...cellStyle(true), color: isDark ? '#f9fafb' : '#111827', fontWeight: 500 }}>{change.item || '—'}</td>
                              <td style={{ ...cellStyle(true), color: act.color, fontWeight: 700, fontSize: '0.72rem' }}>{act.label}</td>
                              <td style={{ ...cellStyle(true), color: 'var(--green, #16a34a)' }}>{isAdded ? change.item : change.after != null ? String(change.after) : '—'}</td>
                              <td style={{ ...cellStyle(true), color: 'var(--red, #dc2626)' }}>{isRemoved ? change.item : change.before != null ? String(change.before) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Verificación Tab ─────────────────────────────────────────────────────────
function VerificationTab({ restaurantId, isDark }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cfg_verif_view') || 'grid')

  const setView = (v) => { localStorage.setItem('cfg_verif_view', v); setViewMode(v) }

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    getDocs(collection(db, 'restaurants', restaurantId, 'recipes'))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        all.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
        setRecipes(all)
      })
      .finally(() => setLoading(false))
  }, [restaurantId])

  const filtered = recipes.filter(r => {
    if (filter === 'verified' && !r.verified) return false
    if (filter === 'unverified' && r.verified) return false
    if (search) {
      const q = search.toLowerCase()
      return r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q)
    }
    return true
  })

  const total = recipes.length
  const verifiedCount = recipes.filter(r => r.verified).length
  const pct = total > 0 ? Math.round((verifiedCount / total) * 100) : 0

  const bdr = isDark ? '#1f2937' : '#e5e7eb'
  const t2 = isDark ? '#9ca3af' : '#6b7280'
  const t3 = isDark ? '#6b7280' : '#9ca3af'
  const ink = isDark ? '#f9fafb' : '#111827'

  const inputStyle = {
    background: isDark ? '#1f2937' : '#fff',
    border: `1px solid ${bdr}`,
    borderRadius: 8, padding: '6px 12px',
    color: ink, fontFamily: 'inherit', fontSize: '0.83rem', outline: 'none',
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          ['Total', total, 'var(--accent)', ink],
          ['Verificadas', `${verifiedCount} (${pct}%)`, 'var(--green, #16a34a)', 'var(--green, #16a34a)'],
          ['Sin verificar', total - verifiedCount, 'var(--red, #dc2626)', 'var(--red, #dc2626)'],
        ].map(([label, value, barColor, textColor]) => (
          <div key={label} style={{ background: isDark ? '#1f2937' : '#f9fafb', border: `1px solid ${bdr}`, borderRadius: 10, overflow: 'hidden', textAlign: 'center' }}>
            <div style={{ height: 4, background: barColor }} />
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: textColor }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: t3, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + toggle */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
          <button onClick={() => setView('grid')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
            <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
          <button onClick={() => setView('list')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
            <ListIcon className={cn('h-3.5 w-3.5', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
          </button>
        </div>
        {[
          { id: 'all',        label: 'Todas',          activeColor: 'var(--accent)' },
          { id: 'verified',   label: '✓ Verificadas',  activeColor: 'var(--green, #16a34a)' },
          { id: 'unverified', label: '✗ Sin verificar', activeColor: 'var(--red, #dc2626)' },
        ].map(({ id: f, label, activeColor }) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...inputStyle, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
              background: filter === f ? activeColor : (isDark ? '#1f2937' : '#fff'),
              color: filter === f ? '#fff' : t2,
              border: `1px solid ${filter === f ? activeColor : bdr}`,
            }}>
            {label}
          </button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar..."
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px 0', color: t3 }}>Sin resultados</div>
          ) : filtered.map(r => (
            <div key={r.id}
              className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ transition: 'all 0.18s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = isDark ? '#1f2937' : '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div className="h-1.5" style={{ background: 'var(--accent)' }} />
              <div className="p-2.5">
                {r.code && <span className="font-mono text-xs px-1.5 py-0.5 rounded inline-block mb-1" style={{ background: 'var(--accent)', color: '#fff' }}>{r.code}</span>}
                <p className={cn('text-xs font-medium', isDark ? 'text-white' : 'text-gray-800')} style={{ lineHeight: 1.3, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.6em' }}>{r.name}</p>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: 4, color: r.verified ? 'var(--green, #16a34a)' : 'var(--red, #dc2626)' }}>
                  {r.verified ? '✓ Verificada' : '✗ Sin verificar'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: '55vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: isDark ? '#111827' : '#f3f4f6', position: 'sticky', top: 0 }}>
                {['Código', 'Nombre', 'Tipo', 'Verificada', 'Por', 'Fecha verif.', 'Últ. modificación'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: t3, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${bdr}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: t3 }}>Sin resultados</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${bdr}`, background: i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700, fontSize: '0.78rem' }}>{r.code || '—'}</td>
                  <td style={{ padding: '8px 12px', color: ink, fontWeight: 500, maxWidth: 200 }}>{r.name}</td>
                  <td style={{ padding: '8px 12px', color: t2 }}>{r.isSubRecipe ? 'Sub-receta' : 'Receta'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ fontWeight: 700, color: r.verified ? 'var(--green, #16a34a)' : 'var(--red, #dc2626)' }}>
                      {r.verified ? '✓ Sí' : '✗ No'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: t2 }}>{r.verifiedBy || '—'}</td>
                  <td style={{ padding: '8px 12px', color: t2, whiteSpace: 'nowrap' }}>
                    {r.verifiedAt?.toDate?.()?.toLocaleDateString('es-CO') || '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: t3, whiteSpace: 'nowrap' }}>
                    {r.updatedAt?.toDate?.()?.toLocaleDateString('es-CO') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Personalización Tab (Appearance + Contrasts merged) ──────────────────────
function AppearanceTab({ isDark }) {
  const { i18n } = useTranslation()
  const { theme, setTheme, language, setLanguage, showCosts, setShowCosts, currentRestaurant, accentColor, setAccentColor, user, userProfile, setUserProfile } = useAppStore()
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)
  const [masterBusy, setMasterBusy] = useState(false)

  const handleSetMaster = async () => {
    if (!user?.uid) return
    setMasterBusy(true)
    try {
      await setMasterRole(user.uid)
      setUserProfile({ ...userProfile, role: 'master' })
      success('Rol master asignado. Recarga la página.')
    } catch { error('Error al asignar rol') } finally { setMasterBusy(false) }
  }

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
        <div className="grid-2">
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
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Color de acento</Label>
          <button
            onClick={() => handleAccent(isDark ? DEFAULT_ACCENT_NIGHT : DEFAULT_ACCENT_DAY)}
            className={cn('text-xs px-3 py-1 rounded-lg border transition-colors', isDark ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200' : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700')}
          >
            Restablecer
          </button>
        </div>
        <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
          Se aplica a botones, pestañas activas y bordes en toda la app.
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
            value={accentColor || '#0833A2'}
            onChange={(e) => handleAccent(e.target.value)}
            className="w-10 h-9 rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--accent)' }}
          />
          <span className={cn('text-sm font-mono', isDark ? 'text-gray-300' : 'text-gray-700')}>{accentColor || '#0833A2'}</span>
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

      {/* Temporary: promote self to master — visible until role is master */}
      {userProfile?.role !== 'master' && (
        <div style={{ marginTop: 20, padding: 16, background: isDark ? '#1f2937' : '#f9fafb', borderRadius: 10, border: isDark ? '1px solid #374151' : '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '0.8rem', color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 8 }}>
            🔑 Configuración inicial — solo aparece una vez
          </div>
          <button
            onClick={handleSetMaster}
            disabled={masterBusy}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', width: '100%', opacity: masterBusy ? 0.7 : 1 }}
          >
            {masterBusy ? '...' : '🔑 Establecerme como Master'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────
const ROLE_STYLE = {
  master:     { bg: '#111111',                    color: '#c9a84c' },
  superadmin: { bg: 'rgba(201,168,76,0.20)',      color: '#c9a84c' },
  admin:      { bg: 'rgba(74,158,110,0.20)',      color: '#4a9e6e' },
  usuario:    { bg: 'rgba(100,100,100,0.20)',     color: '#888888' },
  chef:       { bg: 'rgba(100,130,200,0.20)',     color: '#7a9ad4' },
}
function RoleBadge({ role }) {
  const s = ROLE_STYLE[role] || ROLE_STYLE.usuario
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
      {role}
    </span>
  )
}

// ── Inline field ──────────────────────────────────────────────────────────────
function UField({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
const uInput = (isDark) => ({
  width: '100%', background: isDark ? '#181f19' : '#f9fafb',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
  borderRadius: 8, padding: '8px 11px', fontFamily: 'inherit',
  fontSize: '0.85rem', color: isDark ? '#f0ece4' : '#111827',
  outline: 'none', boxSizing: 'border-box',
})

// ── Users Admin Tab ───────────────────────────────────────────────────────────
function UsersAdminTab({ isDark }) {
  const { currentRestaurant, user, userProfile } = useAppStore()
  const { isMaster, isAdmin, canCreateAdmin } = useAuth()
  const { success, error } = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('users-view-mode') || 'list')
  const setView = (mode) => { setViewMode(mode); localStorage.setItem('users-view-mode', mode) }

  // ── Create form state ──
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'usuario' })
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const roleOptions = isMaster
    ? ['master', 'admin', 'usuario']
    : isAdmin ? ['admin', 'usuario'] : []

  // ── Load users ──
  const loadUsers = async () => {
    if (!currentRestaurant?.id) return
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('restaurantIds', 'array-contains', currentRestaurant.id))
      )
      // Also catch members who may not have restaurantIds (legacy)
      const memberIds = Object.keys(currentRestaurant.members || {})
      const fromQuery = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const fromQueryIds = new Set(fromQuery.map((u) => u.uid))

      const legacySnaps = await Promise.all(
        memberIds.filter((id) => !fromQueryIds.has(id)).map(async (uid) => {
          const s = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)))
          return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }
        })
      )
      setUsers([...fromQuery, ...legacySnaps.filter(Boolean)])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [currentRestaurant?.id])

  // ── Create user ──
  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { error('Completa todos los campos'); return }
    if (form.password.length < 6) { error('La contraseña debe tener al menos 6 caracteres'); return }
    setSaving(true)
    try {
      await createUserWithRole(
        { ...form, restaurantIds: [currentRestaurant.id] },
        user?.uid
      )
      await logAction({
        restaurantId: currentRestaurant.id, userId: userProfile?.uid,
        userName: userProfile?.name || userProfile?.email, userRole: userProfile?.role,
        action: 'create', module: 'user', entityName: form.name,
        changes: [{ field: 'rol', after: form.role }],
      })
      success(`Usuario "${form.name}" creado`)
      setForm({ name: '', email: '', password: '', role: 'usuario' })
      setShowCreate(false)
      loadUsers()
    } catch (err) {
      error(err.code === 'auth/email-already-in-use' ? 'Ese correo ya está registrado' : (err.message || 'Error al crear'))
    } finally { setSaving(false) }
  }

  // ── Edit user ──
  const [editData, setEditData] = useState({ name: '', role: '', email: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const handleEditSave = async () => {
    if (!editUser) return
    if (!editData.name?.trim()) { error('El nombre es requerido'); return }
    setEditSaving(true)
    try {
      // Update user doc
      await updateDoc(doc(db, 'users', editUser.uid), {
        name: editData.name.trim(),
        role: editData.role,
        updatedAt: serverTimestamp(),
      })
      // Update role via service (handles role-specific logic)
      await updateUserRole(editUser.uid, editData.role, editUser.restaurantIds || [currentRestaurant.id])
      // Update members map in restaurant
      await updateDoc(doc(db, 'restaurants', currentRestaurant.id), {
        [`members.${editUser.uid}.role`]: editData.role,
        [`members.${editUser.uid}.name`]: editData.name.trim(),
      })
      const changes = []
      if (editUser.name !== editData.name.trim()) changes.push({ field: 'nombre', before: editUser.name, after: editData.name.trim() })
      if (editUser.role !== editData.role) changes.push({ field: 'rol', before: editUser.role, after: editData.role })
      await logAction({
        restaurantId: currentRestaurant.id, userId: userProfile?.uid,
        userName: userProfile?.name || userProfile?.email, userRole: userProfile?.role,
        action: 'edit', module: 'user', entityId: editUser.uid, entityName: editData.name.trim(), changes,
      })
      success('Usuario actualizado')
      setEditUser(null)
      loadUsers()
    } catch { error('Error al actualizar') } finally { setEditSaving(false) }
  }

  // ── Permisos por jerarquía ──
  // canManage: puede editar/eliminar al usuario objetivo
  const canManage = (targetUser) => {
    const targetRole = targetUser?.role || 'usuario'
    if ((targetUser?.uid || targetUser?.id) === (user?.uid)) return false // nunca a sí mismo
    if (isMaster) return true
    if (isAdmin) return targetRole === 'admin' || targetRole === 'usuario'
    return false
  }
  // canDelete wrapper (kept for compat, uses canManage)
  const canDelete = (targetUser) => canManage(targetUser)
  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario ${u.name}?\nEsta acción no se puede deshacer.`)) return
    const uid = u.uid || u.id
    try {
      // 1. Eliminar doc de users/
      await deleteDoc(doc(db, 'users', uid))

      // 2. Quitar de members de todos los restaurantes donde aparece
      const restsSnap = await getDocs(collection(db, 'restaurants'))
      const batch = writeBatch(db)
      restsSnap.docs.forEach(restDoc => {
        const members = restDoc.data().members || {}
        if (members[uid]) {
          batch.update(restDoc.ref, { [`members.${uid}`]: null })
        }
      })
      await batch.commit()

      // 3. Actualizar lista local sin recargar
      setUsers(prev => prev.filter(u2 => (u2.uid || u2.id) !== uid))
      await logAction({
        restaurantId: currentRestaurant.id, userId: userProfile?.uid,
        userName: userProfile?.name || userProfile?.email, userRole: userProfile?.role,
        action: 'delete', module: 'user', entityId: uid, entityName: u.name, changes: [],
      })
      success('Usuario eliminado ✓')
    } catch (err) {
      console.error('Error eliminando usuario:', err)
      error('Error al eliminar: ' + err.message)
    }
  }


  const borderCol = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'
  const bg2       = isDark ? '#111712' : '#fff'
  const bgHdr     = isDark ? '#0d110e' : '#f9fafb'
  const t3        = isDark ? '#4a4840' : '#9ca3af'
  const t2        = isDark ? '#8a8578' : '#6b7280'
  const ink       = isDark ? '#f0ece4' : '#111827'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Toggle Grid/Lista — izquierda */}
          <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
            <button onClick={() => setView('grid')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'grid' ? { background: 'var(--accent)' } : {}} title="Grid">
              <LayoutGrid className={cn('h-3.5 w-3.5', viewMode === 'grid' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
            </button>
            <button onClick={() => setView('list')} className="p-1.5 rounded-md transition-colors" style={viewMode === 'list' ? { background: 'var(--accent)' } : {}} title="Lista">
              <ListIcon className={cn('h-3.5 w-3.5', viewMode === 'list' ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
            </button>
          </div>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: ink, margin: 0 }}>Usuarios</h2>
            <p style={{ fontSize: '0.78rem', color: t3, marginTop: 2 }}>{users.length} miembro{users.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Nuevo usuario
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: isDark ? '#181f19' : '#f9fafb', border: `1px solid ${borderCol}`, borderRadius: 12, padding: 18 }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: ink, marginBottom: 14 }}>Crear nuevo usuario</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
            <UField label="Nombre completo *">
              <input style={uInput(isDark)} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: toTitleCase(e.target.value) }))} placeholder="Ej: María García" />
            </UField>
            <UField label="Correo *">
              <input style={uInput(isDark)} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
            </UField>
            <UField label="Contraseña temporal *">
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...uInput(isDark), paddingRight: 38 }}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mín. 6 caracteres"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#6b7280' : '#9ca3af', fontSize: '1rem', padding: 2, lineHeight: 1 }}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </UField>
            <UField label="Rol *">
              <select style={uInput(isDark)} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </UField>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creando...' : 'Crear usuario'}
            </Button>
          </div>
        </div>
      )}

      {/* Users — loading / empty / list / grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : users.length === 0 ? (
        <p style={{ color: t3, textAlign: 'center', padding: '32px 0', fontSize: '0.88rem' }}>No hay usuarios registrados.</p>
      ) : viewMode === 'list' ? (
        /* ── Vista Lista ── */
        <div style={{ border: `1px solid ${borderCol}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: bgHdr }}>
                {['Nombre', 'Email', 'Rol', 'Acciones'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: t3, fontWeight: 700, borderBottom: `1px solid ${borderCol}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const role = u.role || 'usuario'
                return (
                  <tr key={u.uid || u.id}
                    style={{ borderBottom: `1px solid ${borderCol}` }}
                    onMouseOver={(e) => { e.currentTarget.style.background = isDark ? 'rgba(201,168,76,0.04)' : '#fafafa' }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 14px', color: ink, fontWeight: 500 }}>{u.name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: t2, fontSize: '0.8rem' }}>{u.email}</td>
                    <td style={{ padding: '10px 14px' }}><RoleBadge role={role} /></td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canManage(u) && (
                          <button title="Editar" onClick={() => { setEditUser(u); setEditData({ name: u.name || '', role, email: u.email || '', newPassword: '' }); setShowEditPassword(false) }}
                            style={{ background: 'none', border: `1px solid ${borderCol}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: t2, display: 'flex', alignItems: 'center' }}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {canManage(u) && (
                          <button title="Eliminar" onClick={() => handleDelete(u)}
                            style={{ background: 'rgba(192,72,72,0.10)', border: '1px solid rgba(192,72,72,0.25)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#c04848', display: 'flex', alignItems: 'center' }}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Vista Grid ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {users.map((u) => {
            const role = u.role || 'usuario'
            const roleBg = role === 'master' ? 'rgba(0,0,0,0.3)' : role === 'superadmin' ? 'rgba(234,88,12,0.15)' : role === 'admin' ? 'rgba(22,163,74,0.15)' : 'rgba(100,100,100,0.15)'
            const roleColor = role === 'master' ? 'var(--accent)' : role === 'superadmin' ? 'var(--accent)' : role === 'admin' ? 'var(--green)' : t2
            const roleLabel = role === 'master' ? 'Master' : role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Usuario'
            return (
              <div key={u.uid || u.id} style={{ background: isDark ? '#1f2937' : '#fff', border: `1px solid ${borderCol}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', transition: 'all 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = borderCol }}
              >
                {/* Avatar */}
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.08)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                {/* Info */}
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: ink, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</div>
                  <div style={{ fontSize: '0.7rem', color: t3, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  <span style={{ fontSize: '0.67rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: roleBg, color: roleColor }}>{roleLabel}</span>
                </div>
                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  {canManage(u) && (
                    <button onClick={() => { setEditUser(u); setEditData({ name: u.name || '', role, email: u.email || '', newPassword: '' }); setShowEditPassword(false) }}
                      style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '7px', cursor: 'pointer' }}>
                      Editar
                    </button>
                  )}
                  {canManage(u) && (
                    <button onClick={() => handleDelete(u)}
                      style={{ background: 'transparent', border: '1px solid rgba(192,72,72,0.5)', borderRadius: 6, color: '#c04848', fontFamily: 'inherit', fontSize: '0.75rem', padding: '7px 9px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  )}
                  {!canManage(u) && (
                    <div style={{ flex: 1, fontSize: '0.72rem', color: t3, padding: '7px 0', textAlign: 'center' }}>—</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: bg2, border: `1px solid ${borderCol}`, borderRadius: 14, padding: 24, width: 'min(420px, 95vw)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!canManage(editUser) ? (
              <>
                <p style={{ color: '#c04848', fontSize: '0.88rem', margin: 0 }}>No tienes permisos para editar este usuario.</p>
                <Button variant="outline" size="sm" onClick={() => setEditUser(null)}>Cerrar</Button>
              </>
            ) : (<>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '1rem', color: ink, margin: 0 }}>
              Editar usuario
            </p>

            {/* Nombre */}
            <UField label="Nombre *">
              <input
                style={uInput(isDark)}
                value={editData.name}
                onChange={e => setEditData(d => ({ ...d, name: toTitleCase(e.target.value) }))}
                placeholder="Nombre completo"
              />
            </UField>

            {/* Email — readonly */}
            <UField label="Email">
              <input
                style={{ ...uInput(isDark), opacity: 0.55, cursor: 'not-allowed' }}
                value={editData.email}
                readOnly
                disabled
              />
              <p style={{ fontSize: '0.72rem', color: t3, margin: '4px 0 0' }}>
                El email no se puede modificar
              </p>
            </UField>

            {/* Rol */}
            <UField label="Rol *">
              <select
                style={uInput(isDark)}
                value={editData.role}
                onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
              >
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </UField>

            {/* Nueva contraseña (opcional) */}
            <UField label="Nueva contraseña (opcional)">
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...uInput(isDark), paddingRight: 38 }}
                  type={showEditPassword ? 'text' : 'password'}
                  value={editData.newPassword || ''}
                  onChange={e => setEditData(d => ({ ...d, newPassword: e.target.value }))}
                  placeholder="Dejar vacío para no cambiar"
                />
                <button type="button" onClick={() => setShowEditPassword(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#6b7280' : '#9ca3af', fontSize: '1rem', padding: 2, lineHeight: 1 }}>
                  {showEditPassword ? '🙈' : '👁'}
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: t3, margin: '4px 0 0' }}>
                Sin backend no es posible cambiar la contraseña desde aquí. El usuario debe usar &ldquo;¿Olvidaste tu contraseña?&rdquo; en el login.
              </p>
            </UField>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
            </>)}
          </div>
        </div>
      )}

    </div>
  )
}

// ── RestauranteTab ────────────────────────────────────────────────────────────
// ── Summary Tab — todas las recetas y sub-recetas con costo, precio, utilidad ─
function SummaryTab({ restaurantId, isDark }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    const u = subscribeRecipes(restaurantId, (rs) => {
      setRecipes(rs || [])
      setLoading(false)
    })
    return () => u()
  }, [restaurantId])

  const handleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const computeRow = (r) => {
    const isSub = r.isSubRecipe === true || r.type === 'subrecipe'
    // calcRecipeTotalCost: usa r.totalCost si > 0, si no suma desde ingredientes
    const totalCost = calcRecipeTotalCost(r) || 0
    const yieldAmt = parseFloat(r.yieldAmount) || 0
    const stored = parseFloat(r.costPerYieldUnit)
    const costPerYield = !isNaN(stored) && stored > 0
      ? stored
      : (yieldAmt > 0 ? totalCost / yieldAmt : 0)
    const cost = isSub ? costPerYield : totalCost
    const price = parseFloat(r.sellingPrice) || 0
    const utility = price > 0 ? ((price - cost) / price) * 100 : 0
    return { ...r, isSub, _cost: cost, _price: price, _utility: utility }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = recipes.map(computeRow)
    const filtered = q
      ? all.filter((r) =>
          r.name?.toLowerCase()?.includes(q) ||
          r.code?.toLowerCase()?.includes(q) ||
          r.reference?.toLowerCase?.()?.includes(q)
        )
      : all
    const dir = sortDir === 'asc' ? 1 : -1
    const getVal = (r) => {
      switch (sortBy) {
        case 'code':      return (r.code || '').toLowerCase()
        case 'reference': return (r.reference || '').toLowerCase()
        case 'name':      return (r.name || '').toLowerCase()
        case 'type':      return r.isSub ? 1 : 0
        case 'cost':      return r._cost
        case 'price':     return r._price
        case 'utility':   return r._utility
        default: return ''
      }
    }
    return [...filtered].sort((a, b) => {
      const av = getVal(a), bv = getVal(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [recipes, search, sortBy, sortDir])

  const ink = isDark ? '#f0ece4' : '#111827'
  const t2 = isDark ? '#9ca3af' : '#6b7280'
  const t3 = isDark ? '#6b7280' : '#9ca3af'
  const bg2 = isDark ? '#111712' : '#fff'
  const bg3 = isDark ? '#0d110e' : '#f9fafb'
  const b1 = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'

  const cols = [
    { key: 'code',      label: 'Código',     align: 'left',  width: 100 },
    { key: 'reference', label: 'Referencia', align: 'left',  width: 110 },
    { key: 'name',      label: 'Nombre',     align: 'left',  width: 'auto' },
    { key: 'type',      label: 'Tipo',       align: 'left',  width: 90 },
    { key: 'cost',      label: 'Costo',      align: 'right', width: 110 },
    { key: 'price',     label: 'P. Venta',   align: 'right', width: 110 },
    { key: 'utility',   label: '% Utilidad', align: 'right', width: 100 },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: ink, margin: '0 0 4px' }}>
            Resumen de recetas
          </h2>
          <p style={{ color: t3, fontSize: '0.82rem', margin: 0 }}>
            {rows.length} de {recipes.length} {recipes.length === 1 ? 'item' : 'items'} (incluye sub-recetas y ocultas)
          </p>
        </div>
        <div style={{ position: 'relative', width: 280, flexShrink: 0 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: t3, pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o referencia"
            style={{
              width: '100%', height: 34,
              paddingLeft: 30, paddingRight: search ? 28 : 12,
              background: bg2, color: ink,
              border: `1px solid ${b1}`, borderRadius: 8,
              fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
            }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                width: 22, height: 22, border: 'none', background: 'none', color: t2,
                cursor: 'pointer', borderRadius: 4, fontSize: '1rem', lineHeight: 1,
              }}>×</button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: t3 }}>Cargando…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: t3, fontSize: '0.85rem' }}>
          {search ? `Sin resultados para "${search}"` : 'No hay recetas todavía.'}
        </div>
      ) : (
        <div style={{ background: bg2, border: `1px solid ${b1}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: bg3 }}>
                  {cols.map((c) => {
                    const active = sortBy === c.key
                    return (
                      <th key={c.key}
                        onClick={() => handleSort(c.key)}
                        style={{
                          padding: '10px 14px', textAlign: c.align,
                          fontSize: '0.68rem', textTransform: 'uppercase',
                          letterSpacing: '0.06em', fontWeight: 700,
                          color: active ? 'var(--accent)' : t3,
                          borderBottom: `1px solid ${b1}`,
                          cursor: 'pointer', userSelect: 'none',
                          width: c.width,
                          whiteSpace: 'nowrap',
                        }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start' }}>
                          {c.label}
                          {active
                            ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                            : <ArrowUpDown className="h-3 w-3" style={{ opacity: 0.4 }} />}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}
                    style={{
                      borderBottom: `1px solid ${b1}`,
                      opacity: r.active === false ? 0.55 : 1,
                    }}>
                    <td style={{ padding: '9px 14px', color: t2, fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {r.code || '—'}
                    </td>
                    <td style={{ padding: '9px 14px', color: t2, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {r.reference || '—'}
                    </td>
                    <td style={{ padding: '9px 14px', color: ink, fontWeight: 500 }}>
                      {r.name || '—'}
                      {r.active === false && (
                        <span style={{ marginLeft: 8, fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>oculta</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        padding: '2px 8px', borderRadius: 6,
                        background: r.isSub ? 'rgba(96,165,250,0.15)' : 'rgba(217,119,6,0.15)',
                        color: r.isSub ? '#60a5fa' : '#d97706',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {r.isSub ? 'Sub-receta' : 'Receta'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatNumber(r._cost)}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {r._price > 0 ? formatNumber(r._price) : '—'}
                    </td>
                    <td style={{
                      padding: '9px 14px', textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                      fontWeight: 700,
                      color: r._price <= 0 ? t3 : r._utility >= 50 ? '#10b981' : r._utility >= 20 ? '#d97706' : '#ef4444',
                    }}>
                      {r._price > 0 ? `${r._utility.toFixed(1)}%` : '—'}
                    </td>
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

function RestauranteTab({ currentRestaurant, isDark }) {
  const { success, error } = useToast()
  const { setCurrentRestaurant } = useAppStore()
  const [restData, setRestData] = useState({
    name:    currentRestaurant?.name    || '',
    address: currentRestaurant?.address || '',
    contact: currentRestaurant?.contact || '',
    phone:   currentRestaurant?.phone   || '',
  })
  const [saving, setSaving] = useState(false)
  const [logoURL, setLogoURL] = useState(currentRestaurant?.logoURL || '')
  const [logoUploading, setLogoUploading] = useState(false)

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    background: isDark ? '#1f2937' : '#fff',
    color: isDark ? '#f9fafb' : 'var(--text)',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    outline: 'none',
    marginTop: 4,
  }
  const labelStyle = {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: isDark ? '#9ca3af' : 'var(--t2)',
    display: 'block',
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { error('Logo demasiado grande (máx 2MB)'); return }
    setLogoUploading(true)
    try {
      const sRef = storageRef(storage, `restaurants/${currentRestaurant.id}/logo/${file.name}`)
      await uploadBytes(sRef, file, { contentType: file.type })
      const url = await getDownloadURL(sRef)
      setLogoURL(url)
      success('Logo subido ✓')
    } catch (err) {
      console.error(err)
      error('Error subiendo logo')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!logoURL) return
    try {
      // Intentar borrar de Storage (no bloquea si falla)
      try {
        const sRef = storageRef(storage, `restaurants/${currentRestaurant.id}/logo`)
        await deleteObject(sRef)
      } catch { /* ignorar */ }
      setLogoURL('')
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveRestaurant = async () => {
    if (!restData.name.trim()) { error('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const payload = {
        name: restData.name.trim(),
        address: restData.address.trim(),
        contact: restData.contact.trim(),
        phone: restData.phone.trim(),
        logoURL: logoURL || null,
        updatedAt: serverTimestamp(),
      }
      await updateDoc(doc(db, 'restaurants', currentRestaurant.id), payload)
      setCurrentRestaurant({ ...currentRestaurant, ...payload, logoURL: logoURL || null })
      success('Restaurante guardado ✓')
    } catch (err) {
      console.error(err)
      error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* ── Card logo + nombre ── */}
      <div className={cn('rounded-2xl border overflow-hidden mb-5', isDark ? 'border-gray-800' : 'border-gray-200')}>
        <div style={{ height: 6, background: 'var(--accent)' }} />
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Logo */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: 14, overflow: 'hidden', border: `2px dashed ${isDark ? '#374151' : '#d1d5db'}`, background: isDark ? '#1f2937' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', transition: 'border-color 0.2s' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = isDark ? '#374151' : '#d1d5db'}
            >
              <input type="file" accept="image/*" onChange={handleLogoUpload}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
              {logoURL
                ? <img src={logoURL} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
                : <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem' }}>🖼</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--t3)', marginTop: 2 }}>{logoUploading ? '...' : 'Logo'}</div>
                  </div>
              }
            </div>
            {logoURL && (
              <button onClick={handleRemoveLogo} style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.68rem', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'center' }}>
                Quitar
              </button>
            )}
          </div>
          {/* Nombre */}
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, marginBottom: 6 }}>Nombre del restaurante *</label>
            <input style={{ ...inputStyle, fontSize: '1rem', fontWeight: 700 }}
              value={restData.name}
              onChange={e => setRestData({ ...restData, name: e.target.value.toUpperCase() })}
              placeholder="Mi Restaurante"
            />
          </div>
        </div>
      </div>

      {/* ── Card detalles ── */}
      <div className={cn('rounded-2xl border overflow-hidden mb-5', isDark ? 'border-gray-800' : 'border-gray-200')}>
        <div style={{ height: 6, background: 'var(--accent)' }} />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Dirección</label>
            <input style={inputStyle} value={restData.address} onChange={e => setRestData({ ...restData, address: toTitleCase(e.target.value) })} placeholder="Calle, ciudad..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Contacto</label>
              <input style={inputStyle} value={restData.contact} onChange={e => setRestData({ ...restData, contact: toTitleCase(e.target.value) })} placeholder="Nombre" />
            </div>
            <div>
              <label style={labelStyle}>Celular</label>
              <input style={inputStyle} value={restData.phone} onChange={e => setRestData({ ...restData, phone: e.target.value })} placeholder="+57 300 000 0000" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSaveRestaurant} disabled={saving}
          style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

// ── Main ConfigModal ──────────────────────────────────────────────────────────
export function ConfigModal() {
  const { configOpen, configTab, setConfigTab, closeConfig, currentRestaurant, theme } = useAppStore()
  const { canEdit, canManageUsers, isMaster } = useAuth()
  const navigate = useNavigate()
  const isDark = theme === 'night'
  const [section, setSection] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('config-view-mode') || 'grid')

  useEffect(() => { if (!configOpen) setSection(null) }, [configOpen])

  const setView = (mode) => { setViewMode(mode); localStorage.setItem('config-view-mode', mode) }

  const CARDS = [
    { key: 'summary',       label: 'Resumen',            visible: canEdit, icon: FileSpreadsheet },
    { key: 'ingredients',   label: 'Materias Primas',    visible: canEdit },
    { key: 'mp_categories', label: 'Categorías MP',      visible: canEdit },
    { key: 'units',         label: 'Unidades',           visible: canEdit },
    { key: 'categories',    label: 'Menús',              visible: canEdit },
    { key: 'suppliers',     label: 'Proveedores',        visible: canEdit },
    { key: 'import',        label: 'Importación Masiva', visible: canEdit },
    { key: 'recipes',       label: 'Gestión Recetas',    visible: canEdit },
    { key: 'sales',         label: 'Ventas',             visible: canEdit },
    { key: 'analytics',     label: 'Análisis BCG',       visible: canEdit },
    { key: 'versions',      label: 'Historial',          visible: canEdit },
    { key: 'verification',  label: 'Verificación',       visible: canEdit, icon: SlidersHorizontal },
    { key: 'users',         label: 'Usuarios',           visible: canManageUsers },
    { key: 'appearance',    label: 'Personalización',    visible: isMaster },
    { key: 'subscription',  label: 'Suscripción',        visible: canManageUsers },
    { key: 'restaurante',   label: 'Restaurante',        visible: canEdit, icon: Store },
  ].filter(c => c.visible).sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const goTo = (key) => { setSection(key); setConfigTab(key) }
  const goBack = () => setSection(null)
  const handleClose = () => {
    setSection(null)
    setConfigTab(null)
    closeConfig()
    // Evitar que navigate(-1) lleve a una receta abierta antes de abrir config
    const loc = window.location.pathname
    if (loc.startsWith('/recipes')) {
      navigate('/', { replace: true })
    }
  }

  if (!configOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className={cn(
        'relative w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden',
        isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
      )}>
        {/* ── Topbar ── */}
        <div className={cn(
          'flex items-center px-6 py-4 border-b flex-shrink-0',
          isDark ? 'border-gray-800' : 'border-gray-100'
        )} style={{ position: 'relative' }}>
          <h2 className={cn('font-display text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}
            style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            {section ? CARDS.find(c => c.key === section)?.label ?? 'Configuración' : 'Configuración'}
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            {/* Grid/Lista toggle — solo en el home del modal */}
            {!section && (
              <div style={{ display: 'flex', gap: 2, background: isDark ? '#1f2937' : '#f3f4f6', borderRadius: 8, padding: 3 }}>
                <button
                  onClick={() => setView('grid')}
                  style={{ background: viewMode === 'grid' ? (isDark ? '#374151' : '#fff') : 'transparent', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: viewMode === 'grid' ? 'var(--accent)' : 'var(--t2)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.15s' }}
                >⊞</button>
                <button
                  onClick={() => setView('list')}
                  style={{ background: viewMode === 'list' ? (isDark ? '#374151' : '#fff') : 'transparent', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: viewMode === 'list' ? 'var(--accent)' : 'var(--t2)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.15s' }}
                >☰</button>
              </div>
            )}
            <button
              onClick={section ? goBack : handleClose}
              style={{ background: 'transparent', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, padding: '7px 16px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)' }}
            >
              Salir
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!section ? (
            /* GRID / LISTA */
            <div className="flex-1 overflow-y-auto p-6">
              {viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
                  {CARDS.map(({ key, label }) => {
                    const allTabs = [...PARAM_TABS, ...TABS]
                    const tabDef = allTabs.find(t => t.id === key)
                    const Icon = tabDef?.icon
                    return (
                      <button
                        key={key}
                        onClick={() => goTo(key)}
                        className="group"
                        style={{
                          background: isDark ? '#111827' : '#fff',
                          border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                          borderRadius: 12,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'all 0.18s',
                          fontFamily: 'inherit',
                          padding: 0,
                        }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = isDark ? '#374151' : '#e5e7eb' }}
                      >
                        <div style={{ height: 6, background: 'var(--accent)', width: '100%' }} />
                        <div style={{ padding: '12px 14px', minHeight: '3.2em', display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {label}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', borderBottom: '1px solid var(--b1)' }}>Sección</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', borderBottom: '1px solid var(--b1)' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CARDS.map(({ key, label }) => (
                      <tr
                        key={key}
                        style={{ borderBottom: '1px solid var(--b1)', cursor: 'pointer' }}
                        onClick={() => goTo(key)}
                        onMouseOver={e => e.currentTarget.style.background = isDark ? '#1f2937' : '#f9fafb'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px', color: 'var(--text)', fontWeight: 500, fontSize: '0.9rem' }}>{label}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>Abrir →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* CONTENIDO DE SECCIÓN */
            configTab === 'ingredients' ? (
              <IngredientsTab restaurantId={currentRestaurant?.id} isDark={isDark} />
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                {configTab === 'mp_categories' && <MpCategoriesTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'units' && <UnitsTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'categories' && <CategoriesTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'suppliers' && <SuppliersTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'import' && <BulkImportTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'summary' && <SummaryTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'sales' && <SalesTab restaurantId={currentRestaurant?.id} isDark={isDark} onViewBCG={() => goTo('analytics')} />}
                {configTab === 'analytics' && <AnalyticsTab restaurantId={currentRestaurant?.id} isDark={isDark} onGoToSales={() => goTo('sales')} />}
                {configTab === 'recipes' && <RecipeManagementTab restaurantId={currentRestaurant?.id} isDark={isDark} onClose={handleClose} />}
                {configTab === 'versions' && <VersionsTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'verification' && <VerificationTab restaurantId={currentRestaurant?.id} isDark={isDark} />}
                {configTab === 'appearance' && isMaster && <AppearanceTab isDark={isDark} />}
                {configTab === 'users' && <UsersAdminTab isDark={isDark} />}
                {configTab === 'subscription' && (
                  <div className={cn('text-center py-16', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Gestión de suscripciones — próximamente</p>
                  </div>
                )}
                {configTab === 'restaurante' && <RestauranteTab currentRestaurant={currentRestaurant} isDark={isDark} />}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
