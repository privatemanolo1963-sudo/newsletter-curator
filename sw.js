const CACHE_NAME = 'curator-v18';
const ASSETS = [
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/router.js',
  './js/views/home.js',
  './js/views/board.js',
  './js/views/article.js',
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
  // Skip non-GET requests (POST to WordPress, etc.)
  if (e.request.method !== 'GET') return;

  // Skip external API calls — let them go directly to network
  if (e.request.url.includes('wp-json') || e.request.url.includes('r.jina.ai') || e.request.url.includes('api.microlink.io')) {
    return;
  }

  // App assets: network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
