import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, TrendingUp, Star, DollarSign, HelpCircle, ThumbsDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'

import { useAppStore } from '../store/useAppStore'
import { subscribeRecipes, subscribeSalesData, importSalesData } from '../services/restaurants'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { useToast } from '../components/ui/toast'
import { cn, formatCurrency } from '../lib/utils'

const QUADRANT_COLORS = {
  star: '#f59e0b',
  cashCow: '#10b981',
  questionMark: '#3b82f6',
  dog: '#ef4444',
}

const QUADRANT_LABELS = {
  star: { icon: Star, key: 'analytics.stars', desc: 'Alta popularidad, Alto margen', color: QUADRANT_COLORS.star },
  cashCow: { icon: DollarSign, key: 'analytics.cashCows', desc: 'Alta popularidad, Bajo margen', color: QUADRANT_COLORS.cashCow },
  questionMark: { icon: HelpCircle, key: 'analytics.questionMarks', desc: 'Baja popularidad, Alto margen', color: QUADRANT_COLORS.questionMark },
  dog: { icon: ThumbsDown, key: 'analytics.dogs', desc: 'Baja popularidad, Bajo margen', color: QUADRANT_COLORS.dog },
}

function getQuadrant(popularity, margin, midPopularity, midMargin) {
  if (popularity >= midPopularity && margin >= midMargin) return 'star'
  if (popularity >= midPopularity && margin < midMargin) return 'cashCow'
  if (popularity < midPopularity && margin >= midMargin) return 'questionMark'
  return 'dog'
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xl text-sm">
      <p className="font-semibold text-gray-800">{d.name}</p>
      <p className="text-gray-500">Ventas: {d.popularity.toFixed(0)}</p>
      <p className="text-gray-500">Margen: {d.margin.toFixed(1)}%</p>
      <p className="text-gray-500">Precio: {formatCurrency(d.salePrice)}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const { currentRestaurant, theme } = useAppStore()
  const { success, error } = useToast()
  const isDark = theme === 'night'

  const [recipes, setRecipes] = useState([])
  const [salesData, setSalesData] = useState([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!currentRestaurant?.id) return
    const u1 = subscribeRecipes(currentRestaurant.id, setRecipes)
    const u2 = subscribeSalesData(currentRestaurant.id, setSalesData)
    return () => { u1(); u2() }
  }, [currentRestaurant?.id])

  // Build BCG data by joining recipes with sales
  const bcgData = recipes
    .filter((r) => r.active !== false)
    .map((recipe) => {
      const sales = salesData.filter(
        (s) => s.recipeName?.toLowerCase() === recipe.name?.toLowerCase()
      )
      const totalQty = sales.reduce((a, s) => a + (s.quantity || 0), 0)
      const totalRevenue = sales.reduce((a, s) => a + (s.revenue || 0), 0)
      const margin = recipe.salePrice > 0
        ? ((recipe.salePrice - (recipe.costPerPortion || 0)) / recipe.salePrice) * 100
        : 0
      return {
        id: recipe.id,
        name: recipe.name,
        popularity: totalQty,
        margin,
        salePrice: recipe.salePrice || 0,
        revenue: totalRevenue,
      }
    })
    .filter((d) => d.popularity > 0 || salesData.length === 0)

  const popularities = bcgData.map((d) => d.popularity)
  const margins = bcgData.map((d) => d.margin)
  const midPopularity = popularities.length ? (Math.max(...popularities) + Math.min(...popularities)) / 2 : 50
  const midMargin = margins.length ? (Math.max(...margins) + Math.min(...margins)) / 2 : 50

  const withQuadrant = bcgData.map((d) => ({
    ...d,
    quadrant: getQuadrant(d.popularity, d.margin, midPopularity, midMargin),
  }))

  const quadrantCounts = {
    star: withQuadrant.filter((d) => d.quadrant === 'star').length,
    cashCow: withQuadrant.filter((d) => d.quadrant === 'cashCow').length,
    questionMark: withQuadrant.filter((d) => d.quadrant === 'questionMark').length,
    dog: withQuadrant.filter((d) => d.quadrant === 'dog').length,
  }

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws)
        await importSalesData(currentRestaurant.id, rows)
        success(t('common.success'), `${rows.length} registros importados`)
      } catch {
        error(t('common.error'))
      } finally {
        setImporting(false)
        e.target.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }, [currentRestaurant?.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('font-display text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {t('analytics.title')}
          </h1>
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {t('analytics.bcgMatrix')}
          </p>
        </div>
        <label>
          <Button variant="outline" disabled={importing} asChild>
            <span className="cursor-pointer">
              <Upload className="h-4 w-4" /> {t('analytics.importSalesData')}
            </span>
          </Button>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </label>
      </div>

      {/* Quadrant summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(QUADRANT_LABELS).map(([key, { icon: Icon, key: labelKey, desc, color }]) => (
          <Card key={key} className={cn(isDark && 'bg-gray-900 border-gray-800')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <p className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>{t(labelKey)}</p>
                  <p className={cn('text-2xl font-bold font-display', isDark ? 'text-white' : 'text-gray-900')}>
                    {quadrantCounts[key]}
                  </p>
                </div>
              </div>
              <p className={cn('text-xs mt-2', isDark ? 'text-gray-600' : 'text-gray-400')}>{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {salesData.length === 0 ? (
        <Card className={cn('text-center py-16', isDark && 'bg-gray-900 border-gray-800')}>
          <CardContent>
            <TrendingUp className={cn('h-12 w-12 mx-auto mb-4', isDark ? 'text-gray-700' : 'text-gray-200')} />
            <h3 className={cn('font-display text-lg font-semibold mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Sin datos de ventas
            </h3>
            <p className={cn('text-sm mb-6 max-w-md mx-auto', isDark ? 'text-gray-600' : 'text-gray-400')}>
              {t('analytics.noData')}
            </p>
            <label>
              <Button asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4" /> {t('analytics.uploadSalesFile')}
                </span>
              </Button>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            </label>
            <p className={cn('text-xs mt-4', isDark ? 'text-gray-700' : 'text-gray-400')}>
              Formato Excel: columnas <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">recipeName, quantity, revenue, period</span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* BCG Scatter Chart */}
          <Card className={cn(isDark && 'bg-gray-900 border-gray-800')}>
            <CardHeader>
              <CardTitle>Matriz BCG — {withQuadrant.length} recetas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Quadrant labels */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2 pl-12 pr-4 pt-4 pb-8 z-10">
                  {[
                    { label: '❓ Interrogantes', color: QUADRANT_COLORS.questionMark },
                    { label: '⭐ Estrellas', color: QUADRANT_COLORS.star },
                    { label: '🐕 Perros', color: QUADRANT_COLORS.dog },
                    { label: '🐄 Vacas lecheras', color: QUADRANT_COLORS.cashCow },
                  ].map(({ label, color }, i) => (
                    <div
                      key={i}
                      className={cn('flex items-start justify-end text-xs font-medium p-2', i < 2 ? 'items-start' : 'items-end')}
                      style={{ color, opacity: 0.5 }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                    <XAxis
                      type="number"
                      dataKey="margin"
                      name="Margen %"
                      domain={[0, 100]}
                      label={{ value: 'Margen (%)', position: 'insideBottom', offset: -10, fill: isDark ? '#6b7280' : '#9ca3af', fontSize: 12 }}
                      tick={{ fill: isDark ? '#6b7280' : '#9ca3af', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="popularity"
                      name="Popularidad"
                      label={{ value: 'Ventas (unidades)', angle: -90, position: 'insideLeft', fill: isDark ? '#6b7280' : '#9ca3af', fontSize: 12 }}
                      tick={{ fill: isDark ? '#6b7280' : '#9ca3af', fontSize: 11 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine x={midMargin} stroke={isDark ? '#4b5563' : '#d1d5db'} strokeDasharray="4 4" />
                    <ReferenceLine y={midPopularity} stroke={isDark ? '#4b5563' : '#d1d5db'} strokeDasharray="4 4" />
                    <Scatter data={withQuadrant} name="Recetas">
                      {withQuadrant.map((entry, i) => (
                        <Cell key={i} fill={QUADRANT_COLORS[entry.quadrant]} fillOpacity={0.8} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recipe list by quadrant */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(QUADRANT_LABELS).map(([key, { icon: Icon, key: labelKey, color }]) => {
              const items = withQuadrant.filter((d) => d.quadrant === key)
              return (
                <Card key={key} className={cn(isDark && 'bg-gray-900 border-gray-800')}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color }} />
                      {t(labelKey)} ({items.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <p className={cn('text-xs', isDark ? 'text-gray-600' : 'text-gray-400')}>Sin recetas en este cuadrante</p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.sort((a, b) => b.popularity - a.popularity).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className={cn('truncate', isDark ? 'text-gray-300' : 'text-gray-700')}>{item.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{item.popularity.toFixed(0)} uds</span>
                              <Badge variant="secondary" style={{ background: color + '20', color }}>{item.margin.toFixed(1)}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
