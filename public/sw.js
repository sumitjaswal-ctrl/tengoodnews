// Service worker: lets Ten Good News install like an app and open offline.
// Pages and story data are network-first, so a new day always shows up as soon as you are online.
// The built assets have hashed names, so caching them first is safe. Other sites' pictures are never stored.
const CACHE = 'tgn-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch (err) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw err
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const fresh = await fetch(request)
  if (fresh.ok) cache.put(request, fresh.clone())
  return fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return          // publishers' pictures and links: leave alone
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(networkFirst(request))
  }
})

// ---- daily notification ----
// The push itself carries no text. We build the message here from the newest day's data, so it is always today's.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let body = 'Today’s ten good stories are ready.'
    try {
      const index = await (await fetch('data/index.json', { cache: 'no-store' })).json()
      const day = await (await fetch('data/' + index.days[0].file, { cache: 'no-store' })).json()
      const lead = [...day.stories].sort((a, b) => b.uplift - a.uplift)[0]
      if (lead) body = 'Today’s ten good stories are ready. ' + (lead.title.length > 100 ? lead.title.slice(0, 99) + '…' : lead.title)
    } catch { /* offline or data missing: the generic line above still shows */ }
    await self.registration.showNotification('Ten Good News', {
      body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'daily', data: { url: './' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const open = wins.find((w) => w.url.startsWith(self.registration.scope))
    return open ? open.focus() : self.clients.openWindow(target)
  }))
})
