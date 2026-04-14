import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useInactivityLogout } from '../../hooks/useInactivityLogout'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { Search, Settings, ChefHat, GripVertical, LogOut } from 'lucide-react'
import { logoutUser } from '../../services/auth'
import { signOut } from 'firebase/auth'
import { auth } from '../../lib/firebase'
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
          'flex-1 flex items-center px-3 py-2.5 text-sm font-medium transition-all text-left',
          isActive
            ? isDark ? 'rounded-r-xl font-light' : 'text-white shadow-sm rounded-xl'
            : isDark
              ? 'rounded-xl text-gray-400 hover:bg-gray-800/40 hover:text-amber-100 font-light'
              : 'rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
        style={isActive
          ? isDark
            ? { background: 'rgba(201,168,76,0.08)', color: '#c9a84c', borderLeft: '2px solid #c9a84c', paddingLeft: '10px' }
            : { backgroundColor: 'var(--accent)' }
          : {}}
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
  const { showWarning, resetTimer } = useInactivityLogout()
  const { canEdit, userProfile } = useAuth()

  const [localCategories, setLocalCategories] = useState([])
  const [showSalirModal, setShowSalirModal] = useState(false)

  const doLogout = async () => {
    try {
      await signOut(auth)
      setUser(null)
      setUserProfile(null)
      setCurrentRestaurant(null)
      localStorage.removeItem('app-storage')
      navigate('/login')
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
    }
  }

  const handleSalirClick = async () => {
    const restaurantIds = userProfile?.restaurantIds || []
    const isMasterUser = userProfile?.role === 'master'
    if (restaurantIds.length > 1 || isMasterUser) {
      setShowSalirModal(true)
    } else {
      if (window.confirm('¿Deseas cerrar sesión?')) {
        await doLogout()
      }
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

  const bg = isDark ? 'night-main-bg' : 'bg-gray-100'
  const sideBg = isDark ? 'night-panel-bg border-r' : 'bg-white border-gray-200'
  const headerBg = isDark ? 'night-panel-bg border-b' : 'bg-white border-gray-200'

  return (
    <div className={cn('flex flex-col h-screen overflow-hidden', bg)}>

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className={cn('flex items-center h-14 px-4 gap-4 border-b flex-shrink-0', headerBg)}>
        {/* Logo */}
        <div className="flex items-center gap-2 select-none flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <ChefHat className="h-4 w-4 text-white" />
          </div>
          <span className={cn('font-display font-bold text-sm hidden sm:block night-logo-text', isDark ? 'text-white' : 'text-gray-900')}>
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
          {/* Settings gear — hidden for usuarios */}
          {canEdit && (
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
          )}
          {/* Logout */}
          <button
            onClick={handleSalirClick}
            className={cn(
              'flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
              isDark
                ? 'border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-400'
                : 'border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-500'
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
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

            {/* Botón Salir */}
            <button
              onClick={selectedCategory ? () => setSelectedCategory(null) : handleSalirClick}
              style={{
                width: '100%',
                marginTop: 8,
                background: 'transparent',
                border: '1px solid var(--red)',
                borderRadius: 8,
                color: 'var(--red)',
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '7px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--red)'; e.currentTarget.style.color = '#fff' }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--red)' }}
            >
              Salir
            </button>

            <div style={{ fontSize: '0.65rem', color: 'var(--t3)', padding: '4px 8px', opacity: 0.5 }}>
              v{import.meta.env.VITE_APP_VERSION || '2.10'} · {import.meta.env.VITE_BUILD_TIME || 'dev'}
            </div>
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

      {/* ── Modal de inactividad ─────────────────────────────────────────── */}
      {/* ── Modal Salir ──────────────────────────────────────────────────── */}
      {showSalirModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--b2)',
            borderRadius: 16, padding: 32,
            width: 'min(380px, 90vw)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.1rem', color: 'var(--text)',
              textAlign: 'center', margin: '0 0 8px',
            }}>
              ¿Qué deseas hacer?
            </h3>

            <button
              onClick={() => { setShowSalirModal(false); navigate('/restaurants') }}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--b2)',
                borderRadius: 10, padding: '14px 16px',
                color: 'var(--text)', fontFamily: 'inherit',
                fontSize: '0.9rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all 0.2s', textAlign: 'left',
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--b2)' }}
            >
              <span style={{ fontSize: '1.2rem' }}>🏠</span>
              <div>
                <div style={{ fontWeight: 600 }}>Cambiar restaurante</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>Ir al selector de restaurantes</div>
              </div>
            </button>

            <button
              onClick={async () => { setShowSalirModal(false); await doLogout() }}
              style={{
                background: 'rgba(192,72,72,0.08)', border: '1px solid rgba(192,72,72,0.25)',
                borderRadius: 10, padding: '14px 16px',
                color: 'var(--red, #c04848)', fontFamily: 'inherit',
                fontSize: '0.9rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all 0.2s', textAlign: 'left',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(192,72,72,0.15)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(192,72,72,0.08)' }}
            >
              <span style={{ fontSize: '1.2rem' }}>→</span>
              <div>
                <div style={{ fontWeight: 600 }}>Cerrar sesión</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>Salir completamente de la app</div>
              </div>
            </button>

            <button
              onClick={() => setShowSalirModal(false)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--t3)', fontFamily: 'inherit',
                fontSize: '0.8rem', cursor: 'pointer',
                padding: 8, marginTop: 4,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showWarning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--b2)',
            borderRadius: 16,
            padding: 32,
            width: 'min(400px, 90vw)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ fontSize: '2rem' }}>⏱</div>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.1rem',
              color: 'var(--text)',
              margin: 0,
            }}>
              ¿Sigues ahí?
            </h3>
            <p style={{ color: 'var(--t2)', fontSize: '0.88rem', margin: 0 }}>
              Tu sesión se cerrará en 2 minutos por inactividad.
            </p>
            <button
              onClick={resetTimer}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 20px',
                fontFamily: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Continuar sesión
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
