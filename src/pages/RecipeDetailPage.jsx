import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Save, Printer, Plus, Trash2, Lock, ToggleRight, ToggleLeft, ImageIcon, Video, Upload, Info } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../lib/firebase'
import { ref as storageRef, deleteObject } from 'firebase/storage'

import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { logAction, detectChanges, detectIngredientChanges } from '../services/auditService'
import { RecipeReadOnlyView } from '../components/RecipeReadOnlyView'
import { PrintRecipe } from '../components/PrintRecipe'
import { RecipeNotes } from '../components/RecipeNotes'
import { IngredientSourceModal } from '../components/IngredientSourceModal'
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
import { getConvertedPrice } from '../utils/costUtils'
import { assertVersionFresh } from '../utils/versionCheck'
import { usePlan } from '../hooks/usePlan'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function formatDate(ts) {
  if (!ts) return null
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return null
  return `${String(d.getDate()).padStart(2,'0')}/${MONTHS[d.getMonth()]}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const COLORS = ['#0833A2','#059669','#2563eb','#062280','#dc2626','#0891b2','#65a30d','#1D5BD4','#0A3FC8','#06b6d4']


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

const getIngBadge = (ref) => {
  const r = (ref || '').toUpperCase().trim()
  if (r.startsWith('ONISUB') || r.startsWith('BARSB'))
    return { color: 'var(--blue)', bg: 'rgba(37,99,235,0.12)', label: r }
  if (r.startsWith('MP') || r.startsWith('ONI'))
    return { color: 'var(--green)', bg: 'rgba(22,163,74,0.12)', label: r }
  return { color: 'var(--t2)', bg: 'var(--bg3)', label: r || '—' }
}

// Estructura por defecto de un ingrediente vacio. Usada para el "capture row"
// fijo arriba de la lista (donde se captura el siguiente ingrediente sin tener
// que clickear "agregar nueva fila" cada vez).
const EMPTY_INGREDIENT = {
  ingredientId: '', description: '', quantity: null, unit: '',
  pricePerUnit: 0, purchaseUnit: '', wasteMargin: 0, type: 'ingredient',
}

function IngredientRow({ index, field, allIngredients, allSubrecipes, allUnits, remove, register, watch, setValue, isDark, restaurantId, onAddRow, onCommit, isCapture, nameInputRef, isAdmin, canEdit }) {
  const [query, setQuery] = useState(toTitleCase(field.description || field.ingredientName || ''))
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dropRect, setDropRect] = useState(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddData, setQuickAddData] = useState({})
  const [savingQuick, setSavingQuick] = useState(false)
  const [compatibleUnits, setCompatibleUnits] = useState(allUnits)
  const [showSourceModal, setShowSourceModal] = useState(false)
  const quantityInputRef = useRef(null)
  const localInputRef = useRef(null)
  const referenceInputRef = useRef(null)
  const { success } = useToast()

  const updateDropRect = () => {
    if (localInputRef.current) setDropRect(localInputRef.current.getBoundingClientRect())
  }

  const qty = parseFloat(watch(`ingredients.${index}.quantity`)) || 0
  const rawPrice = parseFloat(watch(`ingredients.${index}.pricePerUnit`)) || 0
  const recipeUnit = watch(`ingredients.${index}.unit`) || ''
  // Normalize case: find the unit in catalog by case-insensitive match
  const normalizedUnit = useMemo(() => {
    if (!recipeUnit) return ''
    const found = (allUnits || []).find(
      (u) => u.abbreviation?.toUpperCase().trim() === recipeUnit.toUpperCase().trim()
    )
    return found?.abbreviation || recipeUnit
  }, [recipeUnit, allUnits])
  // Sync normalized value back to form state so save is correct
  useEffect(() => {
    if (normalizedUnit && normalizedUnit !== recipeUnit) {
      setValue(`ingredients.${index}.unit`, normalizedUnit)
    }
  }, [normalizedUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al abrir el modal "Agregar a MP", el nombre ya viene pre-llenado desde el
  // buscador. Movemos el foco directo a Referencia para no perder un Tab.
  useEffect(() => {
    if (showQuickAdd) {
      setTimeout(() => { referenceInputRef.current?.focus() }, 60)
    }
  }, [showQuickAdd])
  const purchaseUnit = watch(`ingredients.${index}.purchaseUnit`) || ''
  const wasteMargin = parseFloat(watch(`ingredients.${index}.wasteMargin`)) || 0
  const rowType = watch(`ingredients.${index}.type`) || 'ingredient'
  const effectivePrice = rowType === 'subrecipe' ? rawPrice : getConvertedPrice(rawPrice, purchaseUnit, recipeUnit)
  const baseCost = qty * effectivePrice
  const wasteCost = baseCost * (wasteMargin / 100)
  const rowCost = baseCost + wasteCost

  const qLow = query.toLowerCase().trim()
  // Score: 0 = inicio exacto del nombre, 1 = inicio de cualquier campo, 2 = contiene
  const scoreIng = (i) => {
    const name = (i.name || '').toLowerCase()
    const desc = (i.description || '').toLowerCase()
    const code = (i.code || '').toLowerCase()
    const item = (i.item || '').toLowerCase()
    if (name === qLow || desc === qLow) return 0
    if (name.startsWith(qLow) || desc.startsWith(qLow)) return 1
    if (code.startsWith(qLow) || item.startsWith(qLow)) return 2
    if (name.includes(qLow) || desc.includes(qLow) || code.includes(qLow) || item.includes(qLow)) return 3
    return 99
  }
  const ingMatches = qLow.length > 1
    ? (allIngredients || [])
        .map((i) => ({ i, s: scoreIng(i) }))
        .filter(({ s }) => s < 99)
        .sort((a, b) => a.s - b.s || (a.i.name || '').localeCompare(b.i.name || '', 'es'))
        .slice(0, 12)
        .map(({ i }) => i)
    : []

  const scoreSub = (s) => {
    const name = (s.name || '').toLowerCase()
    const code = (s.code || '').toLowerCase()
    if (name === qLow) return 0
    if (name.startsWith(qLow)) return 1
    if (code.startsWith(qLow)) return 2
    if (name.includes(qLow) || code.includes(qLow)) return 3
    return 99
  }
  const subMatches = qLow.length > 1
    ? (allSubrecipes || [])
        .filter((s) => isAdmin || !s.pin)
        .map((s) => ({ s, sc: scoreSub(s) }))
        .filter(({ sc }) => sc < 99)
        .sort((a, b) => a.sc - b.sc || (a.s.name || '').localeCompare(b.s.name || '', 'es'))
        .slice(0, 8)
        .map(({ s }) => s)
    : []

  const noMatch = query.length > 1 && ingMatches.length === 0 && subMatches.length === 0

  const handleSelectIngredient = (ing) => {
    const ingUnitObj = (allUnits || []).find((u) => u.abbreviation?.toUpperCase().trim() === (ing.useUnit || ing.unit)?.toUpperCase().trim())
    const filtered = ingUnitObj?.type
      ? (allUnits || []).filter((u) => u.type === ingUnitObj.type)
      : (allUnits || [])
    setCompatibleUnits(filtered.length > 0 ? filtered : allUnits)
    const displayName = toTitleCase(ing.description || ing.name || '')
    // Compute pricePerUnit from value/quantityPerPresentation if not explicitly set
    const qty = parseFloat(ing.quantityPerPresentation) || 0
    const val = parseFloat(ing.value) || 0
    const calculatedPrice = parseFloat(ing.pricePerUnit) || (qty > 0 ? val / qty : 0)
    setValue(`ingredients.${index}.ingredientId`, ing.id)
    setValue(`ingredients.${index}.description`, displayName)
    setValue(`ingredients.${index}.ingredientName`, displayName)
    setValue(`ingredients.${index}.reference`, ing.reference || ing.item || '')
    setValue(`ingredients.${index}.unit`, ing.useUnit || ing.unit || '')
    setValue(`ingredients.${index}.purchaseUnit`, ing.purchaseUnit || '')
    setValue(`ingredients.${index}.pricePerUnit`, calculatedPrice)
    setValue(`ingredients.${index}.quantity`, null)
    setValue(`ingredients.${index}.type`, 'ingredient')
    setQuery(displayName)
    setShowSuggestions(false)
    setDropRect(null)
    setTimeout(() => { if (quantityInputRef.current) quantityInputRef.current.focus() }, 50)
  }

  const handleSelectSubrecipe = (sr) => {
    // Use the per-yield-unit cost — never the raw totalCost.
    // Priority: stored costPerYieldUnit → derived from totalCost / yieldAmount → 0
    const yieldAmt = parseFloat(sr.yieldAmount) || 0
    const stored = parseFloat(sr.costPerYieldUnit)
    const srTotal = parseFloat(sr.totalCost || sr.costPerPortion || 0)
    const unitCost = !isNaN(stored) && stored > 0
      ? stored
      : (yieldAmt > 0 ? srTotal / yieldAmt : 0)
    const displayName = toTitleCase(sr.name || '')
    setCompatibleUnits(allUnits)
    setValue(`ingredients.${index}.ingredientId`, sr.id)
    setValue(`ingredients.${index}.description`, displayName)
    setValue(`ingredients.${index}.ingredientName`, displayName)
    setValue(`ingredients.${index}.reference`, sr.reference || sr.code || '')
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
    const { name, useUnit, purchaseUnit, quantityPerPresentation, value } = quickAddData
    if (!name?.trim()) { alert('El nombre es obligatorio'); return }
    if (!useUnit) { alert('La unidad de uso es obligatoria'); return }
    if (!purchaseUnit) { alert('La unidad de compra es obligatoria'); return }
    if (!quantityPerPresentation || quantityPerPresentation <= 0) { alert('La cantidad por presentación debe ser mayor a 0'); return }
    if (value === undefined || value === null || value < 0) { alert('El valor de presentación es obligatorio'); return }
    setSavingQuick(true)
    try {
      const qty = parseFloat(quantityPerPresentation) || 1
      const val = parseFloat(value) || 0
      const pricePerUnit = qty > 0 ? val / qty : 0
      const code = await getNextIngredientCode(restaurantId)
      const displayName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
      const newRef = await createIngredient(restaurantId, {
        code,
        name: displayName,
        description: displayName,
        reference: quickAddData.reference || code,
        useUnit,
        unit: useUnit,
        purchaseUnit,
        quantityPerPresentation: qty,
        value: val,
        pricePerUnit,
        category: quickAddData.category || '',
        supplier: '',
      })
      handleSelectIngredient({
        id: newRef.id,
        name: displayName,
        description: displayName,
        reference: quickAddData.reference || code,
        useUnit,
        unit: useUnit,
        purchaseUnit,
        quantityPerPresentation: qty,
        value: val,
        pricePerUnit,
      })
      setShowQuickAdd(false)
      setQuickAddData({})
      success(`"${displayName}" agregado a materias primas`)
    } catch (err) { console.error(err); alert('Error al crear materia prima') } finally { setSavingQuick(false) }
  }

  const refBadge = getIngBadge(watch(`ingredients.${index}.reference`))
  const labelCss = { fontSize: '0.6rem', fontWeight: 600, color: isDark ? '#6b7280' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 2 }
  const inputCls = cn('w-full px-2 h-7 text-sm rounded-lg border outline-none focus:ring-1 focus:ring-gold-500',
    isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-200 text-gray-900')
  const staticFieldCls = cn('w-full px-2 h-7 text-sm rounded-lg border flex items-center justify-center font-medium',
    isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')

  // En modo capture, Enter desde cantidad o Desp.% confirma el ingrediente.
  const handleCaptureKey = (e) => {
    if (!isCapture) return
    if (e.key === 'Enter') {
      e.preventDefault()
      onCommit && onCommit()
    }
  }

  // En el input de nombre (capture): Enter o Tab → si hay matches en el
  // dropdown, selecciona el primero (autocompleta MP/sub-receta y mueve foco
  // a cantidad). Si no hay matches, solo mueve el foco a cantidad.
  const handleCaptureNameKey = (e) => {
    if (!isCapture) return
    if (e.key !== 'Enter' && e.key !== 'Tab') return
    if (e.shiftKey) return // Shift+Tab navega hacia atras, no interferimos
    e.preventDefault()
    if (ingMatches.length > 0) {
      handleSelectIngredient(ingMatches[0])
    } else if (subMatches.length > 0) {
      handleSelectSubrecipe(subMatches[0])
    } else {
      quantityInputRef.current?.focus()
    }
  }

  return (
    <>
      <div
        className={cn('mx-3 my-2 px-3 py-2.5 rounded-xl border transition-colors',
          isDark
            ? 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
            : 'bg-gray-50 border-gray-200 hover:border-gray-300')}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 44px',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Renglón 1: Referencia · Nombre */}
          <div className="grid gap-2 items-end grid-cols-1 sm:grid-cols-[110px_1fr]">
            <div>
              <label style={labelCss}>Referencia</label>
              <span style={{
                display: 'inline-block',
                fontSize: '0.7rem', fontWeight: 700,
                padding: '4px 10px', borderRadius: 6,
                background: refBadge.bg, color: refBadge.color,
                whiteSpace: 'nowrap', fontFamily: 'monospace',
                lineHeight: '20px',
              }}>
                {refBadge.label}
              </span>
            </div>
            <div>
              <label style={labelCss}>Nombre</label>
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
                onKeyDown={handleCaptureNameKey}
                placeholder="Buscar materia prima o sub-receta…"
                className={inputCls}
              />
              {/* Fixed-position dropdown */}
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
                          className={cn('w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2', isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-orange-50 text-gray-700')}>
                          <span className="text-xs font-bold px-1 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>SUB</span>
                          <span className="font-medium">{toTitleCase(s.name)}</span>
                          <span className={cn('ml-auto text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{s.code}</span>
                          {s.pin && <Lock className="h-3 w-3 text-amber-500" />}
                        </button>
                      ))}
                    </>
                  )}
                  {noMatch && (
                    <button type="button" onMouseDown={() => { setQuickAddData({ name: query }); setShowQuickAdd(true); setShowSuggestions(false); setDropRect(null) }}
                      className={cn('w-full text-left px-3 py-2 text-sm font-medium text-gold-600', isDark ? 'hover:bg-gray-800' : 'hover:bg-gold-50')}>
                      ＋ Agregar "{query}" a Materias Primas
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Renglón 2: Cantidad · Unidad · Desp.% · Costo U. · Costo Total */}
          <div className="grid gap-2 items-end grid-cols-2 sm:grid-cols-[90px_80px_80px_90px_1fr]">
            <div>
              <label style={labelCss}>Cantidad</label>
              <input
                ref={quantityInputRef}
                type="number"
                step="0.001"
                min="0"
                placeholder="0"
                {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })}
                onKeyDown={handleCaptureKey}
                className={cn(inputCls, 'text-right')}
              />
            </div>
            <div>
              <label style={labelCss}>Unidad</label>
              <div className={staticFieldCls} title="Unidad de consumo (heredada de la materia prima/sub-receta)">
                {normalizedUnit || '—'}
              </div>
            </div>
            <div>
              <label style={labelCss}>Desp. %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="0"
                {...register(`ingredients.${index}.wasteMargin`, { valueAsNumber: true })}
                onKeyDown={(e) => {
                  if (isCapture && e.key === 'Enter') {
                    e.preventDefault()
                    onCommit && onCommit()
                    return
                  }
                  if (!isCapture && e.key === 'Tab' && !e.shiftKey && onAddRow) {
                    const desc = watch(`ingredients.${index}.description`)
                    const q = watch(`ingredients.${index}.quantity`)
                    if (desc && q) { e.preventDefault(); onAddRow() }
                  }
                }}
                className={cn(inputCls, 'text-right')}
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <label style={labelCss}>Costo U.</label>
              <span className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}
                style={{ display: 'inline-block', lineHeight: '28px' }}>
                {formatNumber(effectivePrice)}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <label style={labelCss}>Costo Total</label>
              <span className={cn('text-sm font-semibold', isDark ? 'text-gray-100' : 'text-gray-800')}
                style={{ display: 'inline-block', lineHeight: '28px' }}>
                {formatNumber(rowCost)}
              </span>
              {wasteCost > 0 && (
                <span className="block text-xs" style={{ color: 'var(--accent)', lineHeight: '14px' }}>
                  {formatNumber(baseCost)} +{formatNumber(wasteCost)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones — alto de los 2 renglones, apiladas. En capture: solo "Agregar" */}
        <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isCapture ? (
            <button type="button"
              onClick={() => onCommit && onCommit()}
              disabled={!watch(`ingredients.${index}.description`) || !(parseFloat(watch(`ingredients.${index}.quantity`)) > 0)}
              title="Agregar ingrediente a la receta"
              className={cn('flex-1 flex items-center justify-center rounded-lg transition-colors text-white font-bold',
                'disabled:opacity-30 disabled:cursor-not-allowed')}
              style={{ background: 'var(--accent)' }}>
              <Plus className="h-5 w-5" />
            </button>
          ) : (
            <>
              <button type="button"
                onClick={() => {
                  if (!watch(`ingredients.${index}.ingredientId`)) return
                  setShowSourceModal(true)
                }}
                disabled={!watch(`ingredients.${index}.ingredientId`)}
                title="Ver y editar la fuente del costo"
                className={cn('flex-1 flex items-center justify-center rounded-lg transition-colors',
                  isDark ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30' : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50',
                  !watch(`ingredients.${index}.ingredientId`) && 'opacity-30 cursor-not-allowed')}>
                <Info className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(index)}
                title="Eliminar ingrediente"
                className={cn('flex-1 flex items-center justify-center rounded-lg transition-colors',
                  isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30' : 'text-red-400 hover:text-red-600 hover:bg-red-50')}>
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal de fuente del costo */}
      {showSourceModal && (
        <IngredientSourceModal
          open={showSourceModal}
          onClose={() => setShowSourceModal(false)}
          restaurantId={restaurantId}
          ingredientRow={{
            ingredientId: watch(`ingredients.${index}.ingredientId`),
            description: watch(`ingredients.${index}.description`),
          }}
          isDark={isDark}
          canEdit={!!canEdit}
          onSaved={(updated) => {
            // El usuario edito la MP de origen desde el modal — refresca el
            // pricePerUnit del ingrediente actual en el form para que se vea
            // el costo nuevo sin recargar.
            setValue(`ingredients.${index}.pricePerUnit`, updated.pricePerUnit, { shouldDirty: true })
          }}
        />
      )}

      {/* Quick-add full MP form */}
      {showQuickAdd && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ background: isDark ? '#1f2937' : '#fffbeb', border: `1px solid ${isDark ? '#374151' : '#fde68a'}`, borderRadius: 10, padding: 16, marginTop: 4 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>Nueva materia prima</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Nombre */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Nombre *</label>
                  <input
                    value={quickAddData.name || ''}
                    onChange={e => setQuickAddData(d => ({ ...d, name: e.target.value.toUpperCase() }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, background: isDark ? '#111827' : '#fff', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Referencia */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Referencia</label>
                  <input
                    ref={referenceInputRef}
                    value={quickAddData.reference || ''}
                    onChange={e => setQuickAddData(d => ({ ...d, reference: e.target.value }))}
                    placeholder="MP1000001"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, background: isDark ? '#111827' : '#fff', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Categoría */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Categoría</label>
                  <select
                    value={quickAddData.category || ''}
                    onChange={e => setQuickAddData(d => ({ ...d, category: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, background: isDark ? '#111827' : '#fff', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Seleccionar</option>
                    {INGREDIENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Unidad de uso */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Unidad de uso *</label>
                  <select
                    value={quickAddData.useUnit || ''}
                    onChange={e => setQuickAddData(d => ({ ...d, useUnit: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, background: isDark ? '#111827' : '#fff', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Seleccionar</option>
                    {(allUnits || []).map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation} — {u.name}</option>)}
                  </select>
                </div>
                {/* Unidad de compra */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Unidad de compra *</label>
                  <select
                    value={quickAddData.purchaseUnit || ''}
                    onChange={e => setQuickAddData(d => ({ ...d, purchaseUnit: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, background: isDark ? '#111827' : '#fff', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Seleccionar</option>
                    {(allUnits || []).map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation} — {u.name}</option>)}
                  </select>
                </div>
                {/* Cant./Presentación */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Cant./Presentación *</label>
                  <input
                    type="number" min="0" step="0.001"
                    value={quickAddData.quantityPerPresentation || ''}
                    onChange={e => setQuickAddData(d => ({ ...d, quantityPerPresentation: parseFloat(e.target.value) || 0 }))}
                    placeholder="1000"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, background: isDark ? '#111827' : '#fff', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Valor presentación */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Valor presentación *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={quickAddData.value || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0
                      const qty = parseFloat(quickAddData.quantityPerPresentation) || 1
                      setQuickAddData(d => ({ ...d, value: val, pricePerUnit: qty > 0 ? val / qty : 0 }))
                    }}
                    placeholder="8500"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, background: isDark ? '#111827' : '#fff', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Precio por unidad calculado */}
                {quickAddData.pricePerUnit > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--t3)' }}>
                      Precio por unidad de uso:&nbsp;
                      <strong style={{ color: 'var(--accent)' }}>${Math.round(quickAddData.pricePerUnit || 0).toLocaleString('es-CO')}</strong>
                      {quickAddData.useUnit ? ` / ${quickAddData.useUnit}` : ''}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowQuickAdd(false); setQuickAddData({}) }}
                  style={{ background: 'none', border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`, borderRadius: 6, padding: '7px 14px', color: 'var(--t2)', fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleQuickAdd} disabled={savingQuick}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '7px 14px', color: '#fff', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, cursor: savingQuick ? 'not-allowed' : 'pointer', opacity: savingQuick ? 0.6 : 1 }}>
                  {savingQuick ? 'Creando...' : 'Crear y agregar'}
                </button>
              </div>
            </div>
        </div>
      )}
    </>
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
  sellingPrice: z.coerce.number().min(0).catch(0).default(0),
  ingredients: z.array(z.object({
    ingredientId: z.string().optional(),
    description: z.string().optional().default(''),
    ingredientName: z.string().optional(),
    reference: z.string().optional(),
    quantity: z.coerce.number().min(0).catch(0).default(0),
    unit: z.string().optional(),
    pricePerUnit: z.coerce.number().min(0).catch(0).default(0),
    purchaseUnit: z.string().optional(),
    wasteMargin: z.coerce.number().min(0).max(100).catch(0).default(0),
    type: z.enum(['ingredient', 'subrecipe']).default('ingredient'),
    baseCost: z.coerce.number().catch(0).default(0),
    wasteCost: z.coerce.number().catch(0).default(0),
    totalCost: z.coerce.number().catch(0).default(0),
  })).default([]),
})

