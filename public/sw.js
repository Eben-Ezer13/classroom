/* Classroom Web Push service worker. Keep this file dependency-free. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Classroom', body: event.data?.text() ?? '' }
  }

  const title = payload.title || 'Nouvelle notification Classroom'
  const options = {
    body: payload.body || 'Une nouvelle information est disponible dans votre classe.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.tag || 'classroom-notification',
    renotify: true,
    data: { url: payload.url || '/notifications', unreadCount: payload.unreadCount },
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      typeof payload.unreadCount === 'number' && 'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge(payload.unreadCount)
        : Promise.resolve(),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification.data?.url || '/notifications'
  const target = new URL(rawUrl, self.location.origin)
  if (target.origin !== self.location.origin) return

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (existing) {
        existing.navigate(target.href)
        return existing.focus()
      }
      return self.clients.openWindow(target.href)
    }),
  )
})
