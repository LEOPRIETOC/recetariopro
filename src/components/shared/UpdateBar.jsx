import { useEffect, useState, useCallback } from 'react'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
const CURRENT_BUILD_ID = import.meta.env.VITE_BUILD_ID

async function fetchRemoteBuildId() {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('version.json not reachable')
  const data = await res.json()
  return data.buildId
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

export function UpdateBar() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [reloading, setReloading] = useState(false)

  const check = useCallback(async () => {
    if (!CURRENT_BUILD_ID) {
      console.warn('[UpdateBar] CURRENT_BUILD_ID no disponible (build sin VITE_BUILD_ID inyectado)')
      return
    }
    try {
      const remote = await fetchRemoteBuildId()
      const isStale = remote && remote !== CURRENT_BUILD_ID
      console.info('[UpdateBar] check', { current: CURRENT_BUILD_ID, remote, isStale })
      if (isStale) setHasUpdate(true)
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

  if (!hasUpdate) return null

  const handleClick = async () => {
    setReloading(true)
    await hardReload()
  }

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999998,
        background: '#0833A2',
        color: '#fff',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: '0.85rem',
        fontWeight: 600,
        fontFamily: 'sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <span>Hay una nueva versión disponible.</span>
      <button
        type="button"
        onClick={handleClick}
        disabled={reloading}
        style={{
          background: '#fff',
          color: '#0833A2',
          border: 'none',
          borderRadius: 6,
          padding: '4px 14px',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: reloading ? 'wait' : 'pointer',
        }}
      >
        {reloading ? 'Actualizando…' : 'Actualizar ahora'}
      </button>
    </div>
  )
}
