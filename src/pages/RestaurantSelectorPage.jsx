import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { applyDefaultAccent, getAccentForRestaurant } from '../lib/userRestaurantPrefs'

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

  // En el selector siempre forzamos el color por defecto (no respetamos personalizacion).
  useEffect(() => {
    applyDefaultAccent(theme)
  }, [theme])

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
    // Aplicar accent personalizado del par (usuario, restaurante) — no del doc del restaurante.
    const personalAccent = getAccentForRestaurant(user?.uid, rest.id, theme)
    setAccentColor(personalAccent)
    const s = rest.settings || {}
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

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', color: 'var(--accent)', margin: '0 0 8px' }}>
          Selecciona un restaurante
        </h1>
        <p style={{ color: 'var(--t3)', marginTop: 8, fontSize: '0.9rem' }}>
          Bienvenido, {userProfile?.name || user?.displayName || 'Usuario'}
        </p>
      </div>

      {restaurants.length === 0 && !isMaster ? (
        <p style={{ color: 'var(--t3)', textAlign: 'center', padding: '60px 0' }}>
          No tienes restaurantes asignados.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 160px)', gap: 12, justifyContent: 'center', width: '100%', maxWidth: 700 }}>
          {/* Card "Nuevo restaurante" — solo master, siempre primero */}
          {isMaster && (
            <div
              onClick={() => navigate('/restaurants/new')}
              style={{
                background: 'var(--bg2)',
                border: '2px dashed var(--accent)',
                borderRadius: 12,
                padding: 12,
                cursor: 'pointer',
                transition: 'background 0.25s, border-color 0.25s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 138,
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, var(--bg2))' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg2)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '2rem', fontWeight: 300, color: '#fff', lineHeight: 1, marginTop: -4 }}>+</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.88rem', color: 'var(--accent)', margin: 0, textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>
                Nuevo restaurante
              </h2>
              <span style={{ fontSize: '0.65rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Crear
              </span>
            </div>
          )}
          {restaurants.map((rest) => {
            return (
              <div
                key={rest.id}
                onClick={() => enterRestaurant(rest)}
                style={{ background: 'var(--bg2)', border: '1px solid var(--b1)', borderRadius: 12, padding: 12, cursor: 'pointer', transition: 'border-color 0.25s, box-shadow 0.25s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = isDark ? '0 6px 24px rgba(0,0,0,0.60)' : '0 4px 16px rgba(0,0,0,0.08)' }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--b1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Logo */}
                {rest.logoURL ? (
                  <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', background: 'var(--bg3)', border: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={rest.logoURL} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                  </div>
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{rest.name?.[0] || '?'}</span>
                  </div>
                )}

                {/* Nombre */}
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.88rem', color: 'var(--text)', margin: 0, textAlign: 'center', lineHeight: 1.3 }}>
                  {rest.name}
                </h2>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--b1)', paddingTop: 8, width: '100%', justifyContent: 'center' }}>
                  {[['Recetas', rest.stats?.recipes], ['Sub-rec.', rest.stats?.subrecipes]].map(([label, value]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--t2)' }}>{value ?? '—'}</div>
                      <div style={{ fontSize: '0.55rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                    </div>
                  ))}
                </div>

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
