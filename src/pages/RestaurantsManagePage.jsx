import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'

export default function RestaurantsManagePage() {
  const navigate = useNavigate()
  const { user, theme } = useAppStore()
  const { isMaster } = useAuth()
  const isDark = theme === 'night'

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    subPlan: 'trial',
    subStatus: 'trial',
    subStart: new Date().toISOString().slice(0, 10),
    subEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    maxUsers: 3,
    maxRecipes: 30,
  })
  const [errors, setErrors] = useState({})

  const css = isDark
    ? { '--bg': '#030712', '--bg2': '#111827', '--bg3': '#1f2937', '--b1': '#1f2937', '--b2': '#374151', '--text': '#f9fafb', '--t2': '#d1d5db', '--t3': '#6b7280' }
    : { '--bg': '#f9fafb', '--bg2': '#ffffff', '--bg3': '#f3f4f6', '--b1': '#e5e7eb', '--b2': '#d1d5db', '--text': '#111827', '--t2': '#374151', '--t3': '#9ca3af' }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Requerido'
    if (!form.city.trim()) e.city = 'Requerido'
    return e
  }

  const handleCreate = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    if (!user?.uid) return

    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'restaurants'), {
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        ownerId: user.uid,
        members: {
          [user.uid]: { role: 'master', joinedAt: serverTimestamp() },
        },
        subscription: {
          plan: form.subPlan,
          status: form.subStatus,
          start: form.subStart,
          end: form.subEnd,
          maxUsers: Number(form.maxUsers),
          maxRecipes: Number(form.maxRecipes),
        },
        settings: {
          showCosts: true,
          currency: 'USD',
          theme: 'day',
          language: 'es',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      navigate('/restaurants')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isMaster) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: isDark ? '#030712' : '#f9fafb', color: isDark ? '#f9fafb' : '#111827', fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Acceso restringido — solo para Master</p>
      </div>
    )
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg3)',
    border: `1px solid var(--b1)`,
    borderRadius: 8,
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    color: 'var(--text)',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--t2)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const Field = ({ label, k, type = 'text', placeholder = '' }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={form[k]}
        onChange={set(k)}
        placeholder={placeholder}
        style={{ ...inputStyle, borderColor: errors[k] ? '#ef4444' : 'var(--b1)' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = errors[k] ? '#ef4444' : 'var(--b1)' }}
      />
      {errors[k] && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors[k]}</p>}
    </div>
  )

  const Select = ({ label, k, options }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        value={form[k]}
        onChange={set(k)}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px', fontFamily: "'DM Sans', sans-serif", ...css }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button
            onClick={() => navigate('/restaurants')}
            style={{ background: 'none', border: `1px solid var(--b1)`, borderRadius: 8, padding: '8px 14px', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
          >
            ← Volver
          </button>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: 'var(--text)', margin: 0 }}>
            Nuevo restaurante
          </h1>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg2)', border: `1px solid var(--b1)`, borderRadius: 16, padding: 28 }}>

          {/* Info section */}
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            Información general
          </p>
          <div className="row g-3">
            <div className="col-12"><Field label="Nombre *" k="name" placeholder="El Fogón de María" /></div>
            <div className="col-md-6"><Field label="Ciudad *" k="city" placeholder="Bogotá" /></div>
            <div className="col-md-6"><Field label="Teléfono" k="phone" placeholder="+57 300 000 0000" /></div>
            <div className="col-12"><Field label="Dirección" k="address" placeholder="Calle 123 #45-67" /></div>
            <div className="col-12"><Field label="Email" k="email" type="email" placeholder="contacto@restaurante.com" /></div>
          </div>

          {/* Subscription section */}
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '28px 0 16px' }}>
            Suscripción
          </p>
          <div className="row g-3">
            <div className="col-md-6">
              <Select label="Plan" k="subPlan" options={[['trial', 'Prueba (30 días)'], ['monthly', 'Mensual'], ['annual', 'Anual']]} />
            </div>
            <div className="col-md-6">
              <Select label="Estado" k="subStatus" options={[['trial', 'Prueba'], ['active', 'Activa'], ['expired', 'Vencida']]} />
            </div>
            <div className="col-md-6"><Field label="Fecha inicio" k="subStart" type="date" /></div>
            <div className="col-md-6"><Field label="Fecha vencimiento" k="subEnd" type="date" /></div>
            <div className="col-md-6">
              <label style={labelStyle}>Máx. usuarios</label>
              <input type="number" min={1} max={100} value={form.maxUsers} onChange={set('maxUsers')} style={inputStyle} />
            </div>
            <div className="col-md-6">
              <label style={labelStyle}>Máx. recetas</label>
              <input type="number" min={1} max={9999} value={form.maxRecipes} onChange={set('maxRecipes')} style={inputStyle} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 28, justifyContent: 'flex-end' }}>
            <button
              onClick={() => navigate('/restaurants')}
              style={{ background: 'none', border: `1px solid var(--b1)`, borderRadius: 8, padding: '10px 20px', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Creando...' : 'Crear restaurante'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