// ── Main Component ────────────────────────────────────────────────────────────
export default function RecipeDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id || id === 'new'
  // Determine type from URL param (change 16)
  const typeFromUrl = searchParams.get('type') === 'subrecipe' ? 'subrecipe' : 'recipe'

  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentRestaurant, theme, openConfig, userProfile } = useAppStore()
  const { isAdmin, canEdit, canSeeCosts, isUsuario, isMaster, user: authUser } = useAuth()
  const { plan, active: licenseActive, has, maxRecipes } = usePlan()
  // canEdit covers master+superadmin+admin; use it for all edit-gating
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
  // hasUnsavedChanges viene de formState.isDirty (react-hook-form). True solo cuando
  // el usuario realmente toca un campo, no cuando se carga la receta via reset().
  const hasUnsavedChanges = isDirty
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [marginContribution, setMarginContribution] = useState(35)
  const [taxRate, setTaxRate] = useState(8)
  const [convertModal, setConvertModal] = useState(false)
  const [convertData, setConvertData] = useState({})
  const [converting, setConverting] = useState(false)

  const { register, handleSubmit, control, watch, setValue, reset, getValues, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', code: '', categoryId: '', menuCode: '', item: '', reference: '',
      isSubRecipe: typeFromUrl === 'subrecipe',
      useManualCost: false, manualCost: 0, recipeType: typeFromUrl,
      ingredients: [EMPTY_INGREDIENT],
      preparation: '', notes: '', pin: '', yieldAmount: 0, yieldUnit: '', sellingPrice: 0,
    },
  })

  const { fields, append, remove, insert, update } = useFieldArray({ control, name: 'ingredients' })
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

  // Bloqueo de deep-links externos: si se monta sin state.from, redirige al selector.
  // Las navegaciones internas (cards, gestión, summary, modal de fuente) deben pasar
  // state: { from: 'app' } u otro valor truthy.
  useEffect(() => {
    if (isNew) return
    if (!location?.state?.from) {
      navigate('/restaurants', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isNew || !currentRestaurant?.id || !id) return
    if (!location?.state?.from) return
    getRecipe(currentRestaurant.id, id).then((r) => {
      if (!r) {
        navigate('/restaurants', { replace: true })
        return
      }
      setRecipe(r)
      setPhotoURL(r.photoURL || '')
      setPhotoPreview(r.photoURL || '')
      setVideoURL(r.videoURL || '')
      setMarginContribution(r.costSettings?.marginContribution ?? 35)
      setTaxRate(r.costSettings?.taxRate ?? 8)
      reset({
        name: r.name, code: r.code, categoryId: r.categoryId || '',
        menuCode: r.menuCode || '',
        item: r.item || '', reference: r.reference || '',
        recipeType: r.recipeType || 'recipe',
        manualCost: parseFloat(r.manualCost) || 0,
        useManualCost: r.useManualCost === true,
        preparation: r.preparation || '', notes: r.notes || '',
        isSubRecipe: r.isSubRecipe || r.type === 'subrecipe' || false, pin: r.pin || '',
        sellingPrice: r.sellingPrice || 0,
        yieldAmount: r.yieldAmount || r.yield || 0,
        yieldUnit: (() => {
          const raw = r.yieldUnit || ''
          const matched = (allUnits || []).find(
            (u) => u.abbreviation?.toUpperCase().trim() === raw.toUpperCase().trim()
          )
          return matched?.abbreviation || raw
        })(),
        ingredients: [
          EMPTY_INGREDIENT,
          ...(r.ingredients || []).map((ing) => ({
            ...ing,
            description: ing.description || ing.ingredientName || '',
          })),
        ],
        photoURL: r.photoURL || '',
        videoURL: r.videoURL || '',
      })
    })
  }, [id, currentRestaurant?.id, isNew])


  // Refresh cost of subrecipe ingredients with current source costs (one time per recipe load)
  const subrecipePricesRefreshedRef = useRef(null)
  useEffect(() => {
    if (!recipe?.id || !allSubrecipes?.length) return
    if (subrecipePricesRefreshedRef.current === recipe.id) return
    const formIngredients = watch('ingredients') || []

    // Build lookup tables: by id, by code (lowercase), by name (lowercase)
    const byId = new Map()
    const byCode = new Map()
    const byName = new Map()
    allSubrecipes.forEach((s) => {
      if (s.id) byId.set(s.id, s)
      if (s.code) byCode.set(String(s.code).toLowerCase(), s)
      if (s.name) byName.set(String(s.name).toLowerCase().trim(), s)
    })

    formIngredients.forEach((ing, idx) => {
      if (!ing) return
      // Try id first, then fallback to code/name only if the row looks like a sub-recipe
      let src = ing.ingredientId ? byId.get(ing.ingredientId) : null
      const looksLikeSubrecipe = ing.type === 'subrecipe' || (!ing.purchaseUnit && !!ing.description)
      if (!src && looksLikeSubrecipe) {
        if (ing.description) src = byName.get(String(ing.description).toLowerCase().trim())
        if (!src && ing.reference) src = byCode.get(String(ing.reference).toLowerCase())
      }
      if (!src) {
        if (ing.type === 'subrecipe') {
          console.warn('[subrecipe-refresh] no source found for row', idx, {
            ingredientId: ing.ingredientId, description: ing.description, reference: ing.reference,
          })
        }
        return
      }

      // Normalize row metadata so future loads match by id
      if (ing.type !== 'subrecipe') {
        setValue(`ingredients.${idx}.type`, 'subrecipe', { shouldDirty: false })
      }
      if (ing.ingredientId !== src.id) {
        setValue(`ingredients.${idx}.ingredientId`, src.id, { shouldDirty: false })
      }

      // Use per-yield-unit cost — never the raw totalCost
      const srYield = parseFloat(src.yieldAmount) || 0
      const stored = parseFloat(src.costPerYieldUnit)
      const srTotal = parseFloat(src.totalCost || src.costPerPortion || 0)
      const unitCost = !isNaN(stored) && stored > 0
        ? stored
        : (srYield > 0 ? srTotal / srYield : 0)
      const currentPrice = parseFloat(ing.pricePerUnit) || 0
      if (Math.abs(unitCost - currentPrice) > 0.001) {
        setValue(`ingredients.${idx}.pricePerUnit`, unitCost, { shouldDirty: false })
      }
      if (src.yieldUnit && !ing.unit) {
        setValue(`ingredients.${idx}.unit`, src.yieldUnit, { shouldDirty: false })
      }
    })
    subrecipePricesRefreshedRef.current = recipe.id
  }, [recipe?.id, allSubrecipes]) // eslint-disable-line react-hooks/exhaustive-deps


  const exitToOrigin = () => {
    if (location?.state?.from === 'gestion') {
      openConfig('recipes')
    } else {
      navigate(-1)
    }
  }

  // Modal de cambios sin guardar — se abre si el usuario intenta salir con
  // hasUnsavedChanges=true. exitAfterSaveRef se setea cuando el usuario elige
  // "Guardar y salir" para que, al detectar que hasUnsavedChanges paso a false
  // (guardado exitoso), el useEffect dispare la salida.
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false)
  const exitAfterSaveRef = useRef(false)

  const safeNavigate = () => {
    if (hasUnsavedChanges) {
      setUnsavedModalOpen(true)
    } else {
      exitToOrigin()
    }
  }

  const discardAndExit = () => {
    setUnsavedModalOpen(false)
    exitToOrigin()
  }

  const saveAndExit = () => {
    exitAfterSaveRef.current = true
    handleSave()
  }

  useEffect(() => {
    if (!hasUnsavedChanges && exitAfterSaveRef.current) {
      exitAfterSaveRef.current = false
      setUnsavedModalOpen(false)
      exitToOrigin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges])

  const handleConfirmConvert = async () => {
    if (!recipe || !currentRestaurant?.id) return
    const newType = recipe.isSubRecipe ? 'recipe' : 'subrecipe'
    setConverting(true)
    try {
      const updates = { updatedAt: serverTimestamp(), isSubRecipe: newType === 'subrecipe', type: newType }
      if (newType === 'subrecipe') {
        if (!convertData.yieldAmount || !convertData.yieldUnit) {
          error('Rendimiento y unidad son requeridos'); setConverting(false); return
        }
        updates.categoryId = null
        updates.menuCode = 'SUBRECETA'
        updates.yieldAmount = parseFloat(convertData.yieldAmount)
        updates.yieldUnit = convertData.yieldUnit
        updates.code = await getNextRecipeCode(currentRestaurant.id, 'subrecipe')
      } else {
        if (!convertData.categoryId) {
          error('Debes seleccionar un menú'); setConverting(false); return
        }
        updates.categoryId = convertData.categoryId
        updates.menuCode = convertData.menuCode || ''
        updates.yieldAmount = null
        updates.yieldUnit = null
        updates.code = await getNextRecipeCode(currentRestaurant.id, 'recipe')
      }
      await updateDoc(doc(db, 'restaurants', currentRestaurant.id, 'recipes', id), updates)
      success(`Convertida a ${newType === 'recipe' ? 'receta' : 'sub-receta'} ✓`)
      setConvertModal(false)
      setConvertData({})
    } catch (err) { console.error(err); error('Error al convertir') } finally { setConverting(false) }
  }

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const onInvalid = (errs) => {
    const findFirst = (obj, path = '') => {
      for (const [k, v] of Object.entries(obj || {})) {
        if (!v) continue
        const p = path ? `${path}.${k}` : k
        if (v.message) return { field: p, message: v.message }
        if (typeof v === 'object') {
          const found = findFirst(v, p)
          if (found) return found
        }
      }
      return null
    }
    const first = findFirst(errs)
    error(first ? `Revisa el campo "${first.field}": ${first.message}` : 'El formulario tiene errores. Revisa los campos resaltados.')
  }
  const handleSave = () => handleSubmit(onSubmit, onInvalid)()

  const handleRemovePhoto = async () => {
    // 1. Intentar borrar de Storage (ignorar errores — nunca bloquea)
    if (recipe?.photoURL) {
      try {
        const photoRef = storageRef(storage, recipe.photoURL)
        await deleteObject(photoRef)
      } catch {
        console.log('Storage no encontrado, continuando...')
      }
    }

    // 2. SIEMPRE borrar en Firestore
    await updateDoc(
      doc(db, 'restaurants', currentRestaurant.id, 'recipes', recipe.id),
      { photoURL: null, updatedAt: serverTimestamp() }
    )

    // 3. SIEMPRE actualizar estado local
    setPhotoURL(null)
    setPhotoPreview(null)
    if (recipe) recipe.photoURL = null

    success('Foto eliminada ✓')
  }

  const handlePrint = useReactToPrint({ contentRef: printRef })

  const handleVerify = async () => {
    if (!recipe || !currentRestaurant?.id) return
    const newVerified = !recipe.verified
    try {
      await updateDoc(doc(db, 'restaurants', currentRestaurant.id, 'recipes', id), {
        verified: newVerified,
        verifiedAt: newVerified ? serverTimestamp() : null,
        verifiedBy: newVerified ? (userProfile?.name || userProfile?.email || 'Usuario') : null,
        verifiedById: newVerified ? authUser?.uid : null,
        updatedAt: serverTimestamp(),
      })
      setRecipe(prev => ({
        ...prev,
        verified: newVerified,
        verifiedBy: newVerified ? (userProfile?.name || userProfile?.email || 'Usuario') : null,
      }))
      await logAction({
        restaurantId: currentRestaurant.id,
        userId: authUser?.uid,
        userName: userProfile?.name || userProfile?.email,
        userRole: userProfile?.role,
        action: 'edit',
        module: recipe.isSubRecipe ? 'subrecipe' : 'recipe',
        entityId: recipe.id,
        entityName: recipe.name,
        entityCode: recipe.code,
        changes: [{ field: 'verificacion', before: newVerified ? 'Sin verificar' : 'Verificada', after: newVerified ? 'Verificada' : 'Sin verificar' }],
      })
      success(newVerified ? '✓ Receta verificada' : 'Verificación removida')
    } catch (err) {
      error('Error al verificar: ' + err.message)
    }
  }

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

  // El capture row es el field[0]. Al "commit", tomamos sus valores actuales,
  // los insertamos como segunda fila (queda justo debajo del capture, visible
  // de inmediato), reseteamos el field[0] a vacio y forzamos remount con
  // captureKey para limpiar el state local del autocomplete.
  const [captureKey, setCaptureKey] = useState(0)
  const handleCaptureCommit = () => {
    const data = getValues('ingredients.0')
    const desc = (data?.description || '').trim()
    const qty = parseFloat(data?.quantity)
    if (!desc) {
      error('Escribí el nombre del ingrediente y elegilo de la lista')
      return
    }
    // Solo se permiten ingredientes que existan en MPs o sub-recetas (con ingredientId).
    // No se aceptan nombres "libres" — fuerza al usuario a crear primero la MP.
    if (!data?.ingredientId) {
      error('Seleccioná el ingrediente de la lista de materias primas o sub-recetas')
      return
    }
    if (!(qty > 0)) {
      error('Ingresá una cantidad mayor a 0')
      return
    }
    insert(1, { ...data, description: desc })
    update(0, EMPTY_INGREDIENT)
    setCaptureKey((k) => k + 1)
    setTimeout(() => { nameInputRefs.current[0]?.focus() }, 60)
  }

  const onSubmit = async (data) => {
    if (!currentRestaurant?.id) { error('No hay restaurante configurado'); return }
    if (!licenseActive) {
      error('La licencia del restaurante no está activa. Contacta al administrador.')
      return
    }
    if (isNew) {
      const currentCount = (allRecipes || []).length
      if (currentCount >= maxRecipes) {
        error(`Has alcanzado el límite de ${maxRecipes} recetas/sub-recetas del plan ${plan.label}. Actualiza tu plan para crear más.`)
        return
      }
    }
    setSaving(true)
    try {
      // Bloquea el guardado si la version cargada esta obsoleta — fuerza recarga.
      try { await assertVersionFresh() } catch (err) {
        error('La aplicación tiene una versión obsoleta. Recargando…')
        return
      }
      // Build ingredient lookup maps for cost resolution
      const ingById = {}
      const ingByRef = {}
      ;(allIngredients || []).forEach((i) => {
        if (i.id) ingById[i.id] = i
        if (i.reference) ingByRef[i.reference] = i
        if (i.item) ingByRef[String(i.item)] = i
      })

      const cleanIngredients = (data.ingredients || [])
        .filter((ing) => {
          const name = ing?.description?.trim() || ing?.ingredientName?.trim()
          return !!name
        })
        .map((ing) => {
          // Resolve materia prima by id → reference → item for cost lookup
          const mp = ingById[ing.ingredientId] || ingByRef[ing.reference] || ingByRef[String(ing.item || '')] || null
          const resolvedPrice = parseFloat(ing.pricePerUnit || mp?.pricePerUnit || 0)
          const resolvedPurchaseUnit = ing.purchaseUnit || mp?.purchaseUnit || ''
          const resolvedDescription = ing.description || ing.ingredientName || ''

          const eff = getConvertedPrice(resolvedPrice, resolvedPurchaseUnit, ing.unit || '')
          const base = parseFloat(ing.quantity || 0) * eff
          const waste = base * (parseFloat(ing.wasteMargin || 0) / 100)
          const clean = {}
          for (const [k, v] of Object.entries(ing || {})) {
            if (v === undefined || v === null) continue
            if (typeof v === 'number' && isNaN(v)) { clean[k] = 0; continue }
            clean[k] = v
          }
          clean.description = resolvedDescription
          clean.ingredientName = resolvedDescription
          if (mp?.id && !clean.ingredientId) clean.ingredientId = mp.id
          if (resolvedPrice && !ing.pricePerUnit) clean.pricePerUnit = resolvedPrice
          if (resolvedPurchaseUnit && !ing.purchaseUnit) clean.purchaseUnit = resolvedPurchaseUnit
          clean.baseCost = isNaN(base) ? 0 : base
          clean.wasteCost = isNaN(waste) ? 0 : waste
          clean.totalCost = isNaN(base + waste) ? 0 : base + waste
          return clean
        })
      // Si el plan no permite autoCost, fuerza siempre manual
      const useManualCostFlag = has('autoCost') ? !!data.useManualCost : true
      const manualCostVal = parseFloat(data.manualCost) || 0
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
        useManualCost: useManualCostFlag,
        manualCost: manualCostVal,
        sellingPrice: parseFloat(data.sellingPrice) || 0,
        totalCost: useManualCostFlag
          ? manualCostVal
          : (() => {
              const t = cleanIngredients.reduce((s, i) => s + (i.totalCost || 0), 0)
              return isNaN(t) ? 0 : t
            })(),
        costSettings: { marginContribution, taxRate },
        calculatedCosts: {
          totalCost: isNaN(totalCostCalc) ? 0 : totalCostCalc,
          suggestedPriceNoTax: isNaN(suggestedPriceNoTax) ? 0 : suggestedPriceNoTax,
          suggestedPriceWithTax: isNaN(suggestedPriceWithTax) ? 0 : suggestedPriceWithTax,
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
        reset(getValues())
        await logAction({
          restaurantId,
          userId: authUser?.uid,
          userName: authUser?.displayName || authUser?.email || 'Desconocido',
          userRole: authUser?.role,
          action: 'create',
          module: safePayload.isSubRecipe ? 'subrecipe' : 'recipe',
          entityId: docRef.id,
          entityName: safePayload.name,
          entityCode: safePayload.code,
          changes: [],
        })
        navigate(`/recipes/${docRef.id}`)
      } else {
        const fieldChanges = detectChanges(recipe || {}, safePayload, [
          'name', 'sellingPrice', 'preparation', 'yieldAmount', 'yieldUnit',
        ])
        const ingChanges = detectIngredientChanges(
          recipe?.ingredients || [],
          safePayload.ingredients || []
        )
        await updateRecipe(restaurantId, id, safePayload)
        console.log('Receta actualizada:', id)
        success('Receta guardada exitosamente')
        reset(getValues())
        await logAction({
          restaurantId,
          userId: authUser?.uid,
          userName: authUser?.displayName || authUser?.email || 'Desconocido',
          userRole: authUser?.role,
          action: 'edit',
          module: safePayload.isSubRecipe ? 'subrecipe' : 'recipe',
          entityId: id,
          entityName: safePayload.name,
          entityCode: safePayload.code,
          changes: [...fieldChanges, ...ingChanges],
          ingredientsBefore: recipe?.ingredients || [],
          ingredientsAfter: safePayload.ingredients || [],
        })
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

  // Read-only view for 'usuario' role on existing recipes
  if (isUsuario && !isNew && recipe) {
    return (
      <RecipeReadOnlyView
        recipe={recipe}
        restaurantId={currentRestaurant?.id}
        userId={authUser?.uid}
        isDark={isDark}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Sticky action bar ── */}
      <div
        className="sticky-actions no-print flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center"
        style={{
          padding: '10px 0',
          position: 'sticky', top: 0, zIndex: 50,
          background: isDark ? 'rgba(3,7,18,0.97)' : 'rgba(243,244,246,0.97)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
          marginLeft: '-1.25rem', marginRight: '-1.25rem',
          paddingLeft: '1.25rem', paddingRight: '1.25rem',
        }}
      >
        {/* IZQUIERDA — Nombre receta */}
        <div className="flex flex-col w-full sm:max-w-[45%] min-w-0">
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.4rem',
            fontWeight: 700,
            color: isDark ? '#f9fafb' : 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {watch('name') || recipe?.name || (isNew ? (typeFromUrl === 'subrecipe' ? 'Nueva sub-receta' : 'Nueva receta') : '…')}
          </div>
          {!isNew && recipe && (
            <div style={{ fontSize: '0.72rem', color: isDark ? '#4b5563' : '#9ca3af', whiteSpace: 'nowrap' }}>
              v{recipe.version || 1} · {recipe.active !== false ? 'Activa' : 'Inactiva'} · Creada: {formatDate(recipe.createdAt) || '—'}
            </div>
          )}
        </div>

        {/* DERECHA — Verificar / Imprimir / Guardar / Salir */}
        <div className="flex gap-2 sm:gap-2.5 items-center flex-wrap sm:flex-nowrap">
          {!isNew && canEdit && (
            <button
              onClick={handleVerify}
              title={recipe?.verified ? 'Quitar marca de verificada' : 'Marcar receta como verificada'}
              style={{
                background: recipe?.verified ? 'rgba(22,163,74,0.15)' : 'transparent',
                border: `1px solid ${recipe?.verified ? 'var(--green, #16a34a)' : (isDark ? '#374151' : '#e5e7eb')}`,
                borderRadius: 8,
                color: recipe?.verified ? 'var(--green, #16a34a)' : (isDark ? '#9ca3af' : '#6b7280'),
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '7px 14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {recipe?.verified ? '✓ Verificada' : '○ Verificar'}
            </button>
          )}
          {!isNew && (
            <button
              onClick={handlePrintClick}
              style={{
                background: 'transparent',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: 8,
                color: isDark ? '#9ca3af' : '#6b7280',
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '7px 16px',
                cursor: 'pointer',
              }}
            >
              🖨 Imprimir
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || photoUploading}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '7px 16px',
              cursor: saving || photoUploading ? 'not-allowed' : 'pointer',
              opacity: saving || photoUploading ? 0.6 : 1,
            }}
          >
            {saving ? 'Guardando...' : photoUploading ? 'Subiendo...' : 'Guardar'}
          </button>
          <button
            onClick={() => safeNavigate()}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              color: 'var(--accent)',
              fontFamily: 'inherit',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '7px 16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)' }}
          >
            Salir
          </button>
        </div>
      </div>


      {/* ── PIN gate for protected sub-recipes ───────────────────────────── */}
      {!isNew && recipe?.isSubRecipe && recipe?.pin && !pinVerified && !canEdit && (
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

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: (!isNew && recipe?.isSubRecipe && recipe?.pin && !pinVerified && !canEdit) ? 'none' : undefined }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic info */}
            <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
              <CardHeader><CardTitle>Información básica</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Portada — solo la foto. El video se reproduce en su card abajo. */}
                {photoPreview && (
                  <div
                    className={cn('rounded-xl overflow-hidden border', isDark ? 'border-gray-800' : 'border-gray-200')}
                    style={{ aspectRatio: '4 / 3', background: '#000' }}
                  >
                    <img
                      src={photoPreview}
                      alt={watch('name') || 'Foto de la receta'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}

                {/* Code + Reference */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '12px' }}>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código</Label>
                    <div className={cn('px-3 py-2 rounded-lg text-sm font-mono font-bold h-9 flex items-center', isDark ? 'bg-gray-800 text-gold-400' : 'bg-gold-50 text-gold-700')}>
                      {codeLoading ? '...' : (watch('code') || '—')}
                    </div>
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


                {isSubRecipe && (
                  <>
                    {/* Yield fields — Rendimiento | Unidad de rendimiento */}
                    <div className="grid-auto-lg">
                      <div className="space-y-1.5">
                        <Label>Rendimiento *</Label>
                        <Input
                          type="number" step="any" min="0.001"
                          {...register('yieldAmount')}
                          placeholder="Ej: 1000"
                          className={errors.yieldAmount ? 'border-red-400' : ''}
                        />
                        {errors.yieldAmount && <p className="text-xs text-red-500">{errors.yieldAmount.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unidad de rendimiento *</Label>
                        <select
                          value={(() => {
                            const raw = watch('yieldUnit') || ''
                            const matched = allUnits.find(
                              (u) => u.abbreviation?.toUpperCase().trim() === raw.toUpperCase().trim()
                            )
                            return matched?.abbreviation || raw
                          })()}
                          onChange={(e) => setValue('yieldUnit', e.target.value)}
                          className={cn('w-full px-2 h-9 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-gold-500',
                            isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}
                        >
                          <option value="">--</option>
                          {allUnits.map((u) => <option key={u.id} value={u.abbreviation}>{u.abbreviation} — {u.name}</option>)}
                          {(() => {
                            const raw = watch('yieldUnit') || ''
                            return raw && !allUnits.find(
                              (u) => u.abbreviation?.toUpperCase() === raw.toUpperCase()
                            ) ? <option value={raw}>{raw}</option> : null
                          })()}
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
                    {/* PIN */}
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
                {/* Capture row — siempre arriba del listado, scrollea con la pagina */}
                {fields[0] && (
                  <div
                    style={{
                      background: isDark ? '#0f172a' : '#fafafa',
                      borderBottom: `2px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
                    }}
                  >
                    <div style={{ padding: '6px 16px 0', fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Nuevo ingrediente
                    </div>
                    <IngredientRow
                      key={`capture-${fields[0].id}-${captureKey}`}
                      index={0}
                      field={fields[0]}
                      allIngredients={allIngredients}
                      allSubrecipes={allSubrecipes}
                      allUnits={allUnits}
                      remove={remove}
                      register={register}
                      watch={watch}
                      setValue={setValue}
                      isDark={isDark}
                      restaurantId={currentRestaurant?.id}
                      onCommit={handleCaptureCommit}
                      isCapture
                      nameInputRef={(el) => { nameInputRefs.current[0] = el }}
                      isAdmin={isAdmin}
                      canEdit={canEdit}
                    />
                  </div>
                )}

                {/* Lista de ingredientes ya agregados */}
                {fields.length > 1 ? (
                  <>
                    <div>
                      {fields.slice(1).map((field, i) => {
                        const realIdx = i + 1
                        return (
                          <IngredientRow
                            key={field.id}
                            index={realIdx}
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
                            nameInputRef={(el) => { nameInputRefs.current[realIdx] = el }}
                            isAdmin={isAdmin}
                            canEdit={canEdit}
                          />
                        )
                      })}
                    </div>
                    <div className={cn('flex justify-between px-4 py-2 border-t font-medium text-sm', isDark ? 'border-gray-800' : 'border-gray-100')}>
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Total ingredientes</span>
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>{formatNumber(totalCostCalc)}</span>
                    </div>
                  </>
                ) : (
                  <div className={cn('mx-6 my-4 text-center py-6 rounded-xl border-2 border-dashed', isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400')}>
                    <p className="text-sm">Aún no hay ingredientes. Captúralos arriba.</p>
                  </div>
                )}
              </CardContent>
            </Card>


            {/* Preparation */}
            <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
              <CardHeader><CardTitle>Preparación</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <textarea {...register('preparation')} rows={6} placeholder="Describe el proceso paso a paso..."
                  className={cn('w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500',
                    isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-200 placeholder:text-gray-400')} />
              </CardContent>
            </Card>

            {/* Notes (multi-author) */}
            {!isNew && recipe && (
              <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
                <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
                <CardContent>
                  <RecipeNotes
                    recipe={recipe}
                    restaurantId={currentRestaurant?.id}
                    isDark={isDark}
                    title={null}
                    onChange={(next) => setRecipe((r) => ({ ...(r || {}), noteEntries: next }))}
                  />
                </CardContent>
              </Card>
            )}

            {/* Inherited sub-recipe notes (read-only) */}
            {!isNew && recipe && (() => {
              const subIngs = (watch('ingredients') || []).filter((ing) => ing?.type === 'subrecipe' && ing?.ingredientId)
              const blocks = subIngs
                .map((ing) => allSubrecipes.find((s) => s.id === ing.ingredientId))
                .filter(Boolean)
                .filter((sr) => (Array.isArray(sr.noteEntries) && sr.noteEntries.length) || (typeof sr.notes === 'string' && sr.notes.trim()))
              if (!blocks.length) return null
              return (
                <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
                  <CardHeader><CardTitle>Notas de las sub-recetas usadas</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {blocks.map((sr) => (
                      <div key={sr.id}>
                        <div className={cn('text-xs font-semibold mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                          {sr.code ? `${sr.code} · ` : ''}{sr.name}
                        </div>
                        <RecipeNotes
                          recipe={sr}
                          restaurantId={currentRestaurant?.id}
                          isDark={isDark}
                          readOnly={true}
                          title={null}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })()}
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
                {canSeeCosts && has('autoCost') && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Costo manual</p>
                      <p className={cn('text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>Sobreescribe el calculado</p>
                    </div>
                    <Switch checked={useManualCost} onCheckedChange={(v) => setValue('useManualCost', v)} />
                  </div>
                )}
                {canSeeCosts && !has('autoCost') && (
                  <div className={cn('text-xs px-3 py-2 rounded-lg', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500')}>
                    Tu plan {plan.label} solo permite costo manual. Actualiza para activar el cálculo automático.
                  </div>
                )}
                {canSeeCosts && useManualCost && (
                  <div className="space-y-1">
                    <Label className="text-xs">Costo total manual</Label>
                    <Input type="number" step="0.01" min="0" {...register('manualCost', { valueAsNumber: true })} />
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Costo total ingredientes</span>
                  <span className={cn('font-bold', isDark ? 'text-gold-400' : 'text-gold-700')} style={{ color: 'var(--accent)' }}>
                    {formatNumber(effectiveTotalCost)}
                  </span>
                </div>
                {isSubRecipe && (
                  <div
                    className={cn('flex justify-between text-sm pt-2 border-t', isDark ? 'border-gray-800' : 'border-gray-100')}
                    title="Este es el costo que se usa cuando esta sub-receta se llama como ingrediente"
                  >
                    <span className={isDark ? 'text-gray-300 font-medium' : 'text-gray-700 font-medium'}>
                      Costo por {watch('yieldUnit') || 'unidad'} de rendimiento
                    </span>
                    <span className="font-bold text-base" style={{ color: 'var(--accent)' }}>
                      {yieldAmt > 0 ? formatNumber(costPerYieldUnit) : '—'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Precio de venta ── */}
            <div style={{
              background: isDark ? '#111827' : 'var(--bg2)',
              border: `1px solid ${isDark ? '#1f2937' : 'var(--b1)'}`,
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Precio de venta
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--t2)' }}>$</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  {...register('sellingPrice', { valueAsNumber: true })}
                  placeholder="0"
                  style={{
                    flex: 1,
                    background: isDark ? '#1f2937' : '#fff',
                    border: `1px solid ${isDark ? '#374151' : 'var(--b1)'}`,
                    borderRadius: 8,
                    padding: '7px 10px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* ── Estado de la receta toggle ── */}
            {!isNew && recipe && canEdit && (
              <div style={{
                background: isDark ? '#111827' : 'var(--bg2)',
                border: `1px solid ${isDark ? '#1f2937' : 'var(--b1)'}`,
                borderRadius: 12,
                padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#f9fafb' : 'var(--text)' }}>
                      Estado de la receta
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--t3)', marginTop: 2 }}>
                      {recipe?.active !== false ? 'Receta activa y visible' : 'Receta desactivada'}
                    </div>
                  </div>
                  <div
                    onClick={async () => {
                      const newActive = recipe.active === false
                      try {
                        await toggleRecipeActive(currentRestaurant.id, id, newActive)
                        setRecipe((r) => ({ ...(r || {}), active: newActive }))
                        success(newActive ? 'Receta activada' : 'Receta desactivada')
                        logAction({
                          restaurantId: currentRestaurant.id,
                          userId: authUser?.uid,
                          userName: authUser?.displayName || authUser?.email || 'Desconocido',
                          userRole: authUser?.role,
                          action: 'edit',
                          module: recipe?.isSubRecipe ? 'subrecipe' : 'recipe',
                          entityId: id,
                          entityName: recipe?.name,
                          entityCode: recipe?.code,
                          changes: [{ field: 'estado', before: newActive ? 'inactiva' : 'activa', after: newActive ? 'activa' : 'inactiva' }],
                        })
                      } catch (err) {
                        error('No se pudo cambiar el estado: ' + (err?.message || 'error desconocido'))
                      }
                    }}
                    style={{
                      width: 44, height: 24,
                      borderRadius: 12,
                      background: recipe?.active !== false ? 'var(--green, #16A34A)' : (isDark ? '#374151' : '#d1d5db'),
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.3s',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 2,
                      left: recipe?.active !== false ? 22 : 2,
                      width: 20, height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.3s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* Marginal Cost Analysis — admin/superadmin/master only */}
            {canSeeCosts && (
              <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Análisis marginal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Inputs */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs items-center">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Margen contribución</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{marginContribution}%</span>
                    </div>
                    <input type="range" min="1" max="99" value={marginContribution}
                      onChange={(e) => setMarginContribution(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full accent-[var(--accent)]" />
                    <div className="flex justify-between text-xs items-center">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Impuesto (%)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={taxRate}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            setTaxRate(isNaN(v) ? 0 : Math.max(0, Math.min(100, v)))
                          }}
                          className={cn('w-16 h-7 px-2 text-xs rounded-md border outline-none text-right font-mono focus:ring-1 focus:ring-gold-500',
                            isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}
                        />
                        <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>%</span>
                      </div>
                    </div>
                  </div>
                  {/* Results table */}
                  <div className={cn('rounded-lg overflow-hidden border', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    {[
                      { label: 'Precio s/imp', val: suggestedPriceNoTax },
                      { label: `Impuesto (${taxRate}%)`, val: taxValue },
                      { label: 'Precio c/imp', val: suggestedPriceWithTax, bold: true },
                    ].map(({ label, val, bold }) => (
                      <div key={label} className={cn('flex justify-between px-3 py-1.5 text-xs border-b last:border-0',
                        isDark ? 'border-gray-800' : 'border-gray-50')}>
                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
                        <span className={cn('font-mono', bold ? 'font-bold' : '')}
                          style={bold ? { color: 'var(--accent)' } : {}}>
                          {formatNumber(isNaN(val) ? 0 : val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tipo de preparación / Convertir */}
            {!isNew && canEdit && (
              <div style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`, borderRadius: 12, padding: 16, marginTop: 4 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', marginBottom: 4 }}>
                  Tipo de preparación
                </div>
                <div style={{ fontSize: '0.75rem', color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 12 }}>
                  {recipe?.isSubRecipe ? 'Esta preparación es una sub-receta' : 'Esta preparación es una receta de menú'}
                </div>
                <button
                  type="button"
                  onClick={() => { setConvertModal(true); setConvertData({}) }}
                  style={{ width: '100%', background: 'transparent', border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`, borderRadius: 8, color: isDark ? '#9ca3af' : '#6b7280', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, padding: '9px 16px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = isDark ? '#374151' : '#d1d5db'; e.currentTarget.style.color = isDark ? '#9ca3af' : '#6b7280' }}
                >
                  {recipe?.isSubRecipe ? '⇄ Convertir a receta' : '⇄ Convertir a sub-receta'}
                </button>
              </div>
            )}

            {/* Photo + Video — solo si el plan los habilita */}
            {(has('photos') || has('videos')) && (
              <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4 text-gold-600" /> Foto y Video</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {isNew && (
                    <p className={cn('text-xs rounded-lg px-3 py-2', isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-400')}>
                      Guarda la receta primero para subir archivos multimedia.
                    </p>
                  )}
                  <div className={cn('grid gap-3', has('photos') && has('videos') ? 'grid-cols-2' : 'grid-cols-1')}>
                    {has('photos') && (
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
                          <button type="button" onClick={handleRemovePhoto}
                            className={cn('text-xs', isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}>
                            Quitar foto
                          </button>
                        )}
                      </div>
                    )}
                    {has('videos') && (
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
                        {videoURL && (
                          <div
                            className={cn('rounded-lg overflow-hidden border', isDark ? 'border-gray-800' : 'border-gray-200')}
                            style={{ background: '#000' }}
                          >
                            <video
                              src={videoURL}
                              controls
                              playsInline
                              preload="metadata"
                              style={{ width: '100%', display: 'block', background: '#000' }}
                            />
                          </div>
                        )}
                        {videoURL && !isNew && (
                          <button type="button" onClick={() => { setVideoURL(''); setVideoProgress(null) }}
                            className={cn('text-xs', isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}>
                            Quitar video
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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



      {/* ── Modal convertir receta ↔ sub-receta ── */}
      {convertModal && recipe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: isDark ? '#1f2937' : '#fff', borderRadius: 16, padding: 28, width: 'min(440px, 90vw)', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.15rem', fontWeight: 700, margin: 0, color: isDark ? '#f9fafb' : '#111827' }}>
              {recipe.isSubRecipe ? 'Convertir a Receta' : 'Convertir a Sub-receta'}
            </h3>
            <p style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '0.85rem', margin: 0 }}>
              {recipe.isSubRecipe
                ? 'Esta sub-receta pasará a ser una receta. Debes asignarle un menú.'
                : 'Esta receta pasará a ser una sub-receta y podrá usarse como ingrediente en otras recetas.'}
            </p>
            <div style={{ fontWeight: 600, color: isDark ? '#f9fafb' : '#111', fontSize: '0.9rem' }}>{recipe.name}</div>

            {!recipe.isSubRecipe ? (
              /* Receta → Sub-receta: pedir rendimiento */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Rendimiento *</label>
                  <input type="number" min="0" step="0.001" placeholder="Ej: 1000"
                    value={convertData.yieldAmount || ''}
                    onChange={e => setConvertData(d => ({ ...d, yieldAmount: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, background: isDark ? '#374151' : '#f9fafb', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Unidad *</label>
                  <select value={convertData.yieldUnit || ''}
                    onChange={e => setConvertData(d => ({ ...d, yieldUnit: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, background: isDark ? '#374151' : '#f9fafb', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                    <option value="">Seleccionar</option>
                    {(allUnits || []).map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation} — {u.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              /* Sub-receta → Receta: pedir menú */
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Menú *</label>
                <select value={convertData.categoryId || ''}
                  onChange={e => setConvertData(d => ({ ...d, categoryId: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, background: isDark ? '#374151' : '#f9fafb', color: isDark ? '#f9fafb' : 'var(--text)', fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  <option value="">Seleccionar menú</option>
                  {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setConvertModal(false); setConvertData({}) }}
                style={{ background: 'transparent', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 8, color: isDark ? '#9ca3af' : '#6b7280', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', padding: '9px 20px', cursor: 'pointer' }}
              >Cancelar</button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                disabled={converting}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', padding: '9px 20px', cursor: converting ? 'not-allowed' : 'pointer', opacity: converting ? 0.7 : 1 }}
              >{converting ? 'Convirtiendo...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: cambios sin guardar al salir */}
      {unsavedModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: isDark ? '#111712' : '#fff',
            border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
            borderRadius: 16, padding: '24px 22px',
            maxWidth: 440, width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#f59e0b22', color: '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', fontSize: 24, fontWeight: 800,
            }}>!</div>
            <h3 style={{
              margin: 0, fontSize: '1.05rem', fontWeight: 700,
              color: isDark ? '#f0ece4' : '#111827', textAlign: 'center',
            }}>
              Cambios sin guardar
            </h3>
            <p style={{
              margin: '10px 0 18px',
              fontSize: '0.88rem',
              color: isDark ? '#9ca3af' : '#6b7280',
              textAlign: 'center', lineHeight: 1.5,
            }}>
              Si salís sin guardar perdés todos los cambios realizados.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={saveAndExit}
                disabled={saving}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '11px 16px',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem',
                  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Guardando…' : 'Guardar y salir'}
              </button>
              <button
                type="button"
                onClick={discardAndExit}
                disabled={saving}
                style={{
                  background: 'transparent', color: '#dc2626',
                  border: '1px solid #dc2626', borderRadius: 10,
                  padding: '11px 16px',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
