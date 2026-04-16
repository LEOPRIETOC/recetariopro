import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../lib/firebase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await sendPasswordResetEmail(auth, email)
      setSent(true)
    } catch (err) {
      setError('No encontramos una cuenta con ese correo.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg)'
    }}>

      {/* LADO IZQUIERDO — Foto */}
      <div
        style={{
          flex: 1,
          display: 'none',
          position: 'relative',
          overflow: 'hidden'
        }}
        className="login-left"
      >
        <img
          src="/login-bg.png"
          alt="RecetarioPro"
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover'
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 100%)'
        }} />
        <div style={{
          position: 'absolute', bottom: 40, left: 40, right: 40
        }}>
          <h2 style={{
            fontFamily: "'Playfair Display',serif",
            fontSize: '2rem', color: '#fff',
            fontWeight: 700, marginBottom: 8
          }}>
            RecetarioPro
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem' }}>
            Gestión profesional de recetas para restaurantes
          </p>
        </div>
      </div>

      {/* LADO DERECHO — Formulario */}
      <div style={{
        width: 'min(480px, 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 48px',
        background: 'var(--bg2)'
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{
            fontFamily: "'Playfair Display',serif",
            fontSize: '1.8rem',
            color: 'var(--accent)',
            marginBottom: 4
          }}>
            RecetarioPro
          </h1>
        </div>

        {!sent ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{
                fontSize: '1.3rem', fontWeight: 700,
                color: 'var(--text)', marginBottom: 6
              }}>
                Recuperar contraseña
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--t2)' }}>
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{
              display: 'flex', flexDirection: 'column', gap: 16
            }}>
              <div>
                <label style={{
                  fontSize: '0.75rem', color: 'var(--t3)',
                  fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', display: 'block',
                  marginBottom: 6
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
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--b2)'}
                />
              </div>

              {error && (
                <div style={{
                  color: 'var(--red)',
                  fontSize: '0.82rem',
                  textAlign: 'center'
                }}>
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
                  transition: 'opacity 0.2s'
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
                  textAlign: 'center'
                }}
              >
                ← Volver al inicio de sesión
              </button>
            </form>
          </>
        ) : (
          /* Pantalla de éxito */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
            <h2 style={{
              fontSize: '1.2rem', fontWeight: 700,
              color: 'var(--text)', marginBottom: 8
            }}>
              ¡Correo enviado!
            </h2>
            <p style={{
              fontSize: '0.85rem', color: 'var(--t2)',
              marginBottom: 24, lineHeight: 1.6
            }}>
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
                cursor: 'pointer'
              }}
            >
              Volver al login
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
