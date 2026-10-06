/* Knowfeed service worker: keeps the app and the latest feed available offline (for when there's no signal) */
const VERSION = 'kf-v4';
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
    // The app itself is cached as "/"; other pages (Privacy, Terms…) are cached under their own address,
    // so opening one can never replace the app's offline copy
    if (req.mode === 'navigate') { const app = url.pathname === '/' || url.pathname === '/index.html'; e.respondWith(networkFirst(req, SHELL, app ? '/' : url.pathname)); return; }
    if (url.pathname.startsWith('/assets/')) { e.respondWith(cacheFirst(req, SHELL)); return; }   // hashed build files never change
    e.respondWith(networkFirst(req, SHELL));                                                     // everything else: latest when online
    return;
  }
  // Card photos: keep what we've seen so the feed still looks right offline
  if (req.destination === 'image') {
    e.respondWith(cacheFirst(req, IMG).catch(() => Response.error()));
    e.waitUntil(trim(IMG, 150));
  }
});

/* Edition notifications (sent by pipeline/push.ts) */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Knowfeed', {
    body: d.body || 'Your edition is ready.',
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    tag: d.tag || 'knowfeed', data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).origin === self.location.origin);
    if (open) return open.focus().then(c => (c && 'navigate' in c ? c.navigate(url) : undefined)).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
