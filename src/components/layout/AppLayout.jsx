import { Outlet } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/useAppStore'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Toaster } from '../ui/toast'

export function AppLayout() {
  const { sidebarOpen, theme } = useAppStore()
  const isDark = theme === 'night'
  const isEarth = theme === 'earth'

  return (
    <div
      className={cn(
        'min-h-screen',
        isDark ? 'bg-gray-950 text-gray-100' : isEarth ? 'bg-earth-50 text-earth-900' : 'bg-gray-50 text-gray-900'
      )}
    >
      <Sidebar />
      <Header />

      <main
        className={cn(
          'transition-all duration-300 pt-16',
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'
        )}
      >
        <div className="p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
