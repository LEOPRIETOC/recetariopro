import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useAppStore } from '../store/useAppStore'
import { subscribeCategories, createCategory, updateCategory, deleteCategory, subscribeRecipes } from '../services/restaurants'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { useToast } from '../components/ui/toast'
import { cn } from '../lib/utils'

const COLORS = ['#d97706', '#059669', '#2563eb', '#C2410C', '#dc2626', '#0891b2', '#65a30d', '#EA580C']

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().default('#d97706'),
})

function CategoryDialog({ open, onClose, category, restaurantId }) {
  const { t } = useTranslation()
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)
  const [selectedColor, setSelectedColor] = useState(category?.color || COLORS[0])

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: category || { color: COLORS[0] },
  })

  useEffect(() => {
    reset(category || { color: COLORS[0] })
    setSelectedColor(category?.color || COLORS[0])
  }, [category, reset])

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { ...data, color: selectedColor }
      if (category?.id) {
        await updateCategory(restaurantId, category.id, payload)
      } else {
        await createCategory(restaurantId, { ...payload, order: Date.now() })
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
            {category ? t('categories.editCategory') : t('categories.newCategory')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('categories.name')}</Label>
            <Input {...register('name')} placeholder="Entradas, Principales..." className={errors.name ? 'border-red-400' : ''} />
          </div>
          <div className="space-y-2">
            <Label>{t('categories.description')}</Label>
            <Input {...register('description')} placeholder="Descripción opcional..." />
          </div>
          <div className="space-y-2">
            <Label>{t('categories.color')}</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-transform hover:scale-110',
                    selectedColor === color && 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? '...' : t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesPage() {
  const { t } = useTranslation()
  const { currentRestaurant, theme } = useAppStore()
  const { success, error } = useToast()
  const isDark = theme === 'night'

  const [categories, setCategories] = useState([])
  const [recipes, setRecipes] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  useEffect(() => {
    if (!currentRestaurant?.id) return
    const u1 = subscribeCategories(currentRestaurant.id, setCategories)
    const u2 = subscribeRecipes(currentRestaurant.id, setRecipes)
    return () => { u1(); u2() }
  }, [currentRestaurant?.id])

  const handleDelete = async (id) => {
    if (!confirm(t('categories.deleteNote'))) return
    try {
      await deleteCategory(currentRestaurant.id, id)
      success(t('common.success'))
    } catch {
      error(t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {t('categories.title')}
          </h1>
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {categories.length} categorías
          </p>
        </div>
        <Button onClick={() => { setEditingCategory(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> {t('categories.newCategory')}
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className={cn('text-center py-16', isDark && 'bg-gray-900 border-gray-800')}>
          <CardContent>
            <Tag className={cn('h-12 w-12 mx-auto mb-3', isDark ? 'text-gray-700' : 'text-gray-200')} />
            <p className={cn('text-sm mb-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {t('categories.noCategories')}
            </p>
            <Button onClick={() => { setEditingCategory(null); setDialogOpen(true) }}>
              <Plus className="h-4 w-4" /> {t('categories.newCategory')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const count = recipes.filter((r) => r.categoryId === cat.id).length
            return (
              <Card
                key={cat.id}
                className={cn(
                  'group hover:shadow-md transition-all duration-200 overflow-hidden',
                  isDark && 'bg-gray-900 border-gray-800'
                )}
              >
                <div className="h-2" style={{ background: cat.color || '#d97706' }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: (cat.color || '#d97706') + '20' }}
                      >
                        <Tag className="h-5 w-5" style={{ color: cat.color || '#d97706' }} />
                      </div>
                      <div>
                        <h3 className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-800')}>
                          {cat.name}
                        </h3>
                        <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {count} receta{count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditingCategory(cat); setDialogOpen(true) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(cat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {cat.description && (
                    <p className={cn('text-xs mt-3 line-clamp-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {cat.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        category={editingCategory}
        restaurantId={currentRestaurant?.id}
      />
    </div>
  )
}
