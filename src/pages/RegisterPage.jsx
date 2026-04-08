import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, UserPlus } from 'lucide-react'

import { AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { registerUser, mapFirebaseError } from '../services/auth'
import { useToast } from '../components/ui/toast'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  restaurantName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await registerUser(data)
      success(t('auth.registerSuccess'))
      navigate('/')
    } catch (err) {
      const msgKey = mapFirebaseError(err.code)
      error(t('common.error'), t(msgKey))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">
            {t('auth.register')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Crea tu cuenta y comienza gratis
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.name')}</Label>
              <Input
                id="name"
                placeholder="Juan García"
                {...register('name')}
                className={errors.name ? 'border-red-400' : ''}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurantName">{t('auth.restaurantName')}</Label>
              <Input
                id="restaurantName"
                placeholder="La Buena Mesa"
                {...register('restaurantName')}
                className={errors.restaurantName ? 'border-red-400' : ''}
              />
              {errors.restaurantName && <p className="text-xs text-red-500">{errors.restaurantName.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="chef@restaurante.com"
              {...register('email')}
              className={errors.email ? 'border-red-400' : ''}
            />
            {errors.email && <p className="text-xs text-red-500">{t('auth.errors.invalidEmail')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={`pr-10 ${errors.password ? 'border-red-400' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{t('auth.errors.weakPassword')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              className={errors.confirmPassword ? 'border-red-400' : ''}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{t('auth.errors.passwordMismatch')}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando cuenta...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {t('auth.register')}
              </span>
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-gold-600 hover:text-gold-700 font-medium hover:underline">
            {t('auth.login')}
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
