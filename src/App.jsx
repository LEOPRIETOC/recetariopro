import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useEffect, lazy, Suspense } from 'react'
import './i18n'

// Layout
import { POSLayout } from './components/layout/POSLayout'
import { ProtectedRoute } from './components/shared/ProtectedRoute'
import { UpdateBar } from './components/shared/UpdateBar'
import { VersionFooter } from './components/shared/VersionFooter'
import { LicenseBanner } from './components/shared/LicenseBanner'

// Auth pages — eager (camino critico de login)
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

// App pages — lazy split para que el bundle inicial sea pequeno.
// POSMainPage es la pantalla principal, queda eager.
import POSMainPage from './pages/POSMainPage'
import RestaurantSelectorPage from './pages/RestaurantSelectorPage'
const RecipeDetailPage     = lazy(() => import('./pages/RecipeDetailPage'))
const RestaurantsManagePage = lazy(() => import('./pages/RestaurantsManagePage'))

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function ThemeProvider({ children }) {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.classList.remove('dark')
    if (theme === 'night') {
      root.classList.add('dark')
    }
  }, [theme])

  return children
}

export default function App() {
  useEffect(() => {
    console.log('APP ENV:', import.meta.env.VITE_APP_ENV)
    console.log('ALL ENV:', import.meta.env)
    console.log('HOSTNAME:', window.location.hostname)
  }, [])

  return (
    <ThemeProvider>
      <UpdateBar />
      <VersionFooter />
      <BrowserRouter>
        <LicenseBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/restaurants" element={<RestaurantSelectorPage />} />
            <Route path="/restaurants/new" element={<Suspense fallback={<PageFallback />}><RestaurantsManagePage /></Suspense>} />
            <Route element={<POSLayout />}>
              <Route path="/" element={<POSMainPage />} />
              <Route path="/recipes/new" element={<Suspense fallback={<PageFallback />}><RecipeDetailPage /></Suspense>} />
              <Route path="/recipes/:id" element={<Suspense fallback={<PageFallback />}><RecipeDetailPage /></Suspense>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
