import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'

export default function RestaurantSelectorPage() {
  const navigate = useNavigate()
  const { user, userProfile, setCurrentRestaurant, setAccentColor, theme } = useAppStore()
  const { isMaster } = useAuth()
  const isDark = theme === 'night'

  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid || userProfile === undefined) return
    loadRestaurants()
  }, [user?.uid, userProfile?.role])

  const loadRestaurants = async () => {
    setLoading(true)
    try {
      let restDocs = []

      if (isMaster) {
        const snap = await getDocs(collection(db, 'restaurants'))
        restDocs = snap.docs
      } else {
        try {
          const roles = ['admin', 'superadmin', 'master', 'chef', 'usuario']
          const q = query(
            collection(db, 'restaurants'),
            where(`members.${user.uid}.role`, 'in', roles)
          )
          const snap = await getDocs(q)
          restDocs = snap.docs
        } catch {
          const q2 = query(collection(db, 'restaurants'), where('ownerId', '==', user.uid))
          const snap2 = await getDocs(q2)
          restDocs = snap2.docs
        }
      }

      if (restDocs.length === 1) {
        const restData = { id: restDocs[0].id, ...restDocs[0].data() }
        enterRestaurant(restData)
        return
      }

      const enriched = await Promise.all(
        restDocs.map(async (d) => {
          const data = d.data()
          let recipesCount = 0
          let materiasCount = 0
          try {
            const [recipes, materias] = await Promise.all([
              getDocs(collection(db, 'restaurants', d.id, 'recipes')),
              getDocs(collection(db, 'restaurants', d.id, 'materias_primas')),
            ])
            recipesCount = recipes.size
            materiasCount = materias.size
          } catch { /* silent */ }
          return {
            id: d.id,
            ...data,
            recipesCount,
            usersCount: Object.keys(data.members || {}).length,
            materiasCount,
          }
        })
      )

      setRestaurants(enriched)
    } finally {
      setLoading(false)
    }
  }

  const enterRestaurant = (rest) => {
    setCurrentRestaurant(rest)
    if (rest.accentColor) setAccentColor(rest.accentColor)
    navigate('/')
  }

  const formatDate = (val) => {
    if (!val) return '—'
    if (val?.toDate) return val.toDate().toLocaleDateString('es')
    if (typeof val === 'string') return val
    return '—'
  }

  const subStatusLabel = (status) => {
    const map = { active: 'Activo', trial: 'Trial', expired: 'Vencido', cancelled: 'Cancelado' }
    return map[status] || status || '—'
  }

  const bg      = isDark ? '#030712' : '#f9fafb'
  const card    = isDark ? '#111827' : '#ffffff'
  const border  = isDark ? '#1f2937' : '#e5e7eb'
  const text    = isDark ? '#f9fafb' : '#111827'
  const muted   = isDark ? '#6b7280' : '#9ca3af'

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <img src="/favicon.svg" alt="inom" style={{ width: 48, height: 48, margin: '0 auto 12px' }} />
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: 'var(--accent)', margin: '0 0 8px' }}>
          Selecciona un restaurante
        </h1>
        <p style={{ color: muted, fontSize: '0.9rem' }}>
          Bienvenido, {userProfile?.name || user?.displayName || 'Usuario'}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div className="h-10 w-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : restaurants.length === 0 ? (
        <div style={{ color: muted, textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: '1rem' }}>No tienes restaurantes asignados.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, width: '100%', maxWidth: 1200 }}>
          {restaurants.map((rest) => {
            const sub = rest.subscription || {}
            const statusKey = sub.status || 'active'
            const statusColors = {
              active:    { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
              trial:     { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
              expired:   { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
              cancelled: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
            }
            const sc = statusColors[statusKey] || statusColors.active

            return (
              <div
                key={rest.id}
                onClick={() => enterRestaurant(rest)}
                style={{
                  background: card,
                  border: `1px solid ${border}`,
                  borderRadius: 16,
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = border
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: text, margin: 0, lineHeight: 1.3 }}>
                    {rest.name}
                  </h2>
                  <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {subStatusLabel(statusKey)}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: isDark ? '#1f2937' : '#f9fafb', borderRadius: 10, padding: 12 }}>
                  {[
                    { value: rest.recipesCount, label: 'Recetas' },
                    { value: rest.usersCount, label: 'Usuarios' },
                    { value: rest.materiasCount, label: 'Mat. Primas' },
                  ].map(({ value, label }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>{value}</span>
                      <span style={{ fontSize: '0.7rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Footer info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: muted }}>
                  <span>{rest.settings?.city || rest.city || ''}</span>
                  <span>Plan: {sub.plan || '—'}</span>
                  <span>Vence: {formatDate(sub.endDate || sub.end)}</span>
                </div>

                {/* Enter button */}
                <button
                  style={{
                    background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 16px', fontFamily: 'inherit',
                    fontWeight: 600, cursor: 'pointer', width: '100%', fontSize: '0.9rem',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => { e.stopPropagation(); e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                  onClick={(e) => { e.stopPropagation(); enterRestaurant(rest) }}
                >
                  Entrar →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Master: new restaurant button */}
      {isMaster && !loading && (
        <button
          onClick={() => navigate('/restaurants/new')}
          style={{
            marginTop: 32,
            background: 'transparent',
            border: `2px dashed ${border}`,
            borderRadius: 12,
            padding: '14px 32px',
            color: muted,
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted }}
        >
          + Nuevo restaurante
        </button>
      )}
    </div>
  )
}
