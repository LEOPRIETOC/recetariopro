import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { toTitleCase } from '../lib/utils'
import { PLANS, PLAN_IDS } from '../lib/plans'

// Misma logica que LicensesTab.addPeriod — manten la estructura de subscription
// identica para que la licencia recien creada aparezca correctamente en la tab.
const addPeriod = (startISO, billing) => {
  if (!startISO) return ''
  const d = new Date(startISO + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  if (billing === 'annual') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

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
    plan: 'emprendedor',
    billing: 'monthly',
    active: true,
  })
  const [errors, setErrors] = useState({})

  const setField = (k) => (e) => {
    const v = e.target.value
    const val = k === 'name' ? v.toUpperCase() : (k === 'address' || k === 'contact') ? toTitleCase(v) : v
    setForm((f) => ({ ...f, [k]: val }))
  }

  const handleCreate = async () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Requerido'
    if (Object.keys(e).length) { setErrors(e); return }
    if (!user?.uid) return

    setSaving(true)
    try {
      const planId = PLAN_IDS.includes(form.plan) ? form.plan : 'emprendedor'
      const billing = form.billing === 'annual' ? 'annual' : 'monthly'
      const startDate = new Date().toISOString().slice(0, 10)
      const endDate = addPeriod(startDate, billing)

      const ref = await addDoc(collection(db, 'restaurants'), {
        name: form.name.trim(),
        address: form.address.trim(),
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        ownerId: user.uid,
        members: { [user.uid]: { role: 'master', joinedAt: serverTimestamp() } },
        subscription: {
          plan: planId,
          active: !!form.active,
          billing,
          startDate,
          endDate,
          updatedAt: new Date().toISOString(),
        },
        settings: { showCosts: true, currency: 'USD', theme: 'day', language: 'es' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      const newRestId = ref.id

      const defaultUnits = [
        { code: 'UND001', abbreviation: 'G',   name: 'Gramo',     equivalence: 1      },
        { code: 'UND002', abbreviation: 'KG',  name: 'Kilogramo', equivalence: 1000   },
        { code: 'UND003', abbreviation: 'ML',  name: 'Mililitro', equivalence: 1      },
        { code: 'UND004', abbreviation: 'LT',  name: 'Litro',     equivalence: 1000   },
        { code: 'UND005', abbreviation: 'UND', name: 'Unidad',    equivalence: 1      },
        { code: 'UND006', abbreviation: 'OZ',  name: 'Onza',      equivalence: 28.35  },
        { code: 'UND007', abbreviation: 'LB',  name: 'Libra',     equivalence: 453.59 },
      ]
      const batch1 = writeBatch(db)
      defaultUnits.forEach(unit => {
        batch1.set(doc(collection(db, 'restaurants', newRestId, 'units')),
          { ...unit, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      })
      await batch1.commit()

      const defaultCategories = ['Abarrotes','Aceites','Bebidas','Carnes','Especias','Fruver','Lácteos','Licores','Mariscos','Salsas']
      const batch2 = writeBatch(db)
      defaultCategories.forEach((name, i) => {
        batch2.set(doc(collection(db, 'restaurants', newRestId, 'mp_categories')),
          { code: `CAT${String(i + 1).padStart(3, '0')}`, name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      })
      await batch2.commit()

      navigate('/restaurants')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const bg   = isDark ? '#0a0e0b' : '#f9fafb'
  const card = isDark ? '#111712' : '#ffffff'
  const bdr  = isDark ? '#1f2937' : '#e5e7eb'
  const txt  = isDark ? '#f0ece4' : '#111827'
  const lbl  = isDark ? '#9ca3af' : '#374151'
  const inp  = { width: '100%', background: isDark ? '#1f2937' : '#fff', border: `1px solid ${bdr}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: '0.88rem', color: txt, outline: 'none', boxSizing: 'border-box' }
  const focus = (e) => { e.currentTarget.style.borderColor = 'var(--accent)' }
  const blur  = (e, k) => { e.currentTarget.style.borderColor = errors[k] ? '#ef4444' : bdr }
  const labelCss = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: lbl, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const sectionCss = { fontSize: '0.68rem', fontWeight: 700, color: isDark ? '#4b5563' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }

  if (!isMaster) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: bg, fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Acceso restringido — solo para Master</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '40px 20px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button
            onClick={() => navigate('/restaurants')}
            style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '8px 14px', color: lbl, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
          >
            ← Volver
          </button>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: txt, margin: 0 }}>
            Nuevo restaurante
          </h1>
        </div>

        {/* Card — Info general */}
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ height: 4, background: 'var(--accent)' }} />
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={sectionCss}>Información general</p>

            {/* Nombre */}
            <div>
              <label style={labelCss}>Nombre del restaurante <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={setField('name')}
                placeholder="El Fogón de María"
                style={{ ...inp, borderColor: errors.name ? '#ef4444' : bdr }}
                onFocus={focus}
                onBlur={(e) => blur(e, 'name')}
              />
              {errors.name && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.name}</p>}
            </div>

            {/* Ciudad + Teléfono */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelCss}>Ciudad</label>
                <input type="text" value={form.city} onChange={setField('city')} placeholder="Bogotá"
                  style={{ ...inp }} onFocus={focus} onBlur={(e) => blur(e, '')} />
              </div>
              <div>
                <label style={labelCss}>Teléfono</label>
                <input type="text" value={form.phone} onChange={setField('phone')} placeholder="+57 300 000 0000"
                  style={{ ...inp }} onFocus={focus} onBlur={(e) => blur(e, '')} />
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label style={labelCss}>Dirección</label>
              <input type="text" value={form.address} onChange={setField('address')} placeholder="Calle 123 #45-67"
                style={{ ...inp }} onFocus={focus} onBlur={(e) => blur(e, '')} />
            </div>

            {/* Contacto */}
            <div>
              <label style={labelCss}>Persona de contacto</label>
              <input type="text" value={form.contact} onChange={setField('contact')} placeholder="Juan Pérez"
                style={{ ...inp }} onFocus={focus} onBlur={(e) => blur(e, '')} />
            </div>
          </div>
        </div>

        {/* Card — Plan y suscripcion */}
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ height: 4, background: 'var(--accent)' }} />
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={sectionCss}>Plan y suscripción</p>

            {/* Selector de plan */}
            <div>
              <label style={labelCss}>Plan</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {PLAN_IDS.map((pid) => {
                  const p = PLANS[pid]
                  const selected = form.plan === pid
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, plan: pid }))}
                      style={{
                        background: selected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : (isDark ? '#1f2937' : '#fff'),
                        border: `2px solid ${selected ? 'var(--accent)' : bdr}`,
                        borderRadius: 10,
                        padding: '12px 10px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: txt, marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontSize: '0.7rem', color: lbl, lineHeight: 1.4 }}>
                        {p.maxRecipes} recetas<br />{p.maxUsers} usuarios
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Periodicidad */}
            <div>
              <label style={labelCss}>Periodicidad</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { id: 'monthly', label: 'Mensual', sub: '+1 mes desde hoy' },
                  { id: 'annual',  label: 'Anual',   sub: '+1 año desde hoy' },
                ].map((opt) => {
                  const selected = form.billing === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, billing: opt.id }))}
                      style={{
                        background: selected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : (isDark ? '#1f2937' : '#fff'),
                        border: `2px solid ${selected ? 'var(--accent)' : bdr}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                    >
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: txt, marginBottom: 2 }}>{opt.label}</div>
                      <div style={{ fontSize: '0.7rem', color: lbl }}>{opt.sub}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Activa */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.85rem', color: txt, fontWeight: 600 }}>Licencia activa al crear</span>
            </label>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => navigate('/restaurants')}
            style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '10px 20px', color: lbl, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem' }}
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
