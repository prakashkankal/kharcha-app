const CACHE_NAME = 'kharcha-pwa-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not intercept non-GET requests or backend API requests
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) {
    return;
  }

  // Stale-While-Revalidate strategy for static JS, CSS, fonts, and images:
  // Immediately return cache if present, while updating cache in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting navigation, fallback to cached index.html
          if (event.request.mode === 'navigate') {
            return cache.match('/index.html') || cache.match('/');
          }
          return null;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
