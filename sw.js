const CACHE_NAME = 'vocab-master-v4'; // Bump version to force update
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// Install: Pre-cache critical files
self.addEventListener('install', event => {
  self.skipWaiting(); // Force activation
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: Clean up old caches (CRITICAL for fixing blank page issues)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

// Fetch: Network First for HTML, Stale-While-Revalidate for Assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Strategy for External Assets (CDN, Fonts, Scripts) -> Cache First, fall back to network
  if (
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('tailwindcss.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('flaticon.com') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.mp3')
  ) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'cors' && response.type !== 'basic' && response.type !== 'opaque') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        }).catch(() => {
             return new Response('// Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Strategy for everything else (App Logic) -> Network First to fix stale HTML issues
  event.respondWith(
    fetch(event.request).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
          });
      }
      return networkResponse;
    }).catch(() => {
        return caches.match(event.request);
    })
  );
});
