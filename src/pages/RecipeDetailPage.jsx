import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Save, Printer, Plus, Trash2, Lock, ToggleRight, ToggleLeft, ImageIcon, Video, Upload } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import {
  getRecipe, createRecipe, updateRecipe, toggleRecipeActive,
  subscribeCategories, subscribeIngredients, subscribeRecipes,
  getNextRecipeCode, createIngredient, getNextIngredientCode, createCategory,
} from '../services/restaurants'
import { subscribeUnits } from '../services/units'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import { useToast } from '../components/ui/toast'
import { cn, formatNumber } from '../lib/utils'
import { uploadRecipeFile } from '../services/storage'
import { compressImage } from '../utils/imageUtils'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function formatDate(ts) {
  if (!ts) return null
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return null
  return `${String(d.getDate()).padStart(2,'0')}/${MONTHS[d.getMonth()]}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const COLORS = ['#d97706','#059669','#2563eb','#7c3aed','#dc2626','#0891b2','#65a30d','#c026d3','#f97316','#06b6d4']

// ── Conversion helper (change 4) ──────────────────────────────────────────────
function getConvertedPrice(rawPrice, purchaseUnit, recipeUnit) {
  const pu = (purchaseUnit || '').toLowerCase()
  const ru = (recipeUnit || '').toLowerCase()
  const kgToG = (pu === 'kg' || pu === 'kilo' || pu === 'kilogramo' || pu === 'kgs') &&
                (ru === 'g' || ru === 'gr' || ru === 'gramo' || ru === 'grs' || ru === 'gramos')
  const ltToMl = (pu === 'lt' || pu === 'l' || pu === 'litro' || pu === 'lts' || pu === 'litros') &&
                 (ru === 'ml' || ru === 'mililitro' || ru === 'mililitros')
  return kgToG || ltToMl ? rawPrice / 1000 : rawPrice
}

// ── Category Combobox with quick-create (change 3) ────────────────────────────
function CategoryCombobox({ categories, value, onChange, restaurantId, isDark }) {
  const [query, setQuery] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [showMini, setShowMini] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const { success } = useToast()

  const selCat = categories.find((c) => c.id === value)

  useEffect(() => {
    if (selCat) setQuery(selCat.name)
    else if (!value) setQuery('')
  }, [selCat?.name, value])

  const filtered = query.length > 0
    ? (categories || []).filter((c) => c.name?.toLowerCase()?.includes(query.toLowerCase()))
    : (categories || [])
  const noMatch = query.length > 1 && filtered.length === 0

  const handleSelect = (cat) => {
    onChange(cat.id)
    setQuery(cat.name)
    setShowDrop(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const ref = await createCategory(restaurantId, { name: newName.trim(), color: newColor, order: Date.now() })
      onChange(ref.id)
      setQuery(newName.trim())
      setShowMini(false)
      setShowDrop(false)
      success(`Menú "${newName}" creado`)
    } catch { } finally { setSaving(false) }
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowDrop(true) }}
        onFocus={() => setShowDrop(true)}
        onBlur={() => setTimeout(() => setShowDrop(false), 160)}
        placeholder="Buscar o crear menú..."
        className={cn(
          'w-full px-3 h-9 text-sm rounded-lg border outline-none transition-colors focus:ring-2 focus:ring-gold-500 focus:border-gold-500',
          isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-200 text-gray-900'
        )}
      />
      {showDrop && (
        <div className={cn('absolute z-30 top-full left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-hidden max-h-48 overflow-y-auto',
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
          {filtered.map((cat) => (
            <button key={cat.id} type="button" onMouseDown={() => handleSelect(cat)}
              className={cn('w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2',
                isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-50 text-gray-700')}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#d97706' }} />
              {cat.name}
            </button>
          ))}
          {categories.length > 0 && (
            <button type="button" onMouseDown={() => { onChange(''); setQuery(''); setShowDrop(false) }}
              className={cn('w-full text-left px-3 py-2 text-sm transition-colors', isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-50 text-gray-400')}>
              Sin menú
            </button>
          )}
          {query.length > 1 && (
            <button type="button" onMouseDown={() => { setNewName(query); setShowMini(true); setShowDrop(false) }}
              className={cn('w-full text-left px-3 py-2 text-sm font-medium transition-colors text-gold-600', isDark ? 'hover:bg-gray-800' : 'hover:bg-gold-50')}>
              ＋ Crear menú "{query}"
            </button>
          )}
        </div>
      )}
      {showMini && (
        <div className={cn('mt-2 p-3 rounded-xl border space-y-2', isDark ? 'bg-gray-800 border-gray-700' : 'bg-amber-50 border-amber-200')}>
          <p className="text-xs font-semibold text-gold-600">Nuevo menú</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1).toLowerCase())}
            placeholder="Nombre del menú"
            className="h-8 text-sm"
          />
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className={cn('w-6 h-6 rounded-full transition-transform hover:scale-110', newColor === c && 'ring-2 ring-offset-1')}
                style={{ background: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowMini(false)}
              className={cn('text-xs px-3 py-1 rounded-lg border', isDark ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-600')}>
              Cancelar
            </button>
            <button type="button" onClick={handleCreate} disabled={saving || !newName.trim()}
              className="text-xs px-3 py-1 rounded-lg bg-gold-600 text-white hover:bg-gold-700 disabled:opacity-50">
              {saving ? '...' : 'Crear y seleccionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Media DropZone ───────────────────────────────────────────────────────────
function DropZone({ accept, label, icon: Icon, progress, previewURL, fileName, fileSize, onDrop, isDark, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) onDrop(file)
  }
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onDrop(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={disabled ? undefined : handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'relative rounded-xl border-2 border-dashed cursor-pointer transition-colors select-none',
        dragging ? 'border-[var(--accent)] bg-[var(--accent)]/5' : isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-400',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={{ minHeight: '100px' }}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} disabled={disabled} />
      {previewURL ? (
        <img src={previewURL} alt="preview" className="w-full h-32 object-cover rounded-xl" onError={() => {}} />
      ) : fileName ? (
        <div className="flex flex-col items-center justify-center py-4 gap-1">
          <Icon className="h-8 w-8" style={{ color: 'var(--accent)' }} />
          <p className={cn('text-xs font-medium truncate max-w-full px-2', isDark ? 'text-gray-300' : 'text-gray-700')}>{fileName}</p>
          {fileSize && <p className={cn('text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>{fileSize}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 gap-1">
          <Upload className={cn('h-6 w-6', isDark ? 'text-gray-600' : 'text-gray-400')} />
          <p className={cn('text-xs font-medium', isDark ? 'text-gray-500' : 'text-gray-500')}>{label}</p>
          <p className={cn('text-xs', isDark ? 'text-gray-700' : 'text-gray-400')}>Arrastra o haz clic</p>
        </div>
      )}
      {progress !== null && progress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200 rounded-b-xl overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${progress}%`, backgroundColor: 'var(--accent)' }} />
        </div>
      )}
    </div>
  )
}

