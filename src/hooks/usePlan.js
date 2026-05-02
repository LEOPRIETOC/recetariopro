import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getPlan, isLicenseActive } from '../lib/plans'

/**
 * Devuelve el plan actual del restaurante seleccionado y helpers para gating.
 * Reactivo a cambios de currentRestaurant.subscription.
 */
export function usePlan() {
  const currentRestaurant = useAppStore((s) => s.currentRestaurant)

  return useMemo(() => {
    const sub = currentRestaurant?.subscription
    const plan = getPlan(sub)
    const active = isLicenseActive(sub)
    return {
      plan,
      sub,
      active,
      maxRecipes: plan.maxRecipes,
      maxUsers: plan.maxUsers,
      has: (feature) => active && !!plan.features?.[feature],
    }
  }, [currentRestaurant?.subscription])
}
