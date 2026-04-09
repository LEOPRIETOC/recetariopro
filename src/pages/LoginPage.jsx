import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, LogIn } from 'lucide-react'

import { AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { loginUser, mapFirebaseError } from '../services/auth'
import { useToast } from '../components/ui/toast'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    setAuthError('')
    try {
      await loginUser(data)
      success(t('auth.loginSuccess'))
      navigate('/')
    } catch (err) {
      const msgKey = mapFirebaseError(err.code)
      setAuthError(t(msgKey))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">
            {t('auth.login')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ingresa tus credenciales para acceder
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="chef@restaurante.com"
              {...register('email')}
              className={errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{t('auth.errors.invalidEmail')}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-gold-600 hover:text-gold-700 hover:underline"
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
                className={errors.password ? 'border-red-400 focus-visible:ring-red-400 pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{t('auth.errors.weakPassword')}</p>
            )}
          </div>

          {authError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.84rem' }}>
              {authError}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Ingresando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                {t('auth.login')}
              </span>
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-gold-600 hover:text-gold-700 font-medium hover:underline">
            {t('auth.register')}
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
