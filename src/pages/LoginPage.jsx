import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { loginUser, signInWithSocialProvider, mapFirebaseError } from '../services/auth'
import { googleProvider, appleProvider } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useTranslation } from 'react-i18next'
import { useToast } from '../components/ui/toast'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const SOCIAL_ERRORS = {
  'auth/popup-closed-by-user':    'Cerraste la ventana antes de completar el inicio de sesión.',
  'auth/popup-blocked':           'El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.',
  'auth/account-exists-with-different-credential': 'Ya existe una cuenta con ese correo usando otro método de inicio de sesión.',
  'auth/cancelled-popup-request': 'Solicitud cancelada.',
  'auth/network-request-failed':  'Error de red. Verifica tu conexión.',
  'auth/internal-error':          'Error interno. Intenta de nuevo.',
}

function mapSocialError(code) {
  return SOCIAL_ERRORS[code] || 'Ocurrió un error al iniciar sesión. Intenta de nuevo.'
}

// ── SVG logos ────────────────────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

function AppleLogo({ isDark }) {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg">
      <path
        fill={isDark ? '#fff' : '#000'}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 135.4-317.7 269-317.7 70.1 0 128.4 46.4 172.5 46.4 42.1 0 108.6-49 188.2-49 30.8 0 111 2.6 171.3 90.7zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success } = useToast()
  const theme = useAppStore((s) => s.theme)
  const isDark = theme === 'night'

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(null) // 'google' | 'apple'
  const [authError, setAuthError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  // Email / password login
  const onSubmit = async (data) => {
    setLoading(true)
    setAuthError('')
    try {
      await loginUser(data)
      success(t('auth.loginSuccess'))
      navigate('/restaurants')
    } catch (err) {
      const msgKey = mapFirebaseError(err.code)
      setAuthError(t(msgKey))
    } finally {
      setLoading(false)
    }
  }

  // Social login
  const handleSocial = async (provider, name) => {
    setSocialLoading(name)
    setAuthError('')
    try {
      await signInWithSocialProvider(provider)
      // onAuthChange in useAuth.js handles navigation to /restaurants
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setAuthError(mapSocialError(err.code))
      }
    } finally {
      setSocialLoading(null)
    }
  }

  // ── styles ──
  const formBg = isDark ? 'bg-gray-950' : 'bg-white'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputBorder = isDark ? 'border-gray-700 bg-gray-900 text-white placeholder:text-gray-600' : ''
  const dividerColor = isDark ? 'border-gray-800' : 'border-gray-200'
  const dividerText = isDark ? 'bg-gray-950 text-gray-500' : 'bg-white text-gray-400'
  const socialBtn = isDark
    ? 'bg-gray-900 border-gray-700 text-white hover:bg-gray-800'
    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

      {/* ── LEFT: food photo (hidden on mobile) ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="/login-bg.png"
          alt="Restaurante elegante"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Text over image */}
        <div className="relative z-10 flex flex-col justify-end p-14 text-white">
          <div style={{ background: 'rgba(0,0,0,0.45)', borderRadius: 12, padding: '20px 24px', backdropFilter: 'blur(2px)' }}>
            <span className="font-display font-bold text-xl block mb-3">RecetarioPro</span>
            <h2 className="font-display text-3xl font-bold leading-snug mb-3">
              Tu cocina,<br />protegida.
            </h2>
            <p className="text-gray-200 text-base leading-relaxed max-w-xs">
              Estandariza, controla y comparte tus recetas con tu equipo. Sin cuadernos, sin WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: form ─────────────────────────────────────────────────── */}
      <div className={`w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 ${formBg}`}>
        <div className="w-full max-w-[380px]">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <h1 className={`font-display text-2xl font-bold ${textPrimary}`}>RecetarioPro</h1>
          </div>

          {/* Title */}
          <div className="mb-6">
            <h2 className={`font-display text-xl font-semibold ${textPrimary}`}>Bienvenido de nuevo</h2>
            <p className={`text-sm mt-1 ${textSecondary}`}>Ingresa para acceder a tu recetario</p>
          </div>

          {/* Social buttons */}
          <div className="flex flex-col gap-3 mb-5">
            <button
              type="button"
              onClick={() => handleSocial(googleProvider, 'google')}
              disabled={!!socialLoading || loading}
              className={`w-full flex items-center justify-center gap-3 h-10 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${socialBtn}`}
            >
              {socialLoading === 'google' ? (
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleLogo />
              )}
              Continuar con Google
            </button>

            <button
              type="button"
              onClick={() => handleSocial(appleProvider, 'apple')}
              disabled={!!socialLoading || loading}
              className={`w-full flex items-center justify-center gap-3 h-10 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${socialBtn}`}
            >
              {socialLoading === 'apple' ? (
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <AppleLogo isDark={isDark} />
              )}
              Continuar con Apple
            </button>
          </div>

          {/* Divider */}
          <div className={`relative flex items-center mb-5`}>
            <div className={`flex-1 border-t ${dividerColor}`} />
            <span className={`px-3 text-xs ${dividerText}`}>o continúa con correo</span>
            <div className={`flex-1 border-t ${dividerColor}`} />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className={textPrimary}>{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="chef@restaurante.com"
                {...register('email')}
                className={`${inputBorder} ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{t('auth.errors.invalidEmail')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className={textPrimary}>{t('auth.password')}</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--accent, #C2410C)' }}
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña"
                  {...register('password')}
                  className={`pr-10 ${inputBorder} ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary} hover:text-current`}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{t('auth.errors.weakPassword')}</p>
              )}
            </div>

            {authError && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!socialLoading}
              className="w-full h-10 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading ? '#000' : '#111111', color: '#ffffff', border: 'none' }}
              onMouseOver={(e) => { if (!loading) e.currentTarget.style.background = '#000000' }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#111111' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>

          <p className={`text-center text-xs mt-8 ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>
            © 2026 RecetarioPro. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
