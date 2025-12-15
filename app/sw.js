const CACHE_NAME = 'vocab-master-vanilla-v1'; 
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(cacheNames => Promise.all(cacheNames.map(cacheName => {
    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
  }))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Cache external CDNs heavily
  if (url.hostname.includes('unpkg.com') || url.hostname.includes('tailwindcss.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        if(res.ok) { let clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, clone)); }
        return res;
      }))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request)));
});