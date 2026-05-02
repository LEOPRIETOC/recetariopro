import { usePlan } from '../../hooks/usePlan'
import { useAppStore } from '../../store/useAppStore'

export function LicenseBanner() {
  const { active, sub } = usePlan()
  const currentRestaurant = useAppStore((s) => s.currentRestaurant)

  if (!currentRestaurant) return null
  if (active) return null

  const reason = !sub
    ? 'Sin licencia asignada'
    : sub.active === false
      ? 'Licencia desactivada'
      : sub.endDate && new Date(sub.endDate) < new Date()
        ? 'Licencia vencida'
        : sub.startDate && new Date(sub.startDate) > new Date()
          ? 'Licencia aún no vigente'
          : 'Licencia inactiva'

  return (
    <div role="alert" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 999997,
      background: '#dc2626',
      color: '#fff',
      padding: '8px 16px',
      textAlign: 'center',
      fontSize: '0.85rem',
      fontWeight: 600,
      fontFamily: 'sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      ⚠️ {reason} — contacta al administrador para reactivar tu plan.
    </div>
  )
}
