import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Settings, ChefHat, GripVertical, LogOut } from 'lucide-react'
import { logoutUser } from '../../services/auth'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'
import { subscribeCategories, updateCategoryOrder } from '../../services/restaurants'
import { Toaster } from '../ui/toast'
import { ConfigModal } from './ConfigModal'

// Special virtual ID for the Sub-recetas section
export const SUBRECIPES_CATEGORY_ID = '__subrecipes__'

// ── Sortable category button ─────────────────────────────────────────────────
function SortableCategoryButton({ cat, isActive, isDark, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 group/cat">
      <button
        {...attributes}
        {...listeners}
        type="button"
        className={cn(
          'flex-shrink-0 p-0.5 rounded opacity-0 group-hover/cat:opacity-60 cursor-grab active:cursor-grabbing touch-none',
          isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'
        )}
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onClick}
        className={cn(
          'flex-1 flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
          isActive
            ? 'text-white shadow-sm'
            : isDark
              ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
        style={isActive ? { backgroundColor: 'var(--accent)' } : {}}
      >
        <span className="truncate">{cat.name}</span>
      </button>
    </div>
  )
}

export function POSLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    theme, globalSearch, setGlobalSearch,
    selectedCategory, setSelectedCategory,
    currentRestaurant, openConfig, accentColor,
    setUser, setUserProfile, setCurrentRestaurant,
  } = useAppStore()
  const isDark = theme === 'night'

  const [localCategories, setLocalCategories] = useState([])
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const handleLogout = async () => {
    try {
      await logoutUser()
      setUser(null)
      setUserProfile(null)
      setCurrentRestaurant(null)
      localStorage.removeItem('app-storage')
      navigate('/login')
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    if (!currentRestaurant?.id) return
    return subscribeCategories(currentRestaurant.id, setLocalCategories)
  }, [currentRestaurant?.id])

  // Auto-select first category when categories load
  useEffect(() => {
    if (localCategories.length > 0 && selectedCategory === null) {
      setSelectedCategory(localCategories[0].id)
    }
  }, [localCategories])

  // Sync --accent CSS variable from store
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor || '#d97706')
  }, [accentColor])

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = localCategories.findIndex((c) => c.id === active.id)
    const newIndex = localCategories.findIndex((c) => c.id === over.id)
    const newOrder = arrayMove(localCategories, oldIndex, newIndex)
    setLocalCategories(newOrder)
    updateCategoryOrder(currentRestaurant.id, newOrder.map((c) => c.id))
  }

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-100'
  const sideBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'

  return (
    <div className={cn('flex flex-col h-screen overflow-hidden', bg)}>

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className={cn('flex items-center h-14 px-4 gap-4 border-b flex-shrink-0', headerBg)}>
        {/* Logo */}
        <div className="flex items-center gap-2 select-none flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <ChefHat className="h-4 w-4 text-white" />
          </div>
          <span className={cn('font-display font-bold text-sm hidden sm:block', isDark ? 'text-white' : 'text-gray-900')}>
            RecetarioPro
          </span>
        </div>

        {/* Restaurant name */}
        {currentRestaurant?.name && (
          <span className={cn('text-xs px-2 py-1 rounded-full border flex-shrink-0 hidden md:block',
            isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
          )}>
            {currentRestaurant.name}
          </span>
        )}

        {/* Global search */}
        <div className="flex-1 max-w-lg relative">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <input
            type="text"
            placeholder={t('common.search') + '...'}
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className={cn(
              'w-full pl-9 pr-4 h-8 text-sm rounded-lg border outline-none transition-colors',
              'focus:ring-2 focus:border-transparent',
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
            )}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Settings gear */}
          <button
            onClick={() => openConfig('ingredients')}
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
              isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            )}
            title="Configuración"
          >
            <Settings className="h-5 w-5" />
          </button>
          {/* Logout */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
              isDark ? 'text-gray-500 hover:bg-gray-800 hover:text-red-400' : 'text-gray-400 hover:bg-gray-100 hover:text-red-500'
            )}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Categories Panel ────────────────────────────────────────── */}
        <aside className={cn(
          'w-[200px] flex-shrink-0 flex flex-col border-r overflow-y-auto',
          sideBg
        )}>
          <div className="p-3 space-y-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localCategories.map((c) => c.id).filter(Boolean)} strategy={verticalListSortingStrategy}>
                {localCategories.map((cat) => (
                  <SortableCategoryButton
                    key={cat.id}
                    cat={cat}
                    isActive={selectedCategory === cat.id}
                    isDark={isDark}
                    onClick={() => setSelectedCategory(cat.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Sub-recetas section — inverted colors */}
          <div className="mt-auto p-3 pt-1">
            <div className={cn('border-t pt-2 mb-1', isDark ? 'border-gray-800' : 'border-gray-200')} />
            <button
              onClick={() => setSelectedCategory(SUBRECIPES_CATEGORY_ID)}
              className={cn(
                'w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                selectedCategory === SUBRECIPES_CATEGORY_ID
                  ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                  : isDark
                    ? 'border border-gray-600 text-gray-400 hover:bg-white hover:text-gray-900'
                    : 'border border-gray-400 text-gray-500 hover:bg-gray-900 hover:text-white'
              )}
            >
              <span className="truncate">Sub-recetas</span>
            </button>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5">
            <Outlet context={{ accentColor }} />
          </div>
        </main>
      </div>

      <Toaster />
      <ConfigModal />

      {/* ── Logout confirmation modal ── */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: isDark ? '#1f2937' : '#ffffff',
            borderRadius: 14, padding: '28px 32px',
            width: 'min(360px, 90vw)',
            display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut style={{ width: 16, height: 16, color: '#ef4444' }} />
              </div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', fontWeight: 700, margin: 0, color: isDark ? '#f9fafb' : '#111827' }}>
                ¿Cerrar sesión?
              </h3>
            </div>
            <p style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: '.88rem', margin: 0 }}>
              Se cerrará tu sesión en este dispositivo.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, background: 'transparent', color: isDark ? '#d1d5db' : '#374151', fontSize: '.85rem', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: '.85rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
