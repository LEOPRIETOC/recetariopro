import { useEffect, useState, useRef } from 'react'

const isDev = import.meta.env.VITE_APP_ENV === 'dev'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useInactivityLogout } from '../../hooks/useInactivityLogout'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { Search, Settings, ChefHat, GripVertical, LogOut } from 'lucide-react'
import { logoutUser } from '../../services/auth'
import { signOut } from 'firebase/auth'
import { auth, db } from '../../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
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
  const location = useLocation()
  const recipeOpen = location.pathname.startsWith('/recipes')
  const { showWarning, resetTimer } = useInactivityLogout()
  const { canEdit, userProfile } = useAuth()

  const [localCategories, setLocalCategories] = useState([])
  const [showSalirModal, setShowSalirModal] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef(null)
  const [counts, setCounts] = useState({ recipes: 0, subrecipes: 0 })

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

  const loadCounts = async () => {
    if (!currentRestaurant?.id) return
    try {
      const snap = await getDocs(collection(db, 'restaurants', currentRestaurant.id, 'recipes'))
      const all = snap.docs.map(d => d.data())
      const isSub = (r) => r.isSubRecipe === true || r.type === 'subrecipe'
      setCounts({
        recipes: all.filter(r => !isSub(r) && r.active !== false).length,
        subrecipes: all.filter(r => isSub(r)).length,
      })
    } catch (err) {
      console.error('[counts]', err)
    }
  }

  useEffect(() => {
    loadCounts()
  }, [currentRestaurant?.id])

  const handleSearch = async (query) => {
    setGlobalSearch(query)
    if (!query || query.length < 2 || !currentRestaurant?.id) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearching(true)
    try {
      const snap = await getDocs(collection(db, 'restaurants', currentRestaurant.id, 'recipes'))
      const q = query.toLowerCase()
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r =>
          r.active !== false && (
            r.name?.toLowerCase().includes(q) ||
            r.code?.toLowerCase().includes(q) ||
            r.ingredients?.some(i => i.ingredientName?.toLowerCase().includes(q))
          )
        )
        .slice(0, 10)
      setSearchResults(results)
      setSearchOpen(true)
    } catch (err) {
      console.error('[pos-search]', err)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => handleSearch(globalSearch), 300)
    return () => clearTimeout(searchTimer.current)
  }, [globalSearch, currentRestaurant?.id])

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.pos-search-container')) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

  useEffect(() => {
    document.title = isDev ? '⚠️ DEV — RecetarioPro' : 'RecetarioPro'
  }, [])

  return (
    <div className={cn('flex flex-col h-screen overflow-hidden', bg)}>

      {/* ── Dev banner ─────────────────────────────────────────────────────── */}
      {isDev && (
        <div style={{
          background: '#F59E0B',
          color: '#111',
          textAlign: 'center',
          padding: '6px',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          zIndex: 99999,
          flexShrink: 0,
          width: '100%',
        }}>
          ⚠️ AMBIENTE DE PRUEBAS — Los cambios aquí NO afectan producción
        </div>
      )}

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className={cn('flex items-center h-14 px-4 gap-4 border-b flex-shrink-0', headerBg)}
        style={{ opacity: recipeOpen ? 0.4 : 1, pointerEvents: recipeOpen ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
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
        <div className="pos-search-container flex-1 max-w-lg" style={{ position: 'relative' }}>
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10', isDark ? 'text-gray-500' : 'text-gray-400')} style={{ pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Buscar recetas, códigos, ingredientes..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onFocus={() => globalSearch.length > 1 && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            className={cn(
              'w-full pl-9 pr-8 h-8 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-amber-400'
            )}
          />
          {searching && (
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: isDark ? '#6b7280' : '#9ca3af' }}>…</span>
          )}

          {/* Dropdown resultados */}
          {searchOpen && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: isDark ? '#1f2937' : '#fff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: 12, zIndex: 9999,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              maxHeight: 380, overflowY: 'auto',
            }}>
              {searchResults.map(recipe => (
                <div
                  key={recipe.id}
                  onMouseDown={() => {
                    setGlobalSearch('')
                    setSearchOpen(false)
                    navigate(`/recipes/${recipe.id}`)
                  }}
                  style={{
                    padding: '9px 14px', cursor: 'pointer',
                    borderBottom: `1px solid ${isDark ? '#374151' : '#f3f4f6'}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'transparent', transition: 'background 0.12s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = isDark ? '#374151' : '#f9fafb'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 7, overflow: 'hidden', flexShrink: 0,
                    background: isDark ? '#374151' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                  }}>
                    {recipe.photoURL
                      ? <img src={recipe.photoURL} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🍽'
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#f9fafb' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {recipe.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#6b7280' : '#9ca3af', display: 'flex', gap: 6, marginTop: 2 }}>
                      <span>{recipe.code}</span>
                      <span>·</span>
                      <span>{recipe.menuName || 'Sin menú'}</span>
                      <span>·</span>
                      <span style={{ color: recipe.isSubRecipe ? '#60a5fa' : 'var(--accent)' }}>
                        {recipe.isSubRecipe ? 'Sub-receta' : 'Receta'}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: isDark ? '#4b5563' : '#d1d5db', fontSize: '0.8rem' }}>→</span>
                </div>
              ))}
            </div>
          )}

          {/* Sin resultados */}
          {searchOpen && searchResults.length === 0 && globalSearch.length > 1 && !searching && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: isDark ? '#1f2937' : '#fff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: 12, zIndex: 9999,
              padding: '14px', textAlign: 'center',
              color: isDark ? '#6b7280' : '#9ca3af', fontSize: '0.82rem',
            }}>
              Sin resultados para "{globalSearch}"
            </div>
          )}
        </div>

        {/* Counts display */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
          borderRadius: 10, padding: '5px 12px', flexShrink: 0,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
              {counts.recipes}
            </div>
            <div style={{ fontSize: '0.6rem', color: isDark ? '#6b7280' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recetas
            </div>
          </div>
          <div style={{ width: 1, height: 24, background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: isDark ? '#60a5fa' : '#3b82f6', lineHeight: 1 }}>
              {counts.subrecipes}
            </div>
            <div style={{ fontSize: '0.6rem', color: isDark ? '#6b7280' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sub-rec.
            </div>
          </div>
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
        )}
          style={{ opacity: recipeOpen ? 0.4 : 1, pointerEvents: recipeOpen ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
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
