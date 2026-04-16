import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { resetPassword } from '../services/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { theme } = useAppStore()
  const isDark = theme === 'night'
  const formBg = isDark ? 'bg-gray-950' : 'bg-white'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await resetPassword(email)
      setSent(true)
    } catch {
      setError('No encontramos una cuenta con ese correo.')
    }
    setLoading(false)
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

      {/* LADO IZQUIERDO — Foto (oculto en mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="/login-bg.png"
          alt="RecetarioPro"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-10 flex flex-col justify-end p-14 text-white">
          <div style={{ background: 'rgba(0,0,0,0.45)', borderRadius: 12, padding: '20px 24px', backdropFilter: 'blur(2px)' }}>
            <span className="font-display font-bold text-xl block mb-3">RecetarioPro</span>
            <h2 className="font-display text-3xl font-bold leading-snug mb-3">
              Tu cocina,<br />protegida.
            </h2>
            <p className="text-gray-200 text-base leading-relaxed max-w-xs">
              Estandariza, controla y comparte tus recetas con tu equipo. Sin cuadernos, sin WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* LADO DERECHO — Formulario */}
      <div className={`w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 ${formBg}`}>
        <div className="w-full max-w-[380px]">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <h1 className={`font-display text-2xl font-bold ${textPrimary}`}>RecetarioPro</h1>
          </div>

          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className={`font-display text-xl font-semibold ${textPrimary}`}>
                  Recuperar contraseña
                </h2>
                <p className={`text-sm mt-1 ${textSecondary}`}>
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label style={{
                    fontSize: '0.75rem', color: 'var(--t3)',
                    fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.07em', display: 'block', marginBottom: 6,
                  }}>
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    required
                    style={{
                      width: '100%',
                      background: 'var(--bg3)',
                      border: '1px solid var(--b2)',
                      borderRadius: 10,
                      padding: '12px 16px',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--b2)'}
                  />
                </div>

                {error && (
                  <div style={{ color: 'var(--red)', fontSize: '0.82rem', textAlign: 'center' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: '#111111',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '13px',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  ← Volver al inicio de sesión
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
              <h2 className={`font-display text-xl font-semibold mb-2 ${textPrimary}`}>
                ¡Correo enviado!
              </h2>
              <p className={`text-sm mb-6 leading-relaxed ${textSecondary}`}>
                Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: '#111111',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 24px',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Volver al login
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
