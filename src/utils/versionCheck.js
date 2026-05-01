// Verifica que la version actualmente cargada coincida con /version.json.
// Si esta desfasada, limpia caches + service workers y recarga con cache-bust.
// Llamar antes de acciones criticas (guardar receta, modificar MP, etc.).

const CURRENT_BUILD_ID = import.meta.env.VITE_BUILD_ID

export async function checkVersion() {
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return { ok: true }
    const data = await res.json()
    if (!data?.buildId || !CURRENT_BUILD_ID) return { ok: true }
    return { ok: data.buildId === CURRENT_BUILD_ID, current: CURRENT_BUILD_ID, remote: data.buildId }
  } catch {
    return { ok: true }
  }
}

async function purgeAndReload(remoteBuildId) {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch { /* noop */ }
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch { /* noop */ }
  try { localStorage.setItem('app_buildId', remoteBuildId) } catch { /* noop */ }
  const url = new URL(window.location.href)
  url.searchParams.set('v', remoteBuildId)
  window.location.replace(url.toString())
}

/**
 * Lanza error y recarga si la version local esta obsoleta.
 * Llamar al inicio de handlers que escriben datos (save, delete, etc.).
 */
export async function assertVersionFresh() {
  const v = await checkVersion()
  if (!v.ok) {
    await purgeAndReload(v.remote)
    throw new Error('Versión obsoleta — recargando la aplicación.')
  }
}
