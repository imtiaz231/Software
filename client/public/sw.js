/* Service worker: lets the app install on a phone and open instantly.
   - App files (JS/CSS/icons) are cached.
   - Pages use "network first", so users always get the latest version when online.
   - API calls and uploads are NEVER cached: business data is always live from the server.
   Bump VERSION to force every phone to refresh its cache. */
const VERSION = 'v1';
const CACHE = 'shop-manager-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;   // always live

  if (req.mode === 'navigate') {                                                           // pages: network first
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); } return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }
  e.respondWith(                                                                           // files: cache first
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
