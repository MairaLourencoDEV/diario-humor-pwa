const CACHE_NAME = 'diario-humor-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/manifest.json',
  '/icons/pumpkinHappy-128.png',
  '/icons/ghostSad-128.png',
  '/icons/pumpkinConfused-128.png',
  '/icons/ghostAngry-128.png',
  '/icons/pumpkinNauseous-128.png',
  '/icons/pumpkinNauseous-512.png',
  '/icons/ghostAngry-512.png',
  '/icons/pumpkinHappy-512.png',
  '/icons/ghostSad-512.png',
  '/icons/pumpkinConfused-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedRes => {
      if (cachedRes) return cachedRes;
      return fetch(event.request)
        .then(networkRes => networkRes)
        .catch(() => {
          // fallback para offline
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
    })
  );
});




