import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, BookOpen, Tag, Package, BarChart3,
  Settings, Users, CreditCard, ChefHat, LogOut,
  Menu, X, Building2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { logoutUser } from '../../services/auth'
import { useToast } from '../ui/toast'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { to: '/recipes', icon: BookOpen, key: 'nav.recipes' },
  { to: '/categories', icon: Tag, key: 'nav.categories' },
  { to: '/ingredients', icon: Package, key: 'nav.ingredients' },
  { to: '/analytics', icon: BarChart3, key: 'nav.analytics' },
]

const adminItems = [
  { to: '/users', icon: Users, key: 'nav.users' },
  { to: '/subscriptions', icon: CreditCard, key: 'nav.subscriptions' },
  { to: '/settings', icon: Settings, key: 'nav.settings' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarOpen, toggleSidebar, theme, currentRestaurant } = useAppStore()
  const { userProfile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { success } = useToast()

  const handleLogout = async () => {
    await logoutUser()
    success(t('auth.logoutSuccess'))
    navigate('/login')
  }

  const isDark = theme === 'night'
  const isEarth = theme === 'earth'

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 h-full flex flex-col transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64' : 'w-16',
          isDark ? 'bg-gray-950 border-r border-gray-800' : isEarth ? 'bg-earth-900 border-r border-earth-700' : 'bg-white border-r border-gray-100',
          'shadow-xl lg:shadow-none'
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center h-16 px-4 border-b', isDark ? 'border-gray-800' : isEarth ? 'border-earth-700' : 'border-gray-100')}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gold-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {currentRestaurant?.logoURL
                  ? <img src={currentRestaurant.logoURL} alt="Logo" className="w-full h-full object-contain" />
                  : <ChefHat className="h-4 w-4 text-white" />}
              </div>
              <div className="min-w-0">
                <p className={cn('font-display font-bold text-sm truncate', isDark ? 'text-white' : isEarth ? 'text-earth-100' : 'text-gray-900')}>
                  {currentRestaurant?.name || 'RecetarioPro'}
                </p>
                <p className={cn('text-xs truncate', isDark ? 'text-gray-500' : isEarth ? 'text-earth-300' : 'text-gray-400')}>
                  RecetarioPro
                </p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gold-600 flex items-center justify-center mx-auto overflow-hidden">
              {currentRestaurant?.logoURL
                ? <img src={currentRestaurant.logoURL} alt="Logo" className="w-full h-full object-contain" />
                : <ChefHat className="h-4 w-4 text-white" />}
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className={cn(
              'ml-auto p-1.5 rounded-lg transition-colors flex-shrink-0',
              isDark ? 'text-gray-400 hover:bg-gray-800' : isEarth ? 'text-earth-300 hover:bg-earth-800' : 'text-gray-400 hover:bg-gray-100',
              !sidebarOpen && 'hidden'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Restaurant selector */}
        {sidebarOpen && currentRestaurant && (
          <div className={cn('px-3 py-2 border-b', isDark ? 'border-gray-800' : isEarth ? 'border-earth-700' : 'border-gray-100')}>
            <button className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors',
              isDark ? 'text-gray-400 hover:bg-gray-800' : isEarth ? 'text-earth-300 hover:bg-earth-800' : 'text-gray-500 hover:bg-gray-50'
            )}>
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{currentRestaurant.name}</span>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  !sidebarOpen && 'justify-center',
                  isActive
                    ? 'bg-gold-600 text-white shadow-sm shadow-gold-600/30'
                    : isDark
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    : isEarth
                    ? 'text-earth-200 hover:bg-earth-800 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
              title={!sidebarOpen ? t(key) : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{t(key)}</span>}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className={cn('my-3 border-t', isDark ? 'border-gray-800' : isEarth ? 'border-earth-700' : 'border-gray-100')} />
              {sidebarOpen && (
                <p className={cn('px-3 text-xs font-semibold uppercase tracking-wider mb-2',
                  isDark ? 'text-gray-600' : isEarth ? 'text-earth-400' : 'text-gray-400'
                )}>
                  Admin
                </p>
              )}
              {adminItems.map(({ to, icon: Icon, key }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      !sidebarOpen && 'justify-center',
                      isActive
                        ? 'bg-gold-600 text-white shadow-sm shadow-gold-600/30'
                        : isDark
                        ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        : isEarth
                        ? 'text-earth-200 hover:bg-earth-800 hover:text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )
                  }
                  title={!sidebarOpen ? t(key) : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="truncate">{t(key)}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className={cn('p-3 border-t', isDark ? 'border-gray-800' : isEarth ? 'border-earth-700' : 'border-gray-100')}>
          {sidebarOpen ? (
            <div className={cn('flex items-center gap-3 px-2 py-2 rounded-xl', isDark ? 'bg-gray-900' : isEarth ? 'bg-earth-800' : 'bg-gray-50')}>
              <div className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {userProfile?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', isDark ? 'text-white' : isEarth ? 'text-earth-100' : 'text-gray-800')}>
                  {userProfile?.name || 'Usuario'}
                </p>
                <p className={cn('text-xs truncate capitalize', isDark ? 'text-gray-500' : isEarth ? 'text-earth-400' : 'text-gray-400')}>
                  {userProfile?.role || 'chef'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className={cn('p-1.5 rounded-lg transition-colors flex-shrink-0',
                  isDark ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                )}
                title={t('auth.logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className={cn(
                'w-full flex items-center justify-center p-2.5 rounded-xl transition-colors',
                isDark ? 'text-gray-500 hover:text-red-400 hover:bg-gray-800' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              )}
              title={t('auth.logout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
