/*
 * Relish — minimal hand-rolled service worker (no Workbox / no deps).
 *
 * Strategy:
 *   - Navigations (HTML)  -> network-first, falling back to the cached shell
 *     so the app still opens offline.
 *   - Static assets       -> cache-first, with a lazy network update.
 *   - Everything is best-effort: any fetch/cache failure is swallowed so the
 *     worker can never break the page. Only same-origin GET is touched.
 */

const CACHE_VERSION = 'relish-v1'
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .catch(() => undefined)
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(url) {
  return /\.(?:js|css|svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|otf|json)$/i.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle same-origin GET requests; let the browser do the rest.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Network-first for page navigations so content stays fresh, with an
  // offline fallback to the cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches
            .open(CACHE_VERSION)
            .then((cache) => cache.put(request, copy))
            .catch(() => undefined)
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/index.html') || caches.match('/'))
            .then((cached) => cached || Response.error())
        )
    )
    return
  }

  // Cache-first for static assets, refreshing the cache in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone()
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined)
            return response
          })
          .catch(() => cached || Response.error())
        return cached || network
      })
    )
  }
})
