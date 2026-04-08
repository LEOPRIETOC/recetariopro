import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Leaf, Globe, DollarSign, Eye, EyeOff } from 'lucide-react'

import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { updateRestaurantSettings } from '../services/restaurants'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Input } from '../components/ui/input'
import { useToast } from '../components/ui/toast'
import { cn } from '../lib/utils'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme, language, setLanguage, showCosts, setShowCosts, currentRestaurant } = useAppStore()
  const { isAdmin } = useAuth()
  const { success, error } = useToast()
  const isDark = theme === 'night'
  const [saving, setSaving] = useState(false)

  const themes = [
    { value: 'day', icon: Sun, label: t('settings.themes.day'), preview: 'bg-white border-gray-200' },
    { value: 'night', icon: Moon, label: t('settings.themes.night'), preview: 'bg-gray-900 border-gray-700' },
    { value: 'earth', icon: Leaf, label: t('settings.themes.earth'), preview: 'bg-earth-800 border-earth-600' },
  ]

  const languages = [
    { value: 'es', flag: '🇪🇸', label: 'Español' },
    { value: 'en', flag: '🇺🇸', label: 'English' },
    { value: 'pt', flag: '🇧🇷', label: 'Português' },
  ]

  const handleSave = async () => {
    if (!currentRestaurant?.id) return
    setSaving(true)
    try {
      await updateRestaurantSettings(currentRestaurant.id, {
        showCosts,
        theme,
        language,
      })
      success(t('settings.settingsSaved'))
    } catch {
      error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
        {t('settings.title')}
      </h1>

      {/* Appearance */}
      <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
        <CardHeader>
          <CardTitle>{t('settings.appearance')}</CardTitle>
          <CardDescription>Personaliza la apariencia de la aplicación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme */}
          <div className="space-y-3">
            <Label>{t('settings.theme')}</Label>
            <div className="grid grid-cols-3 gap-3">
              {themes.map(({ value, icon: Icon, label, preview }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    theme === value
                      ? 'border-gold-500 shadow-sm shadow-gold-200'
                      : isDark ? 'border-gray-800 hover:border-gray-700' : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-lg border-2 flex items-center justify-center', preview)}>
                    <Icon className={cn('h-5 w-5', value === 'day' ? 'text-yellow-500' : value === 'night' ? 'text-blue-400' : 'text-earth-400')} />
                  </div>
                  <span className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>{label}</span>
                  {theme === value && <div className="w-2 h-2 rounded-full bg-gold-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label>{t('settings.language')}</Label>
            <Select
              value={language}
              onValueChange={(v) => {
                setLanguage(v)
                i18n.changeLanguage(v)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="mr-2">{lang.flag}</span> {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Show costs toggle */}
      {isAdmin && (
        <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
          <CardHeader>
            <CardTitle>Costos y precios</CardTitle>
            <CardDescription>Controla la visibilidad de información financiera</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">{t('settings.showCosts')}</Label>
                <p className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  {t('settings.showCostsDesc')}
                </p>
              </div>
              <Switch
                checked={showCosts}
                onCheckedChange={setShowCosts}
              />
            </div>
            <div className={cn('mt-4 flex items-center gap-2 text-sm p-3 rounded-xl', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500')}>
              {showCosts
                ? <><Eye className="h-4 w-4 text-emerald-500" /> Los chefs pueden ver costos, precios y márgenes</>
                : <><EyeOff className="h-4 w-4 text-amber-500" /> Los costos están ocultos para los chefs</>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restaurant info */}
      {isAdmin && currentRestaurant && (
        <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
          <CardHeader>
            <CardTitle>{t('settings.restaurant')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.restaurantName')}</Label>
              <Input defaultValue={currentRestaurant.name} readOnly className="max-w-sm" />
              <p className={cn('text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>
                Para cambiar el nombre del restaurante, contacta soporte
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription info */}
      <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
        <CardHeader>
          <CardTitle>{t('subscriptions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('flex items-center justify-between p-4 rounded-xl border', isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gold-200 bg-gold-50')}>
            <div>
              <p className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-800')}>
                Plan {currentRestaurant?.subscription?.plan || 'Starter'}
              </p>
              <p className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-500')}>
                Estado: {currentRestaurant?.subscription?.status || 'active'}
              </p>
            </div>
            <Button variant="outline" size="sm">{t('subscriptions.upgrade')}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : t('settings.saveSettings')}
        </Button>
      </div>
    </div>
  )
}
