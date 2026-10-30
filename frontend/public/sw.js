// Service worker: recibe las notificaciones push aunque la app esté cerrada.
// No guarda nada en caché para que siempre se use la versión más reciente de la app.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return
  let aviso
  try {
    aviso = event.data.json()
  } catch {
    aviso = { titulo: 'Entregas', cuerpo: event.data.text(), id: 'aviso' }
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(aviso.titulo, {
        body: aviso.cuerpo,
        // Mismo id = reemplaza la notificación anterior en vez de repetirla
        tag: aviso.id,
        icon: '/icono-192.png',
        badge: '/icono-192.png',
        data: { url: aviso.url || '/entregas' },
        vibrate: [200, 100, 200],
      })
      // Si la app está abierta, que también muestre el toast y recargue las entregas
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const v of ventanas) v.postMessage({ tipo: 'aviso', aviso })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/entregas', self.location.origin).href
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin)
      if (abierta) {
        // La app cambia de página sola, sin recargar
        abierta.postMessage({ tipo: 'ir', url })
        return abierta.focus()
      }
      return self.clients.openWindow(url)
    })(),
  )
})
