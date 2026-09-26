/* Knowfeed service worker: keeps the app and the latest feed available offline (for when there's no signal) */
const VERSION = 'kf-v1';
const SHELL = `${VERSION}-shell`, DATA = `${VERSION}-data`, IMG = `${VERSION}-img`;
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(fallbackKey || req, res.clone());
    return res;
  } catch {
    return (await cache.match(fallbackKey || req)) || Response.error();
  }
}
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return;                          // live data: always the network
    if (url.pathname.startsWith('/data/')) { e.respondWith(networkFirst(req, DATA, url.pathname)); return; }
    if (req.mode === 'navigate') { e.respondWith(networkFirst(req, SHELL, '/')); return; }
    e.respondWith(cacheFirst(req, SHELL));                                 // hashed build assets never change
    return;
  }
  // Fonts and card photos: keep what we've seen so the feed still looks right offline
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { e.respondWith(cacheFirst(req, SHELL)); return; }
  if (req.destination === 'image') {
    e.respondWith(cacheFirst(req, IMG).catch(() => Response.error()));
    e.waitUntil(trim(IMG, 150));
  }
});
