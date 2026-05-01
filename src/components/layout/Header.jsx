import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Bell, Sun, Moon, Leaf } from 'lucide-react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'

const themes = [
  { value: 'day', icon: Sun, label: 'settings.themes.day' },
  { value: 'night', icon: Moon, label: 'settings.themes.night' },
  { value: 'earth', icon: Leaf, label: 'settings.themes.earth' },
]

const languages = [
  { value: 'es', flag: '🇪🇸', label: 'Español' },
  { value: 'en', flag: '🇺🇸', label: 'English' },
  { value: 'pt', flag: '🇧🇷', label: 'Português' },
]

export function Header({ title }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { sidebarOpen, toggleSidebar, theme, setTheme, language, setLanguage, currentRestaurant } = useAppStore()

  const isDark = theme === 'night'
  const isEarth = theme === 'earth'

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)

  const handleGlobalSearch = async (query) => {
    if (!query || query.length < 2 || !currentRestaurant?.id) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }

    setSearching(true)
    try {
      const snap = await getDocs(
        collection(db, 'restaurants', currentRestaurant.id, 'recipes')
      )
      const queryLower = query.toLowerCase()
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r =>
          r.active !== false && (
            r.name?.toLowerCase().includes(queryLower) ||
            r.code?.toLowerCase().includes(queryLower) ||
            r.reference?.toLowerCase().includes(queryLower) ||
            r.ingredients?.some(ing =>
              ing.ingredientName?.toLowerCase().includes(queryLower)
            )
          )
        )
        .slice(0, 10)
      setSearchResults(results)
      setSearchOpen(results.length > 0)
    } catch (err) {
      console.error('[search]', err)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      handleGlobalSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, currentRestaurant?.id])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.search-container')) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-10 h-16 flex items-center gap-4 px-6 border-b transition-all duration-300',
        sidebarOpen ? 'left-64' : 'left-16',
        isDark ? 'bg-gray-900 border-gray-800' : isEarth ? 'bg-earth-800 border-earth-700' : 'bg-white border-gray-100'
      )}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'p-2 rounded-lg transition-colors lg:hidden',
          isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'
        )}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Title */}
      {title && (
        <h1 className={cn('font-display text-xl font-semibold hidden sm:block', isDark ? 'text-white' : isEarth ? 'text-earth-50' : 'text-gray-900')}>
          {title}
        </h1>
      )}

      {/* Search */}
      <div className="search-container" style={{ position: 'relative', flex: 1, maxWidth: 500 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar recetas, códigos, ingredientes..."
          onFocus={e => {
            e.target.style.borderColor = 'var(--accent)'
            if (searchQuery.length > 1) setSearchOpen(true)
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--b1)'
          }}
          style={{
            width: '100%',
            background: 'var(--bg3)',
            border: '1px solid var(--b1)',
            borderRadius: 10,
            padding: '9px 36px 9px 36px',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />

        {/* Ícono lupa */}
        <span style={{
          position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--t3)', fontSize: '0.9rem',
          pointerEvents: 'none',
        }}>🔍</span>

        {/* Spinner */}
        {searching && (
          <span style={{
            position: 'absolute', right: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--t3)', fontSize: '0.75rem',
          }}>...</span>
        )}

        {/* Dropdown resultados */}
        {searchOpen && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0, right: 0,
            background: 'var(--bg2)',
            border: '1px solid var(--b2)',
            borderRadius: 12,
            boxShadow: 'var(--sh)',
            zIndex: 1000,
            overflow: 'hidden',
            maxHeight: 400,
            overflowY: 'auto',
          }}>
            {searchResults.map(recipe => (
              <div
                key={recipe.id}
                onClick={() => {
                  setSearchQuery('')
                  setSearchOpen(false)
                  navigate(`/recipes/${recipe.id}`, { state: { from: 'header-search' } })
                }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--b1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Foto o emoji */}
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  overflow: 'hidden', flexShrink: 0,
                  background: 'var(--bg3)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '1.2rem',
                }}>
                  {recipe.photoURL
                    ? <img src={recipe.photoURL} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🍽'
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.87rem', fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {recipe.name}
                  </div>
                  <div style={{
                    fontSize: '0.72rem', color: 'var(--t3)',
                    display: 'flex', gap: 8, marginTop: 2,
                  }}>
                    <span>{recipe.code}</span>
                    <span>·</span>
                    <span>{recipe.menuName || 'Sin menú'}</span>
                    <span>·</span>
                    <span style={{ color: recipe.isSubRecipe ? 'var(--blue, #3b82f6)' : 'var(--accent)' }}>
                      {recipe.isSubRecipe ? 'Sub-receta' : 'Receta'}
                    </span>
                  </div>
                </div>

                <span style={{ color: 'var(--t3)', fontSize: '0.8rem' }}>→</span>
              </div>
            ))}
          </div>
        )}

        {/* Sin resultados */}
        {searchOpen && searchResults.length === 0 && searchQuery.length > 1 && !searching && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0, right: 0,
            background: 'var(--bg2)',
            border: '1px solid var(--b2)',
            borderRadius: 12,
            boxShadow: 'var(--sh)',
            zIndex: 1000,
            padding: '16px',
            textAlign: 'center',
            color: 'var(--t3)',
            fontSize: '0.84rem',
          }}>
            No se encontraron resultados para "{searchQuery}"
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Language selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-sm">
              {languages.find(l => l.value === language)?.flag || '🌐'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.value}
                onClick={() => {
                  setLanguage(lang.value)
                  i18n.changeLanguage(lang.value)
                }}
                className={language === lang.value ? 'bg-gold-50 text-gold-700' : ''}
              >
                <span className="mr-2">{lang.flag}</span>
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {theme === 'night' ? <Moon className="h-4 w-4" /> : theme === 'earth' ? <Leaf className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('settings.theme')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {themes.map(({ value, icon: Icon, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className={theme === value ? 'bg-gold-50 text-gold-700' : ''}
              >
                <Icon className="h-4 w-4 mr-2" />
                {t(label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications placeholder */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
