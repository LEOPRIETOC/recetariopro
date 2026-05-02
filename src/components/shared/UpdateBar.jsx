import { useEffect, useState, useCallback } from 'react'

const CHECK_INTERVAL_MS = 60 * 1000 // 1 min
const CURRENT_BUILD_ID = import.meta.env.VITE_BUILD_ID
const CURRENT_VERSION  = import.meta.env.VITE_APP_VERSION

async function fetchRemote() {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('version.json not reachable')
  return res.json()
}

async function hardReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch (err) {
    console.warn('[UpdateBar] cache cleanup failed', err)
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
const SHORTCUT = isMac ? 'Cmd + Shift + R' : 'Ctrl + Shift + R'

export function UpdateBar() {
  const [stale, setStale] = useState(false)
  const [remoteVersion, setRemoteVersion] = useState(null)
  const [reloading, setReloading] = useState(false)

  const check = useCallback(async () => {
    if (!CURRENT_BUILD_ID) return
    try {
      const data = await fetchRemote()
      const remoteId = data?.buildId
      const remoteV  = data?.version
      const isStale = !!remoteId && remoteId !== CURRENT_BUILD_ID
      if (isStale) {
        setRemoteVersion(remoteV || null)
        setStale(true)
      }
    } catch (err) {
      console.warn('[UpdateBar] error fetching version.json', err?.message || err)
    }
  }, [])

  useEffect(() => {
    check()
    const id = setInterval(check, CHECK_INTERVAL_MS)
    const onFocus = () => check()
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  if (!stale) return null

  const handleClick = async () => {
    setReloading(true)
    await hardReload()
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-required-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(8, 12, 24, 0.85)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: '#fff',
          color: '#0b1220',
          borderRadius: 18,
          maxWidth: 460,
          width: '100%',
          padding: '28px 28px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#0833A2',
            color: '#fff',
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800,
          }}
          aria-hidden="true"
        >
          ↻
        </div>

        <h2
          id="update-required-title"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.4rem',
            margin: '0 0 8px',
            color: '#0b1220',
          }}
        >
          Actualización requerida
        </h2>
        <p style={{ fontSize: '0.92rem', color: '#475569', margin: '0 0 18px', lineHeight: 1.5 }}>
          Estás usando una versión obsoleta de RecetarioPro y no podés continuar
          hasta actualizar.
        </p>

        <div
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '14px 16px',
            margin: '0 0 18px',
            textAlign: 'left',
          }}
        >
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Versión instalada
          </p>
          <p style={{ fontSize: '0.95rem', color: '#0b1220', margin: '2px 0 10px', fontWeight: 600 }}>
            v{CURRENT_VERSION || '—'}
          </p>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Versión disponible
          </p>
          <p style={{ fontSize: '0.95rem', color: '#0833A2', margin: '2px 0 0', fontWeight: 700 }}>
            v{remoteVersion || 'nueva'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleClick}
          disabled={reloading}
          style={{
            background: '#0833A2',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 20px',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: reloading ? 'wait' : 'pointer',
            width: '100%',
            marginBottom: 10,
            fontFamily: 'inherit',
          }}
        >
          {reloading ? 'Actualizando…' : 'Actualizar ahora'}
        </button>

        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
          O presioná{' '}
          <kbd
            style={{
              background: '#e2e8f0',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '2px 8px',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#0b1220',
            }}
          >
            {SHORTCUT}
          </kbd>{' '}
          para forzar la actualización.
        </p>
      </div>
    </div>
  )
}
