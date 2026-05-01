// Catalogo de planes / licencias de RecetarioPro.
// Mantiene los limites y features de cada plan en un solo lugar.

export const PLANS = {
  emprendedor: {
    id: 'emprendedor',
    label: 'Emprendedor',
    color: '#10b981',
    maxRecipes: 50,
    maxUsers: 3,
    features: {
      print: true,
      importExcel: true,
      exportExcel: true,
      manualCost: true,
      subrecipes: true,
      autoCost: false,
      photos: false,
      videos: false,
      bcg: false,
      topSells: false,
    },
  },
  basico: {
    id: 'basico',
    label: 'Básico',
    color: '#3b82f6',
    maxRecipes: 120,
    maxUsers: 5,
    features: {
      print: true,
      importExcel: true,
      exportExcel: true,
      manualCost: true,
      subrecipes: true,
      autoCost: true,
      photos: true,
      videos: false,
      bcg: false,
      topSells: false,
    },
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    color: '#d97706',
    maxRecipes: 500,
    maxUsers: 20,
    features: {
      print: true,
      importExcel: true,
      exportExcel: true,
      manualCost: true,
      subrecipes: true,
      autoCost: true,
      photos: true,
      videos: true,
      bcg: true,
      topSells: true,
    },
  },
}

export const FEATURE_LABELS = {
  print: 'Impresión PDF',
  importExcel: 'Importar desde Excel',
  exportExcel: 'Exportar a Excel',
  manualCost: 'Costo manual de recetas',
  subrecipes: 'Sub-recetas',
  autoCost: 'Costo automático',
  photos: 'Fotos de recetas',
  videos: 'Videos de recetas',
  bcg: 'Analítica BCG',
  topSells: 'Top sells por categoría',
}

export const PLAN_IDS = ['emprendedor', 'basico', 'pro']

// Devuelve true si la subscription esta activa Y dentro del rango de fechas.
export function isLicenseActive(subscription) {
  if (!subscription) return false
  if (subscription.active === false) return false
  const now = Date.now()
  const start = subscription.startDate ? new Date(subscription.startDate).getTime() : null
  const end = subscription.endDate ? new Date(subscription.endDate).getTime() : null
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

export function getPlan(subscription) {
  const id = subscription?.plan || 'emprendedor'
  return PLANS[id] || PLANS.emprendedor
}
