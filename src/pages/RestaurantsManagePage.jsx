import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore'
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
    address: '',
    contact: '',
    phone: '',
    city: '',
    subPlan: 'trial',
    subStatus: 'trial',
    subStart: new Date().toISOString().slice(0, 10),
    subEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    maxUsers: 3,
    maxRecipes: 30,
  })
  const [errors, setErrors] = useState({})

  const css = isDark
    ? { '--bg': '#0a0e0b', '--bg2': '#111712', '--bg3': '#181f19', '--b1': 'rgba(255,255,255,0.06)', '--b2': 'rgba(255,255,255,0.10)', '--text': '#f0ece4', '--t2': '#8a8578', '--t3': '#4a4840' }
    : { '--bg': '#f9fafb', '--bg2': '#ffffff', '--bg3': '#f3f4f6', '--b1': '#e5e7eb', '--b2': '#d1d5db', '--text': '#111827', '--t2': '#374151', '--t3': '#9ca3af' }

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Requerido'
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
        address: form.address.trim(),
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
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
      const newRestId = ref.id

      // Precargar unidades por defecto
      const defaultUnits = [
        { code: 'UND001', abbreviation: 'G',   name: 'Gramo',     equivalence: 1       },
        { code: 'UND002', abbreviation: 'KG',  name: 'Kilogramo', equivalence: 1000    },
        { code: 'UND003', abbreviation: 'ML',  name: 'Mililitro', equivalence: 1       },
        { code: 'UND004', abbreviation: 'LT',  name: 'Litro',     equivalence: 1000    },
        { code: 'UND005', abbreviation: 'UND', name: 'Unidad',    equivalence: 1       },
        { code: 'UND006', abbreviation: 'OZ',  name: 'Onza',      equivalence: 28.35   },
        { code: 'UND007', abbreviation: 'LB',  name: 'Libra',     equivalence: 453.59  },
      ]
      const batch1 = writeBatch(db)
      defaultUnits.forEach(unit => {
        const uRef = doc(collection(db, 'restaurants', newRestId, 'units'))
        batch1.set(uRef, { ...unit, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      })
      await batch1.commit()

      // Precargar categorías de materias primas
      const defaultCategories = [
        'Abarrotes', 'Aceites', 'Bebidas', 'Carnes', 'Especias',
        'Fruver', 'Lácteos', 'Licores', 'Mariscos', 'Salsas',
      ]
      const batch2 = writeBatch(db)
      defaultCategories.forEach((name, index) => {
        const cRef = doc(collection(db, 'restaurants', newRestId, 'mp_categories'))
        batch2.set(cRef, {
          code: `CAT${String(index + 1).padStart(3, '0')}`,
          name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
      await batch2.commit()

      navigate('/restaurants')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Solo master puede acceder
  if (!isMaster) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: isDark ? '#030712' : '#f9fafb', color: isDark ? '#f9fafb' : '#111827', fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Acceso restringido — solo para Master</p>
      </div>
    )
  }

  const inputStyle = {
    width: '100%',
    background: isDark ? '#1f2937' : '#fff',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: 8,
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    color: isDark ? '#f9fafb' : '#111827',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: isDark ? '#9ca3af' : '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const sectionTitle = {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: isDark ? '#4b5563' : '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 16,
  }

  const Field = ({ label, k, type = 'text', placeholder = '', required = false }) => (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      <input
        type={type}
        value={form[k]}
        onChange={setField(k)}
        placeholder={placeholder}
        style={{ ...inputStyle, borderColor: errors[k] ? '#ef4444' : (isDark ? '#374151' : '#e5e7eb') }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = errors[k] ? '#ef4444' : (isDark ? '#374151' : '#e5e7eb') }}
      />
      {errors[k] && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors[k]}</p>}
    </div>
  )

  const SelectField = ({ label, k, options }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        value={form[k]}
        onChange={setField(k)}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px', fontFamily: "'DM Sans', sans-serif", ...css }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button
            onClick={() => navigate('/restaurants')}
            style={{ background: 'none', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 8, padding: '8px 14px', color: isDark ? '#6b7280' : '#9ca3af', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
          >
            ← Volver
          </button>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: isDark ? '#f0ece4' : '#111827', margin: 0 }}>
            Nuevo restaurante
          </h1>
        </div>

        {/* Card — Info general */}
        <div style={{ background: isDark ? '#111712' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ height: 4, background: 'var(--accent)' }} />
          <div style={{ padding: '24px 28px' }}>
            <p style={sectionTitle}>Información general</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Nombre del restaurante" k="name" placeholder="El Fogón de María" required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Ciudad" k="city" placeholder="Bogotá" />
                <Field label="Teléfono" k="phone" placeholder="+57 300 000 0000" />
              </div>
              <Field label="Dirección" k="address" placeholder="Calle 123 #45-67" />
              <Field label="Persona de contacto" k="contact" placeholder="Juan Pérez" />
            </div>
          </div>
        </div>

        {/* Card — Suscripción */}
        <div style={{ background: isDark ? '#111712' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`, borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ height: 4, background: 'var(--accent)' }} />
          <div style={{ padding: '24px 28px' }}>
            <p style={sectionTitle}>Suscripción</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <SelectField label="Plan" k="subPlan" options={[['trial', 'Prueba (30 días)'], ['monthly', 'Mensual'], ['annual', 'Anual']]} />
                <SelectField label="Estado" k="subStatus" options={[['trial', 'Prueba'], ['active', 'Activa'], ['expired', 'Vencida']]} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Fecha inicio" k="subStart" type="date" />
                <Field label="Fecha vencimiento" k="subEnd" type="date" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Máx. usuarios</label>
                  <input
                    type="number" min={1} max={100} value={form.maxUsers}
                    onChange={setField('maxUsers')}
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? '#374151' : '#e5e7eb' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Máx. recetas</label>
                  <input
                    type="number" min={1} max={9999} value={form.maxRecipes}
                    onChange={setField('maxRecipes')}
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? '#374151' : '#e5e7eb' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/restaurants')}
            style={{ background: 'none', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 8, padding: '10px 20px', color: isDark ? '#6b7280' : '#374151', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Creando...' : 'Crear restaurante'}
          </button>
        </div>

      </div>
    </div>
  )
}
