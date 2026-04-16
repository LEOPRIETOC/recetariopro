import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../hooks/useAuth'
import { createUserWithRole, updateUserRole, deactivateUser, sendUserPasswordReset } from '../services/auth'
import { cn, toTitleCase } from '../lib/utils'
import { useToast } from '../components/ui/toast'
import { UserPlus, Pencil, MailCheck, Power, Trash2, X, ChevronDown } from 'lucide-react'

// ── Role badge colors ──────────────────────────────────────────────────────────
const ROLE_BADGE = {
  master:     { bg: '#111111', color: '#c9a84c',  border: '#c9a84c44' },
  superadmin: { bg: '#3b2800', color: '#f59e0b',  border: '#f59e0b44' },
  admin:      { bg: '#0a2e1a', color: '#4ade80',  border: '#4ade8044' },
  usuario:    { bg: '#1f2937', color: '#9ca3af',  border: '#9ca3af33' },
  chef:       { bg: '#1e1b4b', color: '#a5b4fc',  border: '#a5b4fc33' },
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

// ── Role options per creator ───────────────────────────────────────────────────
function rolesFor(creator) {
  if (creator.isMaster)     return ['superadmin', 'admin', 'usuario']
  if (creator.isSuperAdmin) return ['admin', 'usuario']
  if (creator.isAdmin)      return ['usuario']
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

// ── Create user modal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, restaurants, creator }) {
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: rolesFor(creator)[0] || 'usuario', restaurantIds: [] })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleRest = (id) => setForm((f) => ({
    ...f,
    restaurantIds: f.restaurantIds.includes(id)
      ? f.restaurantIds.filter((r) => r !== id)
      : [...f.restaurantIds, id],
  }))

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { error('Completa todos los campos'); return }
    if (form.password.length < 6) { error('La contraseña debe tener al menos 6 caracteres'); return }
    setSaving(true)
    try {
      await createUserWithRole(form, creator.uid)
      success(`Usuario ${form.name} creado correctamente`)
      onCreated()
      onClose()
    } catch (err) {
      error(err.code === 'auth/email-already-in-use' ? 'Este correo ya está registrado' : (err.message || 'Error al crear usuario'))
    } finally { setSaving(false) }
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
        <input style={inputStyle} type="password" value={form.password} onChange={set('password')} placeholder="Mín. 6 caracteres" />
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
  const { user, isMaster, isSuperAdmin, isAdmin, canManageUsers } = useAuth()
  const { success, error } = useToast()
  const isDark = theme === 'night'

  const [members, setMembers] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editMember, setEditMember] = useState(null)

  const creator = { uid: user?.uid, isMaster, isSuperAdmin, isAdmin }

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
            {members.length} miembro{members.length !== 1 ? 's' : ''} en este restaurante
          </p>
        </div>
        {canManageUsers && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ background: 'var(--accent, #d97706)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <UserPlus className="h-4 w-4" /> Nuevo usuario
          </button>
        )}
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
                {['Usuario', 'Rol', 'Fecha creación', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: t3, fontWeight: 700, borderBottom: `1px solid ${b1}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
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
            { role: 'master',     desc: 'Acceso total. Puede crear restaurantes, superadmins y admins.' },
            { role: 'superadmin', desc: 'Gestión de todos los restaurantes asignados. Puede crear admins.' },
            { role: 'admin',      desc: 'Gestión completa de su restaurante, costos y usuarios básicos.' },
            { role: 'usuario',    desc: 'Solo lectura de recetas. No ve costos ni configuración.' },
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
