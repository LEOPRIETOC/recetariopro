import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'

export default function RestaurantSelectorPage() {
  const navigate = useNavigate()
  const { user, userProfile, setCurrentRestaurant, setAccentColor, setTheme, setLanguage, setShowCosts, theme } = useAppStore()
  const { i18n } = useTranslation()
  const { isMaster } = useAuth()
  const isDark = theme === 'night'

  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)

  // CSS variables scoped to this page
  const css = isDark
    ? { '--bg': '#0a0e0b', '--bg2': '#111712', '--bg3': '#181f19', '--b1': 'rgba(255,255,255,0.06)', '--b2': 'rgba(255,255,255,0.10)', '--text': '#f0ece4', '--t2': '#8a8578', '--t3': '#4a4840', '--green': '#4a9e6e' }
    : { '--bg': '#f9fafb', '--bg2': '#ffffff', '--bg3': '#f3f4f6', '--b1': '#e5e7eb', '--b2': '#d1d5db', '--text': '#111827', '--t2': '#374151', '--t3': '#9ca3af', '--green': '#10b981' }

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
            const [allRecipesSnap, materiasSnap] = await Promise.all([
              getDocs(collection(db, 'restaurants', rest.id, 'recipes')),
              getDocs(collection(db, 'restaurants', rest.id, 'materias_primas')),
            ])
            // Split in client — imported recipes may only have isSubRecipe, not type field
            const all = allRecipesSnap.docs.map(d => d.data())
            const isSub = (r) => r.isSubRecipe === true || r.type === 'subrecipe'
            const recipesCount = all.filter(r => !isSub(r) && r.active !== false).length
            const subrecipesCount = all.filter(r => isSub(r)).length
            return {
              ...rest,
              stats: {
                recipes: recipesCount,
                subrecipes: subrecipesCount,
                materias: materiasSnap.size,
                users: Object.values(rest.members || {}).filter(m => m?.role && m.role !== 'master').length,
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
    const s = rest.settings || {}
    if (s.theme) setTheme(s.theme)
    if (s.language) { setLanguage(s.language); i18n.changeLanguage(s.language) }
    if (typeof s.showCosts === 'boolean') setShowCosts(s.showCosts)
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'DM Sans', sans-serif", position: 'relative', ...css }}>

      {isMaster && (
        <button
          onClick={() => navigate('/restaurants/new')}
          style={{ position: 'absolute', top: 20, right: 20, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity 0.2s' }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          + Nuevo restaurante
        </button>
      )}

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, width: '100%', maxWidth: 900 }}>
          {restaurants.map((rest) => {
            return (
              <div
                key={rest.id}
                onClick={() => enterRestaurant(rest)}
                style={{ background: 'var(--bg2)', border: '1px solid var(--b1)', borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'border-color 0.25s, box-shadow 0.25s', display: 'flex', flexDirection: 'column', gap: 12 }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = isDark ? '0 8px 40px rgba(0,0,0,0.70)' : '0 4px 24px rgba(0,0,0,0.10)' }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--b1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Protagonista: logo + nombre */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0 4px' }}>
                  {rest.logoURL ? (
                    <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', background: 'var(--bg3)', border: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img src={rest.logoURL} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
                    </div>
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{rest.name?.[0] || '?'}</span>
                    </div>
                  )}
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', color: 'var(--text)', margin: 0, textAlign: 'center', lineHeight: 1.3 }}>
                    {rest.name}
                  </h2>
                  {(rest.city || rest.settings?.city) && (
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--t3)' }}>📍 {rest.city || rest.settings?.city}</p>
                  )}
                </div>

                {/* Stats — discretas */}
                <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--b1)', paddingTop: 10 }}>
                  {[
                    ['Recetas', rest.stats?.recipes],
                    ['Sub-rec.', rest.stats?.subrecipes],
                    ['Mat.P.', rest.stats?.materias],
                    ['Users', rest.stats?.users],
                  ].map(([label, value]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--t2)' }}>{value ?? '—'}</div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    </div>
                  ))}
                </div>

                <button
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: '0.85rem', transition: 'opacity 0.2s' }}
                  onMouseOver={(e) => { e.stopPropagation(); e.currentTarget.style.opacity = '0.85' }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = '1' }}
                  onClick={(e) => { e.stopPropagation(); enterRestaurant(rest) }}
                >
                  Entrar →
                </button>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
