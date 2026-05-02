// Service Worker auto-destructivo (kill-switch).
// Mismo contenido que /sw.js — algunos browsers buscan este nombre.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch (_) { /* noop */ }
    try {
      await self.registration.unregister()
    } catch (_) { /* noop */ }
    try {
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => { try { c.navigate(c.url) } catch (_) {} })
    } catch (_) { /* noop */ }
  })())
})
