import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Upload, Download, Pencil, Trash2, Package } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useAppStore } from '../store/useAppStore'
import { subscribeIngredients, createIngredient, updateIngredient, deleteIngredient, importIngredients } from '../services/restaurants'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { useToast } from '../components/ui/toast'
import { cn, formatCurrency } from '../lib/utils'

const schema = z.object({
  code: z.string().min(1),
  description: z.string().min(2),
  unit: z.string().min(1),
  pricePerUnit: z.coerce.number().min(0),
  category: z.string().optional(),
  supplier: z.string().optional(),
})

function IngredientDialog({ open, onClose, ingredient, restaurantId }) {
  const { t } = useTranslation()
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: ingredient || {},
  })

  useEffect(() => { reset(ingredient || {}) }, [ingredient, reset])

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (ingredient?.id) {
        await updateIngredient(restaurantId, ingredient.id, data)
      } else {
        await createIngredient(restaurantId, data)
      }
      success(t('common.success'))
      onClose()
    } catch {
      error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {ingredient ? t('ingredients.editIngredient') : t('ingredients.newIngredient')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('ingredients.code')}</Label>
              <Input {...register('code')} placeholder="MP001" className={errors.code ? 'border-red-400' : ''} />
            </div>
            <div className="space-y-2">
              <Label>{t('ingredients.unit')}</Label>
              <Input {...register('unit')} placeholder="kg, lt, und..." className={errors.unit ? 'border-red-400' : ''} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('ingredients.description')}</Label>
            <Input {...register('description')} placeholder="Harina de trigo..." className={errors.description ? 'border-red-400' : ''} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('ingredients.pricePerUnit')}</Label>
              <Input type="number" step="0.01" {...register('pricePerUnit')} placeholder="0.00" className={errors.pricePerUnit ? 'border-red-400' : ''} />
            </div>
            <div className="space-y-2">
              <Label>{t('ingredients.category')}</Label>
              <Input {...register('category')} placeholder="Lácteos, Carnes..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('ingredients.supplier')}</Label>
            <Input {...register('supplier')} placeholder="Proveedor..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? '...' : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function IngredientsPage() {
  const { t } = useTranslation()
  const { currentRestaurant, theme } = useAppStore()
  const { success, error } = useToast()
  const isDark = theme === 'night'

  const [ingredients, setIngredients] = useState([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!currentRestaurant?.id) return
    return subscribeIngredients(currentRestaurant.id, setIngredients)
  }, [currentRestaurant?.id])

  const filtered = ingredients.filter((i) => {
    const q = search.toLowerCase()
    return (
      i.description?.toLowerCase().includes(q) ||
      i.code?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    )
  })

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirm') + '?')) return
    try {
      await deleteIngredient(currentRestaurant.id, id)
      success(t('common.success'))
    } catch {
      error(t('common.error'))
    }
  }

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws)
        await importIngredients(currentRestaurant.id, rows)
        success(t('common.success'), `${rows.length} materias primas importadas`)
      } catch {
        error(t('common.error'))
      } finally {
        setImporting(false)
        e.target.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }, [currentRestaurant?.id])

  const handleExport = () => {
    const data = ingredients.map((i) => ({
      codigo: i.code,
      descripcion: i.description,
      unidad: i.unit,
      precio: i.pricePerUnit,
      categoria: i.category,
      proveedor: i.supplier,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Materias Primas')
    XLSX.writeFile(wb, 'materias_primas.xlsx')
  }

  const downloadTemplate = () => {
    const template = [{ codigo: 'MP001', descripcion: 'Harina de trigo', unidad: 'kg', precio: 1.50, categoria: 'Abarrotes', proveedor: 'Distribuidor XYZ' }]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
    XLSX.writeFile(wb, 'plantilla_materias_primas.xlsx')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {t('ingredients.title')}
          </h1>
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {ingredients.length} materias primas registradas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={ingredients.length === 0}>
            <Download className="h-4 w-4" /> {t('ingredients.exportToExcel')}
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild disabled={importing}>
              <span className="cursor-pointer">
                <Upload className="h-4 w-4" /> {t('ingredients.importFromExcel')}
              </span>
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
          <Button size="sm" onClick={() => { setEditingIngredient(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> {t('ingredients.newIngredient')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={t('ingredients.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package className={cn('h-12 w-12 mx-auto mb-3', isDark ? 'text-gray-700' : 'text-gray-200')} />
              <p className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                {search ? t('common.noResults') : t('ingredients.noIngredients')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('border-b text-xs uppercase tracking-wider', isDark ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400')}>
                    <th className="text-left px-6 py-3">{t('ingredients.code')}</th>
                    <th className="text-left px-6 py-3">{t('ingredients.description')}</th>
                    <th className="text-left px-6 py-3">{t('ingredients.category')}</th>
                    <th className="text-left px-6 py-3">{t('ingredients.unit')}</th>
                    <th className="text-right px-6 py-3">{t('ingredients.pricePerUnit')}</th>
                    <th className="text-left px-6 py-3">{t('ingredients.supplier')}</th>
                    <th className="text-right px-6 py-3">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ing, i) => (
                    <tr
                      key={ing.id}
                      className={cn(
                        'border-b last:border-0 transition-colors',
                        isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-50 hover:bg-gray-50'
                      )}
                    >
                      <td className={cn('px-6 py-3 font-mono text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {ing.code}
                      </td>
                      <td className={cn('px-6 py-3 font-medium', isDark ? 'text-white' : 'text-gray-800')}>
                        {ing.description}
                      </td>
                      <td className="px-6 py-3">
                        {ing.category && <Badge variant="secondary">{ing.category}</Badge>}
                      </td>
                      <td className={cn('px-6 py-3', isDark ? 'text-gray-300' : 'text-gray-600')}>
                        {ing.unit}
                      </td>
                      <td className={cn('px-6 py-3 text-right font-medium', isDark ? 'text-gold-400' : 'text-gold-700')}>
                        {formatCurrency(ing.pricePerUnit)}
                      </td>
                      <td className={cn('px-6 py-3 text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {ing.supplier || '—'}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8"
                            onClick={() => { setEditingIngredient(ing); setDialogOpen(true) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(ing.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <IngredientDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ingredient={editingIngredient}
        restaurantId={currentRestaurant?.id}
      />
    </div>
  )
}
