const CACHE_NAME = 'brigid-v2';
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache portal API GET responses (session data, check-ins, records)
  if (url.pathname.startsWith('/api/portal/') || url.pathname.startsWith('/api/sessions')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) =>
          cached ?? new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        ))
    );
    return;
  }

  // Skip other API routes and Next.js internals
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return;

  // Portal pages: network-first with cache fallback for offline viewing
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
