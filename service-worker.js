const CACHE_VERSION = 'vorbeste-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/router.js',
  './js/storage.js',
  './js/srs.js',
  './js/phrases.js',
  './js/tts.js',
  './js/stt.js',
  './js/ai.js',
  './js/render.js',
  './js/screens/dashboard.js',
  './js/screens/lesson.js',
  './js/screens/speaking.js',
  './js/screens/chat.js',
  './js/screens/translator.js',
  './js/screens/cheatsheet.js',
  './js/screens/progress.js',
  './js/screens/settings.js',
  './js/screens/phaselist.js',
  './data/phases-meta.json',
  './data/phases/phase0.json',
  './data/phases/phase1.json',
  './data/phases/phase2.json',
  './data/phases/phase3.json',
  './data/phases/phase4.json',
  './data/phases/phase5.json',
  './data/phases/phase6.json',
  './data/scenarios.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache calls to external APIs (Anthropic, Google TTS) — always network.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
