import { useTranslation } from 'react-i18next'
import { Search, Menu, Bell, Sun, Moon, Leaf } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'
import { Input } from '../ui/input'
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
  const { sidebarOpen, toggleSidebar, theme, setTheme, language, setLanguage, globalSearch, setGlobalSearch } = useAppStore()

  const isDark = theme === 'night'
  const isEarth = theme === 'earth'

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
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <Input
            placeholder={t('common.search') + '...'}
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className={cn(
              'pl-9 h-8 text-sm',
              isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : ''
            )}
          />
        </div>
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
