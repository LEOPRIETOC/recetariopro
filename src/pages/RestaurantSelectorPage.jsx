import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'

export default function RestaurantSelectorPage() {
  const navigate = useNavigate()
  const { user, userProfile, setCurrentRestaurant, setAccentColor, theme } = useAppStore()
  const { isMaster } = useAuth()
  const isDark = theme === 'night'

  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  // CSS variables scoped to this page
  const css = isDark
    ? { '--bg': '#0a0e0b', '--bg2': '#111712', '--bg3': '#181f19', '--b1': 'rgba(255,255,255,0.06)', '--b2': 'rgba(255,255,255,0.10)', '--text': '#f0ece4', '--t2': '#8a8578', '--t3': '#4a4840', '--green': '#4a9e6e', '--gold': '#c9a84c' }
    : { '--bg': '#f9fafb', '--bg2': '#ffffff', '--bg3': '#f3f4f6', '--b1': '#e5e7eb', '--b2': '#d1d5db', '--text': '#111827', '--t2': '#374151', '--t3': '#9ca3af', '--green': '#10b981', '--gold': 'var(--accent)' }

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

      const rests = restDocs.map((d) => ({ id: d.id, ...d.data() }))

      // Single restaurant — enter directly
      if (rests.length === 1) {
        enterRestaurant(rests[0])
        return
      }

      // Load real counts for each restaurant
      const withCounts = await Promise.all(
        rests.map(async (rest) => {
          try {
            const [recipesSnap, subrecipesSnap, materiasSnap] = await Promise.all([
              getDocs(query(collection(db, 'restaurants', rest.id, 'recipes'), where('type', '==', 'recipe'))),
              getDocs(query(collection(db, 'restaurants', rest.id, 'recipes'), where('type', '==', 'subrecipe'))),
              getDocs(collection(db, 'restaurants', rest.id, 'materias_primas')),
            ])
            // Filter inactive in client — imported recipes may lack the active field
            const activeRecipes = recipesSnap.docs.filter(d => d.data().active !== false)
            return {
              ...rest,
              stats: {
                recipes: activeRecipes.length,
                subrecipes: subrecipesSnap.size,
                materias: materiasSnap.size,
                users: Object.keys(rest.members || {}).length,
              },
            }
          } catch {
            return { ...rest, stats: { recipes: '—', subrecipes: '—', materias: '—', users: '—' } }
          }
        })
      )

      setRestaurants(withCounts)
    } catch (err) {
      console.error('Error loading restaurants:', err)
    }
    setLoading(false)
  }

  const enterRestaurant = (rest) => {
    setCurrentRestaurant(rest)
    if (rest.accentColor) setAccentColor(rest.accentColor)
    navigate('/')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: isDark ? '#0a0e0b' : '#f9fafb', color: isDark ? '#f0ece4' : '#111827', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: '0.9rem' }}>Cargando restaurantes...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'DM Sans', sans-serif", ...css }}>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', color: 'var(--accent)', margin: '0 0 8px' }}>
          Selecciona un restaurante
        </h1>
        <p style={{ color: 'var(--t3)', marginTop: 8, fontSize: '0.9rem' }}>
          Bienvenido, {userProfile?.name || user?.displayName || 'Usuario'}
        </p>
      </div>

      {restaurants.length === 0 ? (
        <p style={{ color: 'var(--t3)', textAlign: 'center', padding: '60px 0' }}>
          No tienes restaurantes asignados.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, width: '100%', maxWidth: 1100 }}>
          {restaurants.map((rest) => {
            const sub = rest.subscription || {}
            const status = sub.status || 'trial'
            const statusStyle = status === 'active'
              ? { background: 'rgba(16,185,129,0.15)', color: 'var(--green)' }
              : status === 'trial'
              ? { background: 'rgba(245,158,11,0.15)', color: 'var(--gold)' }
              : { background: 'rgba(239,68,68,0.12)', color: '#ef4444' }

            return (
              <div
                key={rest.id}
                onClick={() => enterRestaurant(rest)}
                style={{ background: 'var(--bg2)', border: '1px solid var(--b1)', borderRadius: 16, padding: 24, cursor: 'pointer', transition: 'border-color 0.25s, box-shadow 0.25s', display: 'flex', flexDirection: 'column', gap: 16 }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(201,168,76,0.55)' : 'var(--accent)'; e.currentTarget.style.boxShadow = isDark ? '0 8px 40px rgba(0,0,0,0.70)' : '0 4px 24px rgba(0,0,0,0.10)' }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--b1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: 'var(--text)', margin: 0 }}>
                    {rest.name}
                  </h2>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, ...statusStyle }}>
                    {status}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
                  {[
                    ['Recetas',     rest.stats?.recipes,    'var(--accent)'],
                    ['Sub-recetas', rest.stats?.subrecipes, isDark ? '#60a5fa' : '#3b82f6'],
                    ['Mat. Primas', rest.stats?.materias,   isDark ? '#34d399' : '#10b981'],
                    ['Usuarios',    rest.stats?.users,      'var(--t2)'],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value ?? '—'}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--t3)' }}>
                  <span>📍 {rest.city || rest.settings?.city || '—'}</span>
                  <span>Plan: {sub.plan || '—'}</span>
                </div>

                <button
                  style={{ background: isDark ? '#c9a84c' : 'var(--accent)', color: isDark ? '#0a0e0b' : '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '0.9rem', transition: 'background 0.2s', letterSpacing: '0.02em' }}
                  onMouseOver={(e) => { e.stopPropagation(); e.currentTarget.style.background = isDark ? '#e8c96a' : 'color-mix(in srgb, var(--accent) 85%, black)' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = isDark ? '#c9a84c' : 'var(--accent)' }}
                  onClick={(e) => { e.stopPropagation(); enterRestaurant(rest) }}
                >
                  Entrar →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {isMaster && (
        <button
          onClick={() => navigate('/restaurants/new')}
          style={{ marginTop: 30, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '14px 32px', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85' }}
          onMouseOut={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          + Nuevo restaurante
        </button>
      )}
    </div>
  )
}
