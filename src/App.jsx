import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useEffect } from 'react'
import './i18n'

// Layout
import { POSLayout } from './components/layout/POSLayout'
import { ProtectedRoute } from './components/shared/ProtectedRoute'

// Auth pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'

// App pages
import POSMainPage from './pages/POSMainPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import RestaurantSelectorPage from './pages/RestaurantSelectorPage'

function ThemeProvider({ children }) {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')
    if (theme === 'night') {
      root.classList.add('dark')
    }
  }, [theme])

  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/restaurants" element={<RestaurantSelectorPage />} />
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
