import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

import { AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { resetPassword, mapFirebaseError } from '../services/auth'
import { useToast } from '../components/ui/toast'

const schema = z.object({
  email: z.string().email(),
})

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { error } = useToast()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors }, getValues } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await resetPassword(data.email)
      setSent(true)
    } catch (err) {
      const msgKey = mapFirebaseError(err.code)
      error(t('common.error'), t(msgKey))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4 py-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">
            ¡Correo enviado!
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enviamos un enlace de recuperación a{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">{getValues('email')}</span>
          </p>
          <p className="text-xs text-gray-400">
            Revisa tu bandeja de entrada y carpeta de spam
          </p>
          <Link to="/login">
            <Button variant="outline" className="w-full mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('auth.backToLogin')}
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">
            {t('auth.resetPassword')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('auth.resetPasswordEmail')}
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
              className={errors.email ? 'border-red-400' : ''}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{t('auth.errors.invalidEmail')}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t('auth.sendResetEmail')}
              </span>
            )}
          </Button>
        </form>

        <div className="text-center">
          <Link
            to="/login"
            className="text-sm text-gold-600 hover:text-gold-700 flex items-center justify-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
