import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { usePlan } from '../hooks/usePlan'
import { createUserWithRole, updateUserRole, deactivateUser, sendUserPasswordReset, generateTempPassword, validateStrongPassword, PASSWORD_POLICY } from '../services/auth'
import { toTitleCase } from '../lib/utils'
import { useToast } from '../components/ui/toast'
import { UserPlus, Pencil, MailCheck, Power, X, Eye, EyeOff, RefreshCw, Copy, Check, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

// ── Role badge colors ──────────────────────────────────────────────────────────
const ROLE_BADGE = {
  master:  { bg: '#111111', color: '#c9a84c', border: '#c9a84c44' },
  admin:   { bg: '#0a2e1a', color: '#4ade80', border: '#4ade8044' },
  usuario: { bg: '#1f2937', color: '#9ca3af', border: '#9ca3af33' },
}

function RoleBadge({ role }) {
  const s = ROLE_BADGE[role] || ROLE_BADGE.usuario
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 20, padding: '2px 10px',
      fontSize: '0.7rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      {role}
    </span>
  )
}

// ── Role options per creator (each role can create same level or below) ───────
function rolesFor(creator) {
  if (creator.isMaster) return ['master', 'admin', 'usuario']
  if (creator.isAdmin)  return ['admin', 'usuario']
  return []
}

// ── Modal wrapper ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.65)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--bg2, #fff)', border: '1px solid var(--b1, #e5e7eb)',
        borderRadius: 16, padding: 28, width: 'min(460px, 95vw)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: 'var(--text, #111)', margin: 0 }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2, #6b7280)', padding: 4 }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--t2, #6b7280)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg3, #f3f4f6)',
  border: '1px solid var(--b2, #d1d5db)', borderRadius: 8,
  padding: '9px 12px', fontFamily: 'inherit', fontSize: '0.88rem',
  color: 'var(--text, #111)', outline: 'none', boxSizing: 'border-box',
}

// ── Created credentials modal (shown after successful creation) ────────────────
function CreatedCredentialsModal({ name, email, password, onClose }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    const text = `Usuario: ${email}\nContraseña temporal: ${password}\n\nDeberás cambiarla al iniciar sesión.`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }
  return (
    <Modal title={`Usuario ${name} creado`} onClose={onClose}>
      <p style={{ fontSize: '0.85rem', color: 'var(--t2, #6b7280)', marginBottom: 14 }}>
        Comparte estos datos con el usuario. Deberá cambiar la contraseña al iniciar sesión.
      </p>
      <div style={{ background: 'var(--bg3, #f3f4f6)', border: '1px solid var(--b2, #d1d5db)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--t3, #9ca3af)', letterSpacing: '0.06em', fontWeight: 700 }}>Correo</div>
        <div style={{ fontSize: '0.95rem', color: 'var(--text, #111)', marginBottom: 10, wordBreak: 'break-all' }}>{email}</div>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--t3, #9ca3af)', letterSpacing: '0.06em', fontWeight: 700 }}>Contraseña temporal</div>
        <div style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text, #111)', wordBreak: 'break-all' }}>{password}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={handleCopy} style={{ background: 'none', border: '1px solid var(--b2, #d1d5db)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', color: 'var(--t2, #6b7280)', fontFamily: 'inherit', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button onClick={onClose} style={{ background: 'var(--accent, #d97706)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>
          Listo
        </button>
      </div>
    </Modal>
  )
}

