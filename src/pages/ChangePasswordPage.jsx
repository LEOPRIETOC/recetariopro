import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Check, X as XIcon } from 'lucide-react'
import { changeUserPassword, validateStrongPassword, PASSWORD_POLICY, logoutUser } from '../services/auth'
import { useAppStore } from '../store/useAppStore'
import { useToast } from '../components/ui/toast'

function Rule({ ok, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: ok ? '#10b981' : '#9ca3af' }}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </div>
  )
}

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, userProfile, setUserProfile } = useAppStore()
  const { success, error } = useToast()
  const theme = useAppStore((s) => s.theme)
  const isDark = theme === 'night'

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const checks = {
    length: newPwd.length >= PASSWORD_POLICY.minLength,
    upper: /[A-Z]/.test(newPwd),
    lower: /[a-z]/.test(newPwd),
    digit: /\d/.test(newPwd),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPwd),
    match: newPwd.length > 0 && newPwd === confirmPwd,
  }
  const allOk = checks.length && checks.upper && checks.lower && checks.digit && checks.special && checks.match
  const isForced = userProfile?.mustChangePassword === true

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrMsg('')
    if (!currentPwd) { setErrMsg('Ingresa tu contraseña actual'); return }
    if (!validateStrongPassword(newPwd)) { setErrMsg(PASSWORD_POLICY.message); return }
    if (newPwd !== confirmPwd) { setErrMsg('Las contraseñas no coinciden'); return }
    if (newPwd === currentPwd) { setErrMsg('La nueva contraseña debe ser distinta a la actual'); return }

    setSaving(true)
    try {
      await changeUserPassword(currentPwd, newPwd)
      if (userProfile) setUserProfile({ ...userProfile, mustChangePassword: false })
      success('Contraseña actualizada correctamente')
      navigate('/restaurants')
    } catch (err) {
      const map = {
        'auth/wrong-password': 'La contraseña actual es incorrecta',
        'auth/invalid-credential': 'La contraseña actual es incorrecta',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
        'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
      }
      setErrMsg(map[err.code] || err.message || 'Error al cambiar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try { await logoutUser() } catch { /* noop */ }
    navigate('/login')
  }

  const bg = isDark ? '#0a0e0b' : '#f9fafb'
  const card = isDark ? '#111712' : '#ffffff'
  const bdr = isDark ? '#1f2937' : '#e5e7eb'
  const txt = isDark ? '#f0ece4' : '#111827'
  const lbl = isDark ? '#9ca3af' : '#374151'
  const inp = {
    width: '100%',
    background: isDark ? '#1f2937' : '#fff',
    border: `1px solid ${bdr}`,
    borderRadius: 8,
    padding: '10px 38px 10px 12px',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    color: txt,
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', width: 48, height: 48, borderRadius: '50%', background: 'var(--accent, #d97706)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Lock className="h-5 w-5" color="#fff" />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: txt, margin: 0 }}>
            {isForced ? 'Cambia tu contraseña' : 'Cambiar contraseña'}
          </h1>
          {isForced && (
            <p style={{ fontSize: '0.85rem', color: lbl, marginTop: 8, marginBottom: 0 }}>
              Por seguridad, debes cambiar la contraseña temporal antes de continuar.
            </p>
          )}
          {user?.email && (
            <p style={{ fontSize: '0.78rem', color: lbl, marginTop: 6, marginBottom: 0 }}>
              {user.email}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: lbl, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Contraseña actual
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                style={inp}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: lbl, padding: 4 }}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: lbl, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Contraseña nueva
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                style={inp}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: lbl, padding: 4 }}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
              <Rule ok={checks.length} label="Mín. 8 caracteres" />
              <Rule ok={checks.upper} label="Una mayúscula" />
              <Rule ok={checks.lower} label="Una minúscula" />
              <Rule ok={checks.digit} label="Un número" />
              <Rule ok={checks.special} label="Un símbolo" />
              <Rule ok={checks.match} label="Coincide" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: lbl, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Confirmar contraseña nueva
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                style={inp}
              />
            </div>
          </div>

          {errMsg && (
            <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem' }}>
              {errMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !allOk}
            style={{
              background: 'var(--accent, #d97706)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '11px 16px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: saving || !allOk ? 'not-allowed' : 'pointer',
              opacity: saving || !allOk ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {saving ? 'Guardando…' : 'Cambiar contraseña'}
          </button>

          {isForced && (
            <button
              type="button"
              onClick={handleSignOut}
              style={{ background: 'none', border: 'none', color: lbl, fontSize: '0.78rem', cursor: 'pointer', padding: 6 }}
            >
              Cerrar sesión
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
