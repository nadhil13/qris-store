const CACHE_NAME = 'atelier-nusantara-cache-v8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles/main.css',
  './scripts/app.js',
  './scripts/qris.js',
  './scripts/core/catalog.js',
  './scripts/core/cart.js',
  './scripts/core/orders.js',
  './scripts/core/payments.js',
  './scripts/core/store.js',
  './scripts/core/format.js',
  './scripts/vendor/gsap.min.js',
  './scripts/vendor/ScrollTrigger.min.js',
  './scripts/vendor/qrcode.min.js',
  './scripts/vendor/jsqr.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
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

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, toCache);
          });
        }
        return networkResponse;
      }).catch(() => null);

      if (cachedResponse) return cachedResponse;
      return fetchPromise.then((res) => {
        if (res) return res;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return null;
      });
    })
  );
});
