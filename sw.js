const CACHE_NAME = 'curator-v11';
const ASSETS = [
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/router.js',
  './js/views/home.js',
  './js/views/board.js',
  './js/views/article.js',
  './js/views/summaries.js',
  './js/views/settings.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
  // Network first for everything — ensures fresh content
  if (e.request.url.includes('api.anthropic.com') || e.request.url.includes('r.jina.ai')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Update cache with fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
