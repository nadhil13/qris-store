const CACHE_NAME = 'atelier-nusantara-cache-v26';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles/main.css',
  './scripts/app.js',
  './scripts/qris.js',
  './scripts/core/catalog.js',
  './scripts/core/dialogs.js',
  './scripts/core/cart.js',
  './scripts/core/orders.js',
  './scripts/core/payments.js',
  './scripts/core/store.js',
  './scripts/core/auth.js',
  './scripts/core/inventory.js',
  './scripts/core/format.js',
  './scripts/vendor/gsap.min.js',
  './scripts/vendor/ScrollTrigger.min.js',
  './scripts/vendor/qrcode.min.js',
  './scripts/vendor/qrcode.esm.js',
  './scripts/vendor/jsqr.js',
  './assets/notification-icon.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Service Worker precache gagal:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. NEVER cache API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Network-First strategy for HTML navigation, scripts, and stylesheets so deployments on Vercel reflect instantly
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => { });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed (offline) -> fall back to cache
        return caches.open(CACHE_NAME).then(async (cache) => {
          const cached = await cache.match(event.request, { ignoreSearch: true });
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return cache.match('./index.html');
          }
          return Response.error();
        });
      })
  );
});
