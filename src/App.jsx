import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useEffect } from 'react'
import './i18n'

// Layout
import { POSLayout } from './components/layout/POSLayout'
import { ProtectedRoute } from './components/shared/ProtectedRoute'
import { UpdateBar } from './components/shared/UpdateBar'
import { VersionFooter } from './components/shared/VersionFooter'
import { LicenseBanner } from './components/shared/LicenseBanner'

// Auth pages
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

// App pages
import POSMainPage from './pages/POSMainPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import RestaurantSelectorPage from './pages/RestaurantSelectorPage'
import RestaurantsManagePage from './pages/RestaurantsManagePage'

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
            <Route path="/restaurants/new" element={<RestaurantsManagePage />} />
            <Route element={<POSLayout />}>
              <Route path="/" element={<POSMainPage />} />
              <Route path="/recipes/new" element={<RecipeDetailPage />} />
              <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
