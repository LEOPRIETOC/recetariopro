// Service Worker auto-destructivo.
// Si el navegador tiene un SW viejo registrado en este origen, cuando vaya a
// revisar /service-worker.js (cosa que hace periodicamente), encontrara este
// archivo. Como su contenido es distinto, lo instala, toma control, limpia
// todas las caches, se desregistra y fuerza un reload de los clientes para
// que terminen cargando la version fresh del HTML.

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
