import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function ProtectedRoute({ requireAdmin = false }) {
  const { user, userProfile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gold-600 flex items-center justify-center animate-pulse">
            <span className="text-white text-xl font-display font-bold">R</span>
          </div>
          <div className="h-5 w-5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (userProfile?.mustChangePassword === true && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