// ── Ingredient Row ────────────────────────────────────────────────────────────
const INGREDIENT_CATEGORIES = ['Abarrotes', 'Fruver', 'Lácteos', 'Carnes', 'Mariscos', 'Licores', 'Bebidas', 'Especias', 'Otros']

function toTitleCase(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function IngredientRow({ index, field, allIngredients, allSubrecipes, allUnits, remove, register, watch, setValue, isDark, restaurantId, onAddRow, nameInputRef, isAdmin }) {
  const [query, setQuery] = useState(toTitleCase(field.description || field.ingredientName || ''))
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dropRect, setDropRect] = useState(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddPrice, setQuickAddPrice] = useState(0)
  const [quickAddPurchaseUnit, setQuickAddPurchaseUnit] = useState('')
  const [quickAddUnit, setQuickAddUnit] = useState('')
  const [quickAddCategory, setQuickAddCategory] = useState('')
  const [savingQuick, setSavingQuick] = useState(false)
  const [compatibleUnits, setCompatibleUnits] = useState(allUnits)
  const quantityInputRef = useRef(null)
  const localInputRef = useRef(null)
  const { success } = useToast()

  const updateDropRect = () => {
    if (localInputRef.current) setDropRect(localInputRef.current.getBoundingClientRect())
  }

  const qty = parseFloat(watch(`ingredients.${index}.quantity`)) || 0
  const rawPrice = parseFloat(watch(`ingredients.${index}.pricePerUnit`)) || 0
  const recipeUnit = watch(`ingredients.${index}.unit`) || ''
  const purchaseUnit = watch(`ingredients.${index}.purchaseUnit`) || ''
  const wasteMargin = parseFloat(watch(`ingredients.${index}.wasteMargin`)) || 0
  const rowType = watch(`ingredients.${index}.type`) || 'ingredient'
  const effectivePrice = rowType === 'subrecipe' ? rawPrice : getConvertedPrice(rawPrice, purchaseUnit, recipeUnit)
  const baseCost = qty * effectivePrice
  const wasteCost = baseCost * (wasteMargin / 100)
  const rowCost = baseCost + wasteCost

  const qLow = query.toLowerCase()
  const ingMatches = query.length > 1
    ? (allIngredients || []).filter((i) =>
        (i.description || '').toLowerCase().includes(qLow) ||
        (i.name || '').toLowerCase().includes(qLow) ||
        (i.code || '').toLowerCase().includes(qLow) ||
        (i.item || '').toLowerCase().includes(qLow)
      ).slice(0, 5)
    : []

  const subMatches = query.length > 1
    ? (allSubrecipes || [])
        .filter((s) => isAdmin || !s.pin)
        .filter((s) =>
          (s.name || '').toLowerCase().includes(qLow) ||
          (s.code || '').toLowerCase().includes(qLow)
        ).slice(0, 3)
    : []

  const noMatch = query.length > 1 && ingMatches.length === 0 && subMatches.length === 0

  const handleSelectIngredient = (ing) => {
    const ingUnitObj = (allUnits || []).find((u) => u.abbreviation === ing.unit)
    const filtered = ingUnitObj?.type
      ? (allUnits || []).filter((u) => u.type === ingUnitObj.type)
      : (allUnits || [])
    setCompatibleUnits(filtered.length > 0 ? filtered : allUnits)
    const displayName = toTitleCase(ing.description || ing.name || '')
    setValue(`ingredients.${index}.ingredientId`, ing.id)
    setValue(`ingredients.${index}.description`, displayName)
    setValue(`ingredients.${index}.unit`, ing.unit || '')
    setValue(`ingredients.${index}.purchaseUnit`, ing.purchaseUnit || '')
    setValue(`ingredients.${index}.pricePerUnit`, ing.pricePerUnit || 0)
    setValue(`ingredients.${index}.quantity`, null)
    setValue(`ingredients.${index}.type`, 'ingredient')
    setQuery(displayName)
    setShowSuggestions(false)
    setDropRect(null)
    setTimeout(() => { if (quantityInputRef.current) quantityInputRef.current.focus() }, 50)
  }

  const handleSelectSubrecipe = (sr) => {
    const yieldAmt = parseFloat(sr.yieldAmount) || 1
    const srTotal = parseFloat(sr.totalCost || sr.costPerPortion || 0)
    const unitCost = yieldAmt > 0 ? srTotal / yieldAmt : srTotal
    const displayName = toTitleCase(sr.name || '')
    setCompatibleUnits(allUnits)
    setValue(`ingredients.${index}.ingredientId`, sr.id)
    setValue(`ingredients.${index}.description`, displayName)
    setValue(`ingredients.${index}.unit`, sr.yieldUnit || 'und')
    setValue(`ingredients.${index}.purchaseUnit`, '')
    setValue(`ingredients.${index}.pricePerUnit`, unitCost)
    setValue(`ingredients.${index}.quantity`, null)
    setValue(`ingredients.${index}.type`, 'subrecipe')
    setQuery(displayName)
    setShowSuggestions(false)
    setDropRect(null)
    setTimeout(() => { if (quantityInputRef.current) quantityInputRef.current.focus() }, 50)
  }

  const handleQuickAdd = async () => {
    if (!quickAddCategory) { alert('Selecciona una categoría'); return }
    setSavingQuick(true)
    try {
      const code = await getNextIngredientCode(restaurantId)
      const newRef = await createIngredient(restaurantId, {
        code,
        description: quickAddName.charAt(0).toUpperCase() + quickAddName.slice(1).toLowerCase(),
        unit: quickAddUnit,
        purchaseUnit: quickAddPurchaseUnit,
        pricePerUnit: parseFloat(quickAddPrice) || 0,
        category: quickAddCategory,
        supplier: '',
      })
      handleSelectIngredient({
        id: newRef.id,
        description: quickAddName.charAt(0).toUpperCase() + quickAddName.slice(1).toLowerCase(),
        unit: quickAddUnit,
        purchaseUnit: quickAddPurchaseUnit,
        pricePerUnit: parseFloat(quickAddPrice) || 0,
      })
      setShowQuickAdd(false)
      success(`"${quickAddName}" agregado a materias primas`)
    } catch { } finally { setSavingQuick(false) }
  }

  const rowBg = isDark ? '#111827' : '#ffffff'

  return (
    <>
      <tr className={cn(isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50')} style={{ borderTop: `1px solid ${isDark ? '#1f2937' : '#f3f4f6'}` }}>
        {/* Producto */}
        <td style={{ padding: '5px 8px' }}>
          <input
            ref={(el) => { localInputRef.current = el; if (typeof nameInputRef === 'function') nameInputRef(el) }}
            value={query}
            onChange={(e) => {
              const v = e.target.value
              setQuery(v.charAt(0).toUpperCase() + v.slice(1))
              setValue(`ingredients.${index}.description`, v.charAt(0).toUpperCase() + v.slice(1))
              setCompatibleUnits(allUnits)
              updateDropRect()
              setShowSuggestions(true)
            }}
            onFocus={() => { updateDropRect(); setShowSuggestions(true) }}
            onBlur={() => setTimeout(() => { setShowSuggestions(false); setDropRect(null) }, 150)}
            placeholder="Buscar..."
            className={cn('w-full px-2 h-7 text-sm rounded-lg border outline-none focus:ring-1 focus:ring-gold-500',
              isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-200 text-gray-900')}
          />
          {/* Fixed-position dropdown — escapes overflow:scroll container */}
          {showSuggestions && dropRect && (ingMatches.length > 0 || subMatches.length > 0 || noMatch) && (
            <div className={cn('rounded-xl border shadow-xl overflow-hidden max-h-52 overflow-y-auto',
              isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}
              style={{ position: 'fixed', top: dropRect.bottom + 4, left: dropRect.left, width: Math.max(dropRect.width, 280), zIndex: 1000 }}>
              {ingMatches.length > 0 && (
                <>
                  <div className={cn('px-3 py-1 text-xs font-medium uppercase tracking-wider', isDark ? 'text-gray-500 bg-gray-800/60' : 'text-gray-400 bg-gray-50')}>Materias primas</div>
                  {ingMatches.map((s) => (
                    <button key={s.id} type="button" onMouseDown={() => handleSelectIngredient(s)}
                      className={cn('w-full text-left px-3 py-2 text-sm transition-colors', isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gold-50 text-gray-700')}>
                      <span className="font-medium">{toTitleCase(s.description || s.name)}</span>
                      <span className={cn('ml-2 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.code} · {s.unit} · {formatNumber(s.pricePerUnit)}</span>
                    </button>
                  ))}
                </>
              )}
              {subMatches.length > 0 && (
                <>
                  <div className={cn('px-3 py-1 text-xs font-medium uppercase tracking-wider', isDark ? 'text-gray-500 bg-gray-800/60' : 'text-gray-400 bg-gray-50')}>Sub-recetas</div>
                  {subMatches.map((s) => (
                    <button key={s.id} type="button" onMouseDown={() => handleSelectSubrecipe(s)}
                      className={cn('w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2', isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-purple-50 text-gray-700')}>
                      <span className="text-xs font-bold px-1 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>SUB</span>
                      <span className="font-medium">{toTitleCase(s.name)}</span>
                      <span className={cn('ml-auto text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.code}</span>
                      {s.pin && <Lock className="h-3 w-3 text-amber-500" />}
                    </button>
                  ))}
                </>
              )}
              {noMatch && (
                <button type="button" onMouseDown={() => { setQuickAddName(query); setShowQuickAdd(true); setShowSuggestions(false); setDropRect(null) }}
                  className={cn('w-full text-left px-3 py-2 text-sm font-medium text-gold-600', isDark ? 'hover:bg-gray-800' : 'hover:bg-gold-50')}>
                  ＋ Agregar "{query}" a Materias Primas
                </button>
              )}
            </div>
          )}
        </td>
        {/* Unidad */}
        <td style={{ padding: '5px 8px' }}>
          <select
            value={watch(`ingredients.${index}.unit`) || ''}
            onChange={(e) => setValue(`ingredients.${index}.unit`, e.target.value)}
            onBlur={() => { if (quantityInputRef.current) quantityInputRef.current.focus() }}
            className={cn('w-full px-2 h-7 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-gold-500',
              isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}
          >
            <option value="">--</option>
            {(compatibleUnits.length > 0 ? compatibleUnits : allUnits).map((u) => <option key={u.id} value={u.abbreviation}>{u.abbreviation}</option>)}
          </select>
        </td>
        {/* Cantidad */}
        <td style={{ padding: '5px 8px' }}>
          <input
            ref={quantityInputRef}
            type="number"
            step="0.001"
            min="0"
            placeholder="0"
            {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })}
            className={cn('w-full px-2 h-7 text-sm rounded-lg border outline-none text-right focus:ring-1 focus:ring-gold-500',
              isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}
          />
        </td>
        {/* Margen Desp. % */}
        <td style={{ padding: '5px 8px' }}>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="0"
            {...register(`ingredients.${index}.wasteMargin`, { valueAsNumber: true })}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey) {
                const desc = watch(`ingredients.${index}.description`)
                const q = watch(`ingredients.${index}.quantity`)
                if (desc && q) { e.preventDefault(); onAddRow() }
              }
            }}
            className={cn('w-full px-2 h-7 text-sm rounded-lg border outline-none text-right focus:ring-1 focus:ring-gold-500',
              isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}
          />
        </td>
        {/* Costo Unit. */}
        <td style={{ padding: '5px 8px', textAlign: 'right' }}>
          <span className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{formatNumber(effectivePrice)}</span>
        </td>
        {/* Costo Total */}
        <td style={{ padding: '5px 8px', textAlign: 'right' }}>
          <span className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>{formatNumber(rowCost)}</span>
          {wasteCost > 0 && (
            <span className="block text-xs" style={{ color: 'var(--accent)' }}>
              {formatNumber(baseCost)} +{formatNumber(wasteCost)}
            </span>
          )}
        </td>
        {/* Delete */}
        <td style={{ padding: '5px 4px', textAlign: 'center' }}>
          <button type="button" onClick={() => remove(index)}
            className="h-7 w-7 flex items-center justify-center text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 mx-auto">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>

      {/* Quick-add mini form */}
      {showQuickAdd && (
        <tr>
          <td colSpan={7} style={{ padding: '0 8px 8px' }}>
            <div className={cn('p-3 rounded-xl border space-y-2', isDark ? 'bg-gray-800 border-gray-700' : 'bg-amber-50 border-amber-200')}>
              <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Agregar a Materias Primas</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <input value={quickAddName} onChange={(e) => setQuickAddName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1).toLowerCase())}
                    className={cn('w-full px-2 h-7 text-xs rounded border outline-none', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300')} />
                </div>
                <div>
                  <Label className="text-xs">Categoría *</Label>
                  <select value={quickAddCategory} onChange={(e) => setQuickAddCategory(e.target.value)}
                    className={cn('w-full px-2 h-7 text-xs rounded border outline-none', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300', !quickAddCategory && 'border-red-300')}>
                    <option value="">Seleccionar...</option>
                    {INGREDIENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Precio/unidad</Label>
                  <input type="number" step="0.01" min="0" value={quickAddPrice} onChange={(e) => setQuickAddPrice(e.target.value)}
                    className={cn('w-full px-2 h-7 text-xs rounded border outline-none', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300')} />
                </div>
                <div>
                  <Label className="text-xs">Unidad de compra</Label>
                  <select value={quickAddPurchaseUnit} onChange={(e) => setQuickAddPurchaseUnit(e.target.value)}
                    className={cn('w-full px-2 h-7 text-xs rounded border outline-none', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300')}>
                    <option value="">--</option>
                    {(allUnits || []).map((u) => <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Unidad de uso</Label>
                  <select value={quickAddUnit} onChange={(e) => setQuickAddUnit(e.target.value)}
                    className={cn('w-full px-2 h-7 text-xs rounded border outline-none', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300')}>
                    <option value="">--</option>
                    {(allUnits || []).map((u) => <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowQuickAdd(false)} className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-100">Cancelar</button>
                <button type="button" onClick={handleQuickAdd} disabled={savingQuick || !quickAddCategory}
                  className="text-xs px-3 py-1 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                  {savingQuick ? '...' : 'Guardar y seleccionar'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Print Component ───────────────────────────────────────────────────────────
const PrintRecipe = ({ recipe, categories, allIngredients, restaurantName, forwardRef }) => {
  const cat = categories.find((c) => c.id === recipe?.categoryId)
  const ingList = (recipe?.ingredients || []).filter((i) => i.description || i.ingredientId)

  const createdDate = recipe?.createdAt?.toDate
    ? recipe.createdAt.toDate().toLocaleDateString('es-ES')
    : recipe?.createdAt
      ? new Date(recipe.createdAt).toLocaleDateString('es-ES')
      : null

  const prepSteps = (recipe?.preparation || '').split('\n').filter((s) => s.trim())

  const menuLabel = recipe?.isSubRecipe ? 'Sub-receta' : (cat?.name || null)

  const metaRows = [
    ['Menú', menuLabel],
    ['Código', recipe?.code],
    ['Item', recipe?.item],
    ['Referencia', recipe?.reference],
    recipe?.portions ? ['Porciones', recipe.portions] : null,
  ].filter((row) => row && row[1])

  return (
    <div ref={forwardRef} className="print-document">

      {/* ── HEADER ── */}
      <div className="print-header">
        {restaurantName && <div className="print-restaurant">{restaurantName}</div>}
        {cat && <div className="print-menu-name">{cat.name}</div>}
        <div className="print-header-line" />
        <h1 className="print-recipe-title">{recipe?.name}</h1>
      </div>

      {/* ── BODY ── */}
      <div className="print-body">

        {/* Left column — photo + meta */}
        <div className="print-col-left">
          {recipe?.photoURL ? (
            <div className="print-photo-wrap">
              <img src={recipe.photoURL} alt={recipe.name} />
            </div>
          ) : (
            <div className="print-no-photo">Sin foto</div>
          )}

          <div className="print-menu-box">
            <div className="print-menu-label">Menú</div>
            <div className="print-menu-value">{menuLabel || 'Sin menú'}</div>
          </div>
        </div>

        {/* Right column — ingredients + preparation */}
        <div className="print-col-right">
          <h2 className="print-section-title">Ingredientes</h2>
          {(recipe?.code || recipe?.item || recipe?.reference) && (
            <div className="print-meta-inline">
              {[recipe.code, recipe.item, recipe.reference].filter(Boolean).map((val, i) => (
                <span key={i} className="print-meta-chip">{val}</span>
              ))}
            </div>
          )}
          {ingList.length > 0 ? (
            <ul className="print-ing-list">
              {ingList.map((ing, i) => (
                <li key={i} className="print-ing-item">
                  <span className="print-ing-bullet" />
                  <span className="print-ing-qty">{ing.quantity}</span>
                  <span className="print-ing-unit">{ing.unit}</span>
                  <span className="print-ing-name">{ing.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '8.5pt', color: '#aaa', margin: '0 0 8mm' }}>Sin ingredientes</p>
          )}

          <h2 className="print-section-title">Procedimiento</h2>
          {prepSteps.length > 0 ? (
            <ol className="print-prep-list">
              {prepSteps.map((step, i) => (
                <li key={i} className="print-prep-item">
                  <span className="print-prep-num">{i + 1}.</span>
                  <span>{step.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ fontSize: '8.5pt', color: '#aaa', margin: 0 }}>Sin preparación</p>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="print-footer">
        <span className="print-footer-left">
          v{recipe?.version || 1}{createdDate ? ` · Creada ${createdDate}` : ''}
        </span>
        <span className="print-footer-center">{restaurantName?.toUpperCase()}</span>
        <span className="print-footer-right">Impresa: {new Date().toLocaleDateString('es-ES')}</span>
      </div>

    </div>
  )
}

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
  item: z.string().optional(),
  reference: z.string().optional(),
  categoryId: z.string().optional(),
  menuCode: z.string().optional(),
  recipeType: z.enum(['recipe', 'subrecipe']).default('recipe'),
  manualCost: z.coerce.number().min(0).optional(),
  useManualCost: z.boolean().default(false),
  preparation: z.string().optional(),
  notes: z.string().optional(),
  isSubRecipe: z.boolean().default(false),
  pin: z.string().max(4).optional(),
  photoURL: z.string().optional(),
  videoURL: z.string().optional(),
  yieldAmount: z.coerce.number().min(0).optional(),
  yieldUnit: z.string().optional(),
  ingredients: z.array(z.object({
    ingredientId: z.string().optional(),
    description: z.string().optional().default(''),
    quantity: z.coerce.number().min(0).default(0),
    unit: z.string().optional(),
    pricePerUnit: z.coerce.number().min(0).default(0),
    purchaseUnit: z.string().optional(),
    wasteMargin: z.coerce.number().min(0).max(100).default(0),
    type: z.enum(['ingredient', 'subrecipe']).default('ingredient'),
  })).default([]),
})

// ── Main Component ────────────────────────────────────────────────────────────
export default function RecipeDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = id === 'new'
  // Determine type from URL param (change 16)
  const typeFromUrl = searchParams.get('type') === 'subrecipe' ? 'subrecipe' : 'recipe'

  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentRestaurant, theme } = useAppStore()
  const { isAdmin } = useAuth()
  const { success, error } = useToast()
  const isDark = theme === 'night'
  const printRef = useRef()

  const [recipe, setRecipe] = useState(null)
  const [categories, setCategories] = useState([])
  const [allIngredients, setAllIngredients] = useState([])
  const [allSubrecipes, setAllSubrecipes] = useState([])
  const [allUnits, setAllUnits] = useState([])
  const [saving, setSaving] = useState(false)
  const [codeLoading, setCodeLoading] = useState(isNew)
  const [photoURL, setPhotoURL] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [pinVerified, setPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [videoURL, setVideoURL] = useState('')
  const [photoProgress, setPhotoProgress] = useState(null)
  const [videoProgress, setVideoProgress] = useState(null)
  const nameInputRefs = useRef([])
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])
  const [allRecipes, setAllRecipes] = useState([])
  const [dupErrors, setDupErrors] = useState({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [marginContribution, setMarginContribution] = useState(35)
  const [taxRate, setTaxRate] = useState(8)
  const [tipRate, setTipRate] = useState(10)

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', code: '', categoryId: '', menuCode: '', item: '', reference: '',
      isSubRecipe: typeFromUrl === 'subrecipe',
      useManualCost: false, manualCost: 0, recipeType: typeFromUrl, ingredients: [],
      preparation: '', notes: '', pin: '', yieldAmount: 0, yieldUnit: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'ingredients' })
  const ingredients = watch('ingredients') || []
  const isSubRecipe = watch('isSubRecipe')
  const useManualCost = watch('useManualCost')
  const manualCost = watch('manualCost') || 0
  const recipeType = watch('recipeType')

  // Cost calculation with unit conversion (includes waste margin)
  const totalCostCalc = (ingredients || []).reduce((acc, ing) => {
    if (!ing) return acc
    const eff = getConvertedPrice(parseFloat(ing.pricePerUnit || 0), ing.purchaseUnit || '', ing.unit || '')
    const base = parseFloat(ing.quantity || 0) * eff
    const waste = base * (parseFloat(ing.wasteMargin || 0) / 100)
    return acc + base + waste
  }, 0)
  const effectiveTotalCost = useManualCost ? (parseFloat(manualCost) || 0) : totalCostCalc
  const safeTotalCost = isNaN(effectiveTotalCost) ? 0 : effectiveTotalCost
  const yieldAmt = parseFloat(watch('yieldAmount')) || 0
  const costPerYieldUnit = isSubRecipe && yieldAmt > 0 ? safeTotalCost / yieldAmt : 0

  const suggestedPriceNoTax = marginContribution > 0 && marginContribution < 100
    ? safeTotalCost / (1 - marginContribution / 100)
    : 0
  const taxValue = suggestedPriceNoTax * (taxRate / 100)
  const suggestedPriceWithTax = suggestedPriceNoTax + taxValue
  const tipValue = suggestedPriceWithTax * (tipRate / 100)
  const suggestedPriceWithTip = suggestedPriceWithTax + tipValue

  useEffect(() => {
    if (!currentRestaurant?.id) return
    const u1 = subscribeCategories(currentRestaurant.id, setCategories)
    const u2 = subscribeIngredients(currentRestaurant.id, setAllIngredients)
    const u3 = subscribeUnits(currentRestaurant.id, setAllUnits)
    const u4 = subscribeRecipes(currentRestaurant.id, (all) => {
      setAllRecipes(all || [])
      setAllSubrecipes((all || []).filter((r) => r.isSubRecipe === true))
    })
    return () => { u1(); u2(); u3(); u4() }
  }, [currentRestaurant?.id])

  useEffect(() => {
    if (isNew && currentRestaurant?.id) {
      setCodeLoading(true)
      getNextRecipeCode(currentRestaurant.id, typeFromUrl).then((code) => {
        setValue('code', code)
        setCodeLoading(false)
      }).catch(() => setCodeLoading(false))
    }
  }, [isNew, currentRestaurant?.id, typeFromUrl])

  useEffect(() => {
    if (isNew || !currentRestaurant?.id || !id) return
    getRecipe(currentRestaurant.id, id).then((r) => {
      if (!r) return
      setRecipe(r)
      setPhotoURL(r.photoURL || '')
      setPhotoPreview(r.photoURL || '')
      setVideoURL(r.videoURL || '')
      setMarginContribution(r.costSettings?.marginContribution ?? 35)
      setTaxRate(r.costSettings?.taxRate ?? 8)
      setTipRate(r.costSettings?.tipRate ?? 10)
      reset({
        name: r.name, code: r.code, categoryId: r.categoryId || '',
        menuCode: r.menuCode || '',
        item: r.item || '', reference: r.reference || '',
        recipeType: r.recipeType || 'recipe',
        manualCost: r.manualCost || 0, useManualCost: r.useManualCost || false,
        preparation: r.preparation || '', notes: r.notes || '',
        isSubRecipe: r.isSubRecipe || false, pin: r.pin || '',
        yieldAmount: r.yieldAmount || 0, yieldUnit: r.yieldUnit || '',
        ingredients: (r.ingredients || []).map((ing) => ({
          ...ing,
          description: ing.description || ing.ingredientName || '',
        })),
        photoURL: r.photoURL || '',
        videoURL: r.videoURL || '',
      })
    })
  }, [id, currentRestaurant?.id, isNew])

  useEffect(() => {
    const head = document.getElementById('ing-scroll-head')
    const body = document.getElementById('ing-scroll-body')
    if (!head || !body) return
    // Body has the scrollbar; head mirrors it (head is overflow:hidden)
    const syncHead = () => { head.scrollLeft = body.scrollLeft }
    body.addEventListener('scroll', syncHead)
    return () => body.removeEventListener('scroll', syncHead)
  }, [fields.length])

  // Mark form dirty on any field change
  useEffect(() => {
    const sub = watch(() => setHasUnsavedChanges(true))
    return () => sub.unsubscribe()
  }, [watch])

  const safeNavigate = (path) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(path)
      setShowExitModal(true)
    } else {
      navigate(path)
    }
  }

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleSave = () => handleSubmit(onSubmit)()

  const handlePrint = useReactToPrint({ contentRef: printRef })

  const handlePrintClick = async () => {
    document.body.setAttribute('data-rest-name', currentRestaurant?.name || 'RecetarioPro')
    if (!isNew && currentRestaurant?.id && id) {
      try {
        await updateDoc(doc(db, 'restaurants', currentRestaurant.id, 'recipes', id), { printedAt: serverTimestamp() })
        setRecipe((prev) => prev ? { ...prev, printedAt: { toDate: () => new Date() } } : prev)
      } catch { /* non-critical */ }
    }
    setTimeout(() => handlePrint(), 150)
  }

  const handlePhotoDrop = async (file) => {
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (ev) => { if (isMountedRef.current) setPhotoPreview(ev.target.result) }
    reader.readAsDataURL(file)

    const restId = currentRestaurant?.id
    if (!restId) return

    if (isMountedRef.current) {
      setPhotoUploading(true)
      setPhotoProgress(0)
    }

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.75,
        outputFormat: 'image/webp',
      })

      const recId = !isNew ? id : `temp_${Date.now()}`

      const url = await uploadRecipeFile(
        restId,
        recId,
        compressed,
        'photo',
        (pct) => { if (isMountedRef.current) setPhotoProgress(pct) }
      )

      if (isMountedRef.current) {
        setPhotoURL(url)
        setPhotoPreview(url)
        setValue('photoURL', url)
      }
    } catch (err) {
      console.error('Error subiendo foto:', err)
      if (isMountedRef.current) {
        error('Error al subir foto: ' + (err?.message || err))
      }
    } finally {
      if (isMountedRef.current) {
        setPhotoUploading(false)
        setPhotoProgress(null)
      }
    }
  }

  const checkRecipeDup = (field, value) => {
    if (!value) { setDupErrors((prev) => ({ ...prev, [field]: null })); return }
    const lv = value.toLowerCase()
    const dup = (allRecipes || []).find((r) => r.id !== id && (r[field] || '').toLowerCase() === lv)
    setDupErrors((prev) => ({ ...prev, [field]: dup ? `Ya existe una receta con este campo` : null }))
  }

  // Auto-add new ingredient row (change 8)
  const handleAddRow = () => {
    append({ ingredientId: '', description: '', quantity: null, unit: '', pricePerUnit: 0, purchaseUnit: '', wasteMargin: 0, type: 'ingredient' })
    setTimeout(() => {
      const refs = nameInputRefs.current
      if (refs[refs.length - 1]) refs[refs.length - 1].focus()
    }, 50)
  }

  const onSubmit = async (data) => {
    if (!currentRestaurant?.id) { error('No hay restaurante configurado'); return }
    setSaving(true)
    try {
      const cleanIngredients = (data.ingredients || [])
        .filter((ing) => ing?.description && ing.description.trim() !== '')
        .map((ing) => {
          const eff = getConvertedPrice(parseFloat(ing.pricePerUnit || 0), ing.purchaseUnit || '', ing.unit || '')
          const base = parseFloat(ing.quantity || 0) * eff
          const waste = base * (parseFloat(ing.wasteMargin || 0) / 100)
          const clean = {}
          for (const [k, v] of Object.entries(ing || {})) {
            if (v === undefined || v === null) continue
            if (typeof v === 'number' && isNaN(v)) { clean[k] = 0; continue }
            clean[k] = v
          }
          clean.baseCost = isNaN(base) ? 0 : base
          clean.wasteCost = isNaN(waste) ? 0 : waste
          clean.totalCost = isNaN(base + waste) ? 0 : base + waste
          return clean
        })
      const payload = {
        ...data,
        item: data.item || null,
        reference: data.reference || null,
        ingredients: cleanIngredients,
        name: (data.name || '').toUpperCase(),
        categoryId: isSubRecipe ? null : (data.categoryId || null),
        menuCode: data.menuCode || null,
        notes: data.notes || null,
        preparation: data.preparation || null,
        pin: data.pin || null,
        photoURL: data.photoURL || photoURL || null,
        videoURL: data.videoURL || videoURL || null,
        yieldAmount: data.yieldAmount || null,
        yieldUnit: data.yieldUnit || null,
        costPerYieldUnit: isSubRecipe && yieldAmt > 0 ? costPerYieldUnit : null,
        totalCost: isNaN(totalCostCalc) ? 0 : totalCostCalc,
        costSettings: { marginContribution, taxRate, tipRate },
        calculatedCosts: {
          totalCost: isNaN(totalCostCalc) ? 0 : totalCostCalc,
          suggestedPriceNoTax: isNaN(suggestedPriceNoTax) ? 0 : suggestedPriceNoTax,
          suggestedPriceWithTax: isNaN(suggestedPriceWithTax) ? 0 : suggestedPriceWithTax,
          suggestedPriceWithTip: isNaN(suggestedPriceWithTip) ? 0 : suggestedPriceWithTip,
        },
      }
      const restaurantId = currentRestaurant?.id
      if (!restaurantId) { error('No hay restaurante seleccionado'); return }

      console.log('[SAVE] restaurantId:', restaurantId, '| recipeId:', id)
      console.log('[SAVE] data.photoURL:', data.photoURL)
      console.log('[SAVE] photoURL state:', photoURL)
      console.log('[SAVE] payload.photoURL:', payload.photoURL)

      const safePayload = JSON.parse(JSON.stringify(payload, (key, value) => {
        if (value === undefined) return null
        if (typeof value === 'number' && isNaN(value)) return 0
        return value
      }))

      const isNewRecipe = !id || id === 'new' || id === undefined || id === null

      // Ensure code is generated if missing (fallback for timing issues)
      if (isNewRecipe && !safePayload.code) {
        safePayload.code = await getNextRecipeCode(restaurantId, safePayload.recipeType || 'recipe')
      }

      if (isNewRecipe) {
        const docRef = await createRecipe(restaurantId, safePayload)
        console.log('Receta creada con ID:', docRef.id)
        success('Receta creada exitosamente')
        setHasUnsavedChanges(false)
        navigate(`/recipes/${docRef.id}`)
      } else {
        await updateRecipe(restaurantId, id, safePayload)
        console.log('Receta actualizada:', id)
        success('Receta guardada exitosamente')
        setHasUnsavedChanges(false)
      }
    } catch (err) {
      console.error('Recipe save error:', err?.message, err?.stack)
      if (err?.code === 'permission-denied') {
        error('Sin permisos. Verifica las reglas de seguridad en Firestore.')
      } else if (err?.code === 'unavailable') {
        error('Sin conexión. Los cambios se guardarán al reconectarte.')
      } else if (err?.code === 'not-found') {
        error('Receta no encontrada. Puede haber sido eliminada.')
      } else {
        error(err?.message || 'Error al guardar la receta')
      }
    } finally { setSaving(false) }
  }

  const hasErrors = Object.keys(errors).length > 0

  const handleUpload = async (file, type) => {
    if (!currentRestaurant?.id || isNew) return
    const setProgress = type === 'video' ? setVideoProgress : setPhotoProgress
    setProgress(0)
    try {
      const url = await uploadRecipeFile(currentRestaurant.id, id, file, type, setProgress)
      if (type === 'video') setVideoURL(url)
      else setPhotoURL(url)
      setProgress(100)
    } catch (err) {
      error('Error al subir archivo: ' + (err?.message || err))
      setProgress(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Sticky action bar — scoped to this component, unmounts with it ── */}
      <div
        className="sticky-actions no-print"
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: isDark ? 'rgba(3,7,18,0.97)' : 'rgba(243,244,246,0.97)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
          marginLeft: '-1.25rem', marginRight: '-1.25rem',
          padding: '8px 1.25rem',
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
        }}
      >
        {!isNew && recipe && isAdmin && (
          <Button variant="outline" size="sm" onClick={() => toggleRecipeActive(currentRestaurant.id, id, recipe.active === false)}>
            {recipe.active !== false ? <><ToggleRight className="h-4 w-4 text-emerald-500" /> Desactivar</> : <><ToggleLeft className="h-4 w-4 text-gray-400" /> Activar</>}
          </Button>
        )}
        {!isNew && (
          <Button variant="outline" size="sm" onClick={handlePrintClick}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        )}
        <Button onClick={handleSubmit(onSubmit)} disabled={saving || hasErrors || photoUploading}>
          <Save className="h-4 w-4" /> {saving ? 'Guardando...' : photoUploading ? 'Subiendo foto...' : 'Guardar'}
        </Button>
      </div>

      {/* Title row */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => safeNavigate('/')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className={cn('font-display text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {isNew ? (typeFromUrl === 'subrecipe' ? 'Nueva sub-receta' : 'Nueva receta') : (watch('name') || recipe?.name || 'Cargando...')}
          </h1>
          {!isNew && recipe && (
            <>
              <p className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                v{recipe.version || 1} · {recipe.active !== false ? 'Activa' : 'Inactiva'}
              </p>
              <p style={{ fontSize: '0.72rem', color: isDark ? '#4b5563' : '#9ca3af' }}>
                Creada: {formatDate(recipe.createdAt) || '—'} | Última impresión: {formatDate(recipe.printedAt) || 'Nunca'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── PIN gate for protected sub-recipes ───────────────────────────── */}
      {!isNew && recipe?.isSubRecipe && recipe?.pin && !pinVerified && !isAdmin && (
        <Card className={cn('max-w-sm mx-auto', isDark && 'bg-gray-900 border-gray-800')}>
          <CardContent className="pt-6 space-y-4 text-center">
            <Lock className="h-10 w-10 mx-auto" style={{ color: 'var(--accent)' }} />
            <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>Contenido protegido</p>
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>Ingresa el PIN para ver los detalles de esta sub-receta</p>
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN (4 dígitos)"
              className={cn('w-32 mx-auto block px-3 h-10 text-center text-lg tracking-widest rounded-lg border outline-none focus:ring-2',
                isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}
            />
            <Button onClick={() => {
              if (pinInput === recipe.pin) { setPinVerified(true); setPinInput('') }
              else { alert('PIN incorrecto'); setPinInput('') }
            }} type="button" disabled={pinInput.length < 1}>
              Verificar PIN
            </Button>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: (!isNew && recipe?.isSubRecipe && recipe?.pin && !pinVerified && !isAdmin) ? 'none' : undefined }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic info */}
            <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
              <CardHeader><CardTitle>Información básica</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Code + Item + Reference — same row */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '12px' }}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código</Label>
                    <div className={cn('px-3 py-2 rounded-lg text-sm font-mono font-bold h-9 flex items-center', isDark ? 'bg-gray-800 text-gold-400' : 'bg-gold-50 text-gold-700')}>
                      {codeLoading ? '...' : (watch('code') || '—')}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Item</Label>
                    <Input
                      {...register('item')}
                      placeholder="SKU / cód. interno"
                      className="h-9"
                      onBlur={(e) => checkRecipeDup('item', e.target.value)}
                    />
                    {dupErrors.item && <p className="text-xs text-amber-500">{dupErrors.item}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Referencia</Label>
                    <Input
                      {...register('reference')}
                      placeholder="Ref. proveedor"
                      className="h-9"
                      onBlur={(e) => checkRecipeDup('reference', e.target.value)}
                    />
                    {dupErrors.reference && <p className="text-xs text-amber-500">{dupErrors.reference}</p>}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input
                    {...register('name')}
                    onChange={(e) => setValue('name', e.target.value.toUpperCase(), { shouldValidate: true })}
                    placeholder="NOMBRE DE LA RECETA"
                    className={cn('font-semibold tracking-wide', errors.name ? 'border-red-400' : '')}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message || 'Requerido'}</p>}
                </div>

                {/* Menu — full width, hidden for sub-recipes */}
                {!isSubRecipe && (
                  <div className="space-y-1.5">
                    <Label>Menú *</Label>
                    <CategoryCombobox
                      categories={categories}
                      value={watch('categoryId') || ''}
                      onChange={(v) => {
                        setValue('categoryId', v, { shouldValidate: true })
                        const cat = categories.find((c) => c.id === v)
                        if (cat?.code) setValue('menuCode', cat.code)
                      }}
                      restaurantId={currentRestaurant?.id}
                      isDark={isDark}
                    />
                    {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message || 'Selecciona un menú'}</p>}
                  </div>
                )}

                {/* menuCode — shown for all recipes */}
                {!isSubRecipe && (
                  <div className="space-y-1.5">
                    <Label>Código Menú</Label>
                    <Input
                      {...register('menuCode')}
                      placeholder="Ej: BAR01, ONI01, COMP01"
                    />
                  </div>
                )}

                {isSubRecipe && (
                  <>
                    {/* Yield fields — only for sub-recipes */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Rendimiento *</Label>
                        <Input
                          type="number" step="0.001" min="0.001"
                          {...register('yieldAmount')}
                          placeholder="Ej: 1.5"
                          className={errors.yieldAmount ? 'border-red-400' : ''}
                        />
                        {errors.yieldAmount && <p className="text-xs text-red-500">{errors.yieldAmount.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unidad de rendimiento</Label>
                        <select
                          value={watch('yieldUnit') || ''}
                          onChange={(e) => setValue('yieldUnit', e.target.value)}
                          className={cn('w-full px-2 h-9 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-gold-500',
                            isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}
                        >
                          <option value="">--</option>
                          {allUnits.map((u) => <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>)}
                        </select>
                      </div>
                    </div>
                    {yieldAmt > 0 && (
                      <div className={cn('flex items-center justify-between px-3 py-2 rounded-lg text-sm', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                          Costo por {watch('yieldUnit') || 'unidad'}
                        </span>
                        <span className="font-bold" style={{ color: 'var(--accent)' }}>
                          {formatNumber(costPerYieldUnit)}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> PIN de acceso (4 dígitos, opcional)</Label>
                      <Input {...register('pin')} type="password" maxLength={4} placeholder="" className="max-w-28 text-center tracking-widest" />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Ingredients */}
            <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
              <CardHeader>
                <CardTitle>Ingredientes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <style>{`
                  #ing-scroll-body::-webkit-scrollbar { height: 8px; }
                  #ing-scroll-body::-webkit-scrollbar-track { background: ${isDark ? '#111827' : '#f9fafb'}; }
                  #ing-scroll-body::-webkit-scrollbar-thumb { background: ${isDark ? '#374151' : '#d1d5db'}; border-radius: 4px; }
                `}</style>
                {fields.length === 0 ? (
                  <div className={cn('mx-6 mb-4 text-center py-6 rounded-xl border-2 border-dashed', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400')}>
                    <p className="text-sm">No hay ingredientes. Agrega el primero.</p>
                  </div>
                ) : (
                  <>
                    {/* Header — overflow-x hidden (no scrollbar), synced by JS */}
                    <div id="ing-scroll-head" style={{ overflowX: 'hidden' }}>
                      <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '240px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '80px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '40px' }} />
                        </colgroup>
                        <thead>
                          <tr className={cn('text-xs font-medium uppercase tracking-wider', isDark ? 'text-gray-500 bg-gray-900' : 'text-gray-400 bg-white')}
                            style={{ borderBottom: `1px solid ${isDark ? '#1f2937' : '#f3f4f6'}` }}>
                            <th style={{ padding: '8px 8px', textAlign: 'left' }}>Producto</th>
                            <th style={{ padding: '8px 8px', textAlign: 'left' }}>Unidad</th>
                            <th style={{ padding: '8px 8px', textAlign: 'right' }}>Cantidad</th>
                            <th style={{ padding: '8px 8px', textAlign: 'right' }}>Desp.%</th>
                            <th style={{ padding: '8px 8px', textAlign: 'right' }}>Costo U.</th>
                            <th style={{ padding: '8px 8px', textAlign: 'right' }}>Costo Total</th>
                            <th style={{ padding: '8px 4px' }} />
                          </tr>
                        </thead>
                      </table>
                    </div>
                    {/* Body — overflow-x scroll (scrollbar appears at bottom of rows) */}
                    <div id="ing-scroll-body" style={{ overflowX: 'scroll', scrollbarWidth: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '240px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '80px' }} />
                          <col style={{ width: '90px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '40px' }} />
                        </colgroup>
                        <tbody>
                          {fields.map((field, index) => (
                            <IngredientRow
                              key={field.id}
                              index={index}
                              field={field}
                              allIngredients={allIngredients}
                              allSubrecipes={allSubrecipes}
                              allUnits={allUnits}
                              remove={remove}
                              register={register}
                              watch={watch}
                              setValue={setValue}
                              isDark={isDark}
                              restaurantId={currentRestaurant?.id}
                              onAddRow={handleAddRow}
                              nameInputRef={(el) => { nameInputRefs.current[index] = el }}
                              isAdmin={isAdmin}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={cn('flex justify-between px-4 py-2 border-t font-medium text-sm', isDark ? 'border-gray-800' : 'border-gray-100')}>
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Total ingredientes</span>
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>{formatNumber(totalCostCalc)}</span>
                    </div>
                  </>
                )}
                {/* Add ingredient button */}
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Plus className="h-4 w-4" /> Nuevo ingrediente
                  </button>
                </div>
              </CardContent>
            </Card>


            {/* Preparation */}
            <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
              <CardHeader><CardTitle>Preparación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <textarea {...register('preparation')} rows={6} placeholder="Describe el proceso paso a paso..."
                  className={cn('w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500',
                    isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-200 placeholder:text-gray-400')} />
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <textarea {...register('notes')} rows={3} placeholder="Alérgenos, variaciones, recomendaciones..."
                    className={cn('w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500',
                      isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-200 placeholder:text-gray-400')} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Cost summary — always visible */}
            <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Costos</CardTitle>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  useManualCost
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                )}>
                  {useManualCost ? 'Manual' : 'Calculado'}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {isAdmin && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Costo manual</p>
                      <p className={cn('text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>Sobreescribe el calculado</p>
                    </div>
                    <Switch checked={useManualCost} onCheckedChange={(v) => setValue('useManualCost', v)} />
                  </div>
                )}
                {isAdmin && useManualCost && (
                  <div className="space-y-1">
                    <Label className="text-xs">Costo total manual</Label>
                    <Input type="number" step="0.01" min="0" {...register('manualCost')} />
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Costo total ingredientes</span>
                  <span className={cn('font-bold', isDark ? 'text-gold-400' : 'text-gold-700')} style={{ color: 'var(--accent)' }}>
                    {formatNumber(effectiveTotalCost)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Marginal Cost Analysis — admin only */}
            {isAdmin && (
              <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Análisis marginal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Sliders */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Margen contribución</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{marginContribution}%</span>
                    </div>
                    <input type="range" min="1" max="99" value={marginContribution}
                      onChange={(e) => setMarginContribution(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full accent-[var(--accent)]" />
                    <div className="flex justify-between text-xs">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Impuesto</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{taxRate}%</span>
                    </div>
                    <input type="range" min="0" max="30" value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full accent-[var(--accent)]" />
                    <div className="flex justify-between text-xs">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Propina</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{tipRate}%</span>
                    </div>
                    <input type="range" min="0" max="30" value={tipRate}
                      onChange={(e) => setTipRate(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full accent-[var(--accent)]" />
                  </div>
                  {/* Results table */}
                  <div className={cn('rounded-lg overflow-hidden border', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    {[
                      { label: 'Precio s/imp', val: suggestedPriceNoTax },
                      { label: `IVA (${taxRate}%)`, val: taxValue },
                      { label: 'Precio c/imp', val: suggestedPriceWithTax, accent: true },
                      { label: `Propina (${tipRate}%)`, val: tipValue },
                      { label: 'Precio final', val: suggestedPriceWithTip, bold: true },
                    ].map(({ label, val, accent, bold }) => (
                      <div key={label} className={cn('flex justify-between px-3 py-1.5 text-xs border-b last:border-0',
                        isDark ? 'border-gray-800' : 'border-gray-50')}>
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
                        <span className={cn('font-mono', bold ? 'font-bold' : '', accent ? 'font-semibold'  : '')}
                          style={accent || bold ? { color: 'var(--accent)' } : {}}>
                          {formatNumber(isNaN(val) ? 0 : val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Photo + Video */}
            <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4 text-gold-600" /> Foto y Video</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {isNew && (
                  <p className={cn('text-xs rounded-lg px-3 py-2', isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400')}>
                    Guarda la receta primero para subir archivos multimedia.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Foto</Label>
                    <div className="relative">
                      <DropZone
                        accept="image/jpeg,image/png,image/webp"
                        label="Foto de la receta"
                        icon={ImageIcon}
                        progress={photoProgress}
                        previewURL={photoPreview}
                        isDark={isDark}
                        onDrop={handlePhotoDrop}
                      />
                      {photoUploading && (
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: '0.75rem',
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '0.8rem', fontWeight: 600,
                        }}>
                          {photoProgress === 0 ? 'Optimizando imagen...' : `Subiendo ${photoProgress}%`}
                        </div>
                      )}
                    </div>
                    {photoPreview && (
                      <button type="button" onClick={() => { setPhotoURL(''); setPhotoPreview(''); setPhotoProgress(null) }}
                        className={cn('text-xs', isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}>
                        Quitar foto
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Video className="h-3.5 w-3.5" /> Video</Label>
                    <DropZone
                      accept="video/mp4,video/quicktime,video/webm"
                      label="Video de preparación"
                      icon={Video}
                      progress={videoProgress}
                      fileName={videoURL ? videoURL.split('/').pop().split('?')[0].replace(/^\d+_/, '') : null}
                      fileSize={null}
                      disabled={isNew}
                      isDark={isDark}
                      onDrop={(file) => handleUpload(file, 'video')}
                    />
                    {videoURL && !isNew && (
                      <button type="button" onClick={() => { setVideoURL(''); setVideoProgress(null) }}
                        className={cn('text-xs', isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}>
                        Quitar video
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Version info */}
            {!isNew && recipe && (
              <div className={cn('px-4 py-3 rounded-xl border text-xs', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-100 text-gray-400')}>
                <p>Versión: <span className="font-mono font-bold">v{recipe.version || 1}</span></p>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Hidden print view */}
      <div className="hidden">
        <PrintRecipe recipe={{ ...watch(), photoURL: photoPreview || photoURL, id, createdAt: recipe?.createdAt, version: recipe?.version }} categories={categories} allIngredients={allIngredients} restaurantName={currentRestaurant?.name} forwardRef={printRef} />
      </div>

      {/* ── Unsaved changes modal ── */}
      {showExitModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: isDark ? '#1f2937' : '#ffffff',
            borderRadius: 16, padding: 32,
            width: 'min(420px, 90vw)',
            display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
          }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 700, margin: 0, color: isDark ? '#f9fafb' : '#111827' }}>
              ¿Salir sin guardar?
            </h3>
            <p style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '.88rem', margin: 0 }}>
              Tienes cambios sin guardar. ¿Qué deseas hacer?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="outline" size="sm" onClick={() => setShowExitModal(false)}>
                Seguir editando
              </Button>
              <Button variant="outline" size="sm"
                style={{ borderColor: '#ef4444', color: '#ef4444' }}
                onClick={() => { setShowExitModal(false); navigate(pendingNavigation) }}
              >
                Salir sin guardar
              </Button>
              <Button size="sm" onClick={async () => { setShowExitModal(false); await handleSave(); navigate(pendingNavigation) }}>
                <Save className="h-4 w-4" /> Guardar y salir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
