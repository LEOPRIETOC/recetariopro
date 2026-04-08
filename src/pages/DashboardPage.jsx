import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, Tag, Package, TrendingUp, Plus, ChevronRight, Clock } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { subscribeRecipes, subscribeCategories, subscribeIngredients } from '../services/restaurants'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { formatCurrency } from '../lib/utils'

function StatCard({ icon: Icon, label, value, color, to }) {
  const { theme } = useAppStore()
  const isDark = theme === 'night'

  return (
    <Link to={to}>
      <Card className={cn(
        'hover:shadow-md transition-all duration-200 cursor-pointer group',
        isDark && 'bg-gray-900 border-gray-800 hover:border-gold-700'
      )}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {label}
              </p>
              <p className={cn('text-3xl font-bold mt-1 font-display', isDark ? 'text-white' : 'text-gray-900')}>
                {value}
              </p>
            </div>
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user, userProfile } = useAuth()
  const { currentRestaurant, theme, showCosts } = useAppStore()
  const isDark = theme === 'night'

  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [ingredients, setIngredients] = useState([])

  useEffect(() => {
    if (!currentRestaurant?.id) return
    const unsub1 = subscribeRecipes(currentRestaurant.id, setRecipes)
    const unsub2 = subscribeCategories(currentRestaurant.id, setCategories)
    const unsub3 = subscribeIngredients(currentRestaurant.id, setIngredients)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [currentRestaurant?.id])

  const activeRecipes = recipes.filter((r) => r.active !== false)
  const recentRecipes = [...recipes].sort((a, b) => {
    const ta = a.updatedAt?.seconds || 0
    const tb = b.updatedAt?.seconds || 0
    return tb - ta
  }).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
          {t('dashboard.welcome')},{' '}
          <span className="text-gold-600">{userProfile?.name?.split(' ')[0] || 'Chef'}</span> 👋
        </h1>
        <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {currentRestaurant?.name} &mdash; {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label={t('dashboard.totalRecipes')} value={recipes.length} color="bg-gold-600" to="/recipes" />
        <StatCard icon={TrendingUp} label={t('dashboard.activeRecipes')} value={activeRecipes.length} color="bg-emerald-500" to="/recipes" />
        <StatCard icon={Tag} label={t('dashboard.categories')} value={categories.length} color="bg-blue-500" to="/categories" />
        <StatCard icon={Package} label={t('dashboard.ingredients')} value={ingredients.length} color="bg-purple-500" to="/ingredients" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent recipes */}
        <Card className={cn('lg:col-span-2', isDark && 'bg-gray-900 border-gray-800')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t('dashboard.recentActivity')}</CardTitle>
            <Link to="/recipes">
              <Button variant="ghost" size="sm" className="text-gold-600 h-7">
                {t('common.view')} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentRecipes.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className={cn('h-10 w-10 mx-auto mb-3', isDark ? 'text-gray-700' : 'text-gray-200')} />
                <p className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  {t('recipes.noRecipes')}
                </p>
                <Link to="/recipes">
                  <Button className="mt-3" size="sm">
                    <Plus className="h-4 w-4" /> {t('dashboard.newRecipe')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRecipes.map((recipe) => (
                  <Link key={recipe.id} to={`/recipes/${recipe.id}`}>
                    <div className={cn(
                      'flex items-center gap-3 p-3 rounded-xl transition-colors',
                      isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    )}>
                      {recipe.photoURL ? (
                        <img src={recipe.photoURL} alt={recipe.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', isDark ? 'bg-gray-800' : 'bg-gold-50')}>
                          <BookOpen className="h-5 w-5 text-gold-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-800')}>
                          {recipe.name}
                        </p>
                        <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {recipe.code && <span className="font-mono">{recipe.code} · </span>}
                          {recipe.portions} porciones
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {showCosts && recipe.salePrice && (
                          <span className={cn('text-xs font-medium', isDark ? 'text-gold-400' : 'text-gold-600')}>
                            {formatCurrency(recipe.salePrice)}
                          </span>
                        )}
                        <Badge variant={recipe.active !== false ? 'success' : 'secondary'}>
                          {recipe.active !== false ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/recipes/new">
              <Button className="w-full justify-start gap-3" variant="outline">
                <BookOpen className="h-4 w-4 text-gold-600" />
                {t('dashboard.newRecipe')}
              </Button>
            </Link>
            <Link to="/ingredients/new">
              <Button className="w-full justify-start gap-3" variant="outline">
                <Package className="h-4 w-4 text-purple-500" />
                {t('dashboard.newIngredient')}
              </Button>
            </Link>
            <Link to="/categories">
              <Button className="w-full justify-start gap-3" variant="outline">
                <Tag className="h-4 w-4 text-blue-500" />
                {t('nav.categories')}
              </Button>
            </Link>
            <Link to="/analytics">
              <Button className="w-full justify-start gap-3" variant="outline">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                {t('nav.analytics')}
              </Button>
            </Link>
          </CardContent>

          {/* Categories breakdown */}
          {categories.length > 0 && (
            <CardContent className="pt-0">
              <div className={cn('border-t pt-4', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <p className={cn('text-xs font-semibold mb-3 uppercase tracking-wider', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  {t('nav.categories')}
                </p>
                <div className="space-y-2">
                  {categories.slice(0, 5).map((cat) => {
                    const count = recipes.filter((r) => r.categoryId === cat.id).length
                    return (
                      <div key={cat.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: cat.color || '#d97706' }} />
                          <span className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>{cat.name}</span>
                        </div>
                        <span className={cn('text-xs font-medium', isDark ? 'text-gray-500' : 'text-gray-400')}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