// ── Create user modal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, restaurants, creator, currentRestaurantId, planLabel, maxUsers, currentUserCount, licenseActive }) {
  const { error } = useToast()
  const [saving, setSaving] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [createdCreds, setCreatedCreds] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: rolesFor(creator)[0] || 'usuario',
    restaurantIds: currentRestaurantId ? [currentRestaurantId] : [],
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleRest = (id) => setForm((f) => ({
    ...f,
    restaurantIds: f.restaurantIds.includes(id)
      ? f.restaurantIds.filter((r) => r !== id)
      : [...f.restaurantIds, id],
  }))

  const handleGenerate = () => {
    const pwd = generateTempPassword(12)
    setForm((f) => ({ ...f, password: pwd }))
    setPwdError('')
    setShowPwd(true)
  }

  const handlePwdChange = (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, password: v }))
    setPwdError(v && !validateStrongPassword(v) ? PASSWORD_POLICY.message : '')
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { error('Completa todos los campos'); return }
    if (!validateStrongPassword(form.password)) { setPwdError(PASSWORD_POLICY.message); return }
    if (!form.restaurantIds.length) { error('Asigna al menos un restaurante'); return }
    // Master (operador de la plataforma) saltea checks de licencia/limite del restaurante.
    if (!creator.isMaster) {
      if (!licenseActive) { error('La licencia del restaurante no está activa.'); return }
      if (typeof maxUsers === 'number' && currentUserCount >= maxUsers) {
        error(`Has alcanzado el límite de ${maxUsers} usuarios del plan ${planLabel}. Actualiza tu plan para crear más.`)
        return
      }
    }
    setSaving(true)
    try {
      await createUserWithRole(form, creator.uid)
      setCreatedCreds({ name: form.name, email: form.email, password: form.password })
      onCreated()
    } catch (err) {
      error(err.code === 'auth/email-already-in-use' ? 'Este correo ya está registrado' : (err.message || 'Error al crear usuario'))
    } finally { setSaving(false) }
  }

  if (createdCreds) {
    return (
      <CreatedCredentialsModal
        name={createdCreds.name}
        email={createdCreds.email}
        password={createdCreds.password}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal title="Crear nuevo usuario" onClose={onClose}>
      <Field label="Nombre completo *">
        <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: toTitleCase(e.target.value) }))} placeholder="Ej: María García" />
      </Field>
      <Field label="Correo electrónico *">
        <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="correo@ejemplo.com" />
      </Field>
      <Field label="Contraseña temporal *">
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              style={{ ...inputStyle, paddingRight: 36 }}
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={handlePwdChange}
              placeholder="Generar o escribir"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2, #6b7280)', padding: 4 }}
              title={showPwd ? 'Ocultar' : 'Mostrar'}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            style={{ background: 'var(--bg3, #f3f4f6)', border: '1px solid var(--b2, #d1d5db)', borderRadius: 8, padding: '0 12px', cursor: 'pointer', color: 'var(--t2, #6b7280)', fontFamily: 'inherit', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            title="Generar contraseña fuerte"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Generar
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: pwdError ? '#ef4444' : 'var(--t3, #9ca3af)', marginTop: 6 }}>
          {pwdError || PASSWORD_POLICY.message}
        </p>
      </Field>
      <Field label="Rol *">
        <select style={inputStyle} value={form.role} onChange={set('role')}>
          {rolesFor(creator).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Field>
      {restaurants.length > 1 && (
        <Field label="Restaurantes asignados">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {restaurants.map((rest) => (
              <label key={rest.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text, #111)' }}>
                <input
                  type="checkbox"
                  checked={form.restaurantIds.includes(rest.id)}
                  onChange={() => toggleRest(rest.id)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent, #d97706)', cursor: 'pointer' }}
                />
                {rest.name}
              </label>
            ))}
          </div>
        </Field>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--b2, #d1d5db)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', color: 'var(--t2, #6b7280)', fontFamily: 'inherit', fontSize: '0.85rem' }}>
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving} style={{ background: 'var(--accent, #d97706)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>
    </Modal>
  )
}

// ── Edit role modal ────────────────────────────────────────────────────────────
function EditRoleModal({ member, onClose, onSaved, creator }) {
  const { success, error } = useToast()
  const [role, setRole] = useState(member.role)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserRole(member.uid, role, member.restaurantIds || [])
      success('Rol actualizado')
      onSaved()
      onClose()
    } catch (err) { error(err.message || 'Error') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Editar rol — ${member.name}`} onClose={onClose}>
      <Field label="Nuevo rol">
        <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
          {rolesFor(creator).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--b2, #d1d5db)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', color: 'var(--t2, #6b7280)', fontFamily: 'inherit', fontSize: '0.85rem' }}>
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent, #d97706)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { currentRestaurant, theme } = useAppStore()
  const { user, isMaster, isAdmin, canManageUsers } = useAuth()
  const { plan, active: licenseActive, maxUsers } = usePlan()
  const { success, error } = useToast()
  const isDark = theme === 'night'

  const [members, setMembers] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const creator = { uid: user?.uid, isMaster, isAdmin }

  const handleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const sortedMembers = useMemo(() => {
    const arr = [...members]
    const dir = sortDir === 'asc' ? 1 : -1
    const getVal = (m) => {
      switch (sortBy) {
        case 'name':    return (m.name || '').toLowerCase()
        case 'role':    return (m.restaurantRole || m.role || '').toLowerCase()
        case 'created': return m.createdAt?.toMillis?.() ?? 0
        case 'active':  return m.active === false ? 0 : 1
        default: return ''
      }
    }
    arr.sort((a, b) => {
      const av = getVal(a), bv = getVal(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [members, sortBy, sortDir])

  const loadData = async () => {
    if (!currentRestaurant?.id) return
    setLoading(true)
    try {
      const memberIds = Object.keys(currentRestaurant.members || {})
      const profiles = await Promise.all(
        memberIds.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid))
            if (!snap.exists()) return null
            return { uid, ...snap.data(), restaurantRole: currentRestaurant.members[uid]?.role }
          } catch { return null }
        })
      )
      setMembers(profiles.filter(Boolean))

      // Load restaurants for assignment (master/superadmin see all)
      if (isMaster) {
        const snap = await getDocs(collection(db, 'restaurants'))
        setRestaurants(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } else {
        setRestaurants([currentRestaurant])
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [currentRestaurant?.id])

  const handleDeactivate = async (member) => {
    if (!window.confirm(`¿${member.active !== false ? 'Desactivar' : 'Activar'} a ${member.name}?`)) return
    try {
      await deactivateUser(member.uid, member.active === false)
      success('Usuario actualizado')
      loadData()
    } catch { error('Error al actualizar') }
  }

  const handlePasswordReset = async (member) => {
    if (!window.confirm(`¿Enviar correo de restablecimiento a ${member.email}?`)) return
    try {
      await sendUserPasswordReset(member.email)
      success('Correo enviado')
    } catch { error('Error al enviar correo') }
  }

  const t3 = isDark ? '#4a4840' : '#9ca3af'
  const t2 = isDark ? '#8a8578' : '#6b7280'
  const ink = isDark ? '#f0ece4' : '#111827'
  const bg2 = isDark ? '#111712' : '#fff'
  const b1  = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'
  const bg3 = isDark ? '#181f19' : '#f9fafb'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: ink, margin: '0 0 4px' }}>
            Gestión de usuarios
          </h1>
          <p style={{ color: t3, fontSize: '0.85rem', margin: 0 }}>
            {members.length} de {maxUsers} miembro{maxUsers !== 1 ? 's' : ''} ({plan.label})
          </p>
        </div>
        {canManageUsers && (() => {
          // Master saltea licencia/limite del restaurante (es el operador de la plataforma)
          const atLimit = !isMaster && members.length >= maxUsers
          const disabled = !isMaster && (atLimit || !licenseActive)
          return (
            <button
              onClick={() => setShowCreate(true)}
              disabled={disabled}
              title={isMaster ? '' : (!licenseActive ? 'Licencia inactiva' : atLimit ? `Límite del plan ${plan.label} alcanzado` : '')}
              style={{
                background: 'var(--accent, #d97706)', color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 18px', fontFamily: 'inherit', fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <UserPlus className="h-4 w-4" /> Nuevo usuario
            </button>
          )
        })()}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent, #d97706)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : members.length === 0 ? (
        <p style={{ color: t3, textAlign: 'center', padding: '60px 0' }}>No hay usuarios registrados.</p>
      ) : (
        <div style={{ background: bg2, border: `1px solid ${b1}`, borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: isDark ? '#0d110e' : '#f9fafb' }}>
                {[
                  { label: 'Usuario',        key: 'name' },
                  { label: 'Rol',            key: 'role' },
                  { label: 'Fecha creación', key: 'created' },
                  { label: 'Estado',         key: 'active' },
                  { label: 'Acciones',       key: null },
                ].map(({ label, key }) => {
                  const sortable = !!key
                  const isActive = sortBy === key
                  return (
                    <th key={label}
                      onClick={sortable ? () => handleSort(key) : undefined}
                      style={{
                        padding: '11px 16px', textAlign: 'left',
                        fontSize: '0.68rem', textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: isActive ? 'var(--accent)' : t3,
                        fontWeight: 700, borderBottom: `1px solid ${b1}`,
                        cursor: sortable ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {label}
                        {sortable && (
                          isActive
                            ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                            : <ArrowUpDown className="h-3 w-3" style={{ opacity: 0.4 }} />
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => {
                const createdAt = m.createdAt?.toDate?.()?.toLocaleDateString('es-ES') || '—'
                const isActive = m.active !== false
                return (
                  <tr key={m.uid}
                    style={{ borderBottom: `1px solid ${b1}`, transition: 'background 0.15s' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = isDark ? 'rgba(201,168,76,0.04)' : '#fafafa' }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--accent, #d97706)', opacity: isActive ? 1 : 0.4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                        }}>
                          {m.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: isActive ? ink : t2 }}>{m.name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: t3 }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <RoleBadge role={m.restaurantRole || m.role || 'usuario'} />
                    </td>
                    <td style={{ padding: '13px 16px', color: t3, fontSize: '0.8rem' }}>{createdAt}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        background: isActive ? 'rgba(74,158,110,0.12)' : 'rgba(192,72,72,0.10)',
                        color: isActive ? '#4a9e6e' : '#c04848',
                        border: `1px solid ${isActive ? 'rgba(74,158,110,0.25)' : 'rgba(192,72,72,0.25)'}`,
                        borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700,
                      }}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {canManageUsers && m.uid !== user?.uid && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <ActionBtn title="Editar rol" onClick={() => setEditMember(m)} icon={<Pencil className="h-3.5 w-3.5" />} />
                          <ActionBtn title="Enviar reset de contraseña" onClick={() => handlePasswordReset(m)} icon={<MailCheck className="h-3.5 w-3.5" />} />
                          <ActionBtn title={isActive ? 'Desactivar' : 'Activar'} onClick={() => handleDeactivate(m)} icon={<Power className="h-3.5 w-3.5" />} danger={isActive} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role legend */}
      <div style={{ marginTop: 28, background: bg2, border: `1px solid ${b1}`, borderRadius: 16, padding: '20px 24px' }}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.95rem', color: ink, margin: '0 0 14px' }}>Roles del sistema</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { role: 'master',  desc: 'Acceso total. Único que puede crear restaurantes. Puede crear master, admin y usuario.' },
            { role: 'admin',   desc: 'Gestión completa de su restaurante. Puede crear admin y usuario.' },
            { role: 'usuario', desc: 'Solo lectura de recetas. No ve costos ni configuración.' },
          ].map(({ role, desc }) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RoleBadge role={role} />
              <span style={{ fontSize: '0.82rem', color: t2 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
          restaurants={restaurants}
          creator={creator}
          currentRestaurantId={currentRestaurant?.id}
          planLabel={plan.label}
          maxUsers={maxUsers}
          currentUserCount={members.length}
          licenseActive={licenseActive}
        />
      )}
      {editMember && (
        <EditRoleModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={loadData}
          creator={creator}
        />
      )}
    </div>
  )
}

function ActionBtn({ title, onClick, icon, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: danger ? 'rgba(192,72,72,0.10)' : 'var(--bg3, #f3f4f6)',
        border: `1px solid ${danger ? 'rgba(192,72,72,0.25)' : 'var(--b2, #d1d5db)'}`,
        color: danger ? '#c04848' : 'var(--t2, #6b7280)',
        borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', transition: 'opacity 0.15s',
      }}
      onMouseOver={(e) => { e.currentTarget.style.opacity = '0.75' }}
      onMouseOut={(e) => { e.currentTarget.style.opacity = '1' }}
    >
      {icon}
    </button>
  )
}
