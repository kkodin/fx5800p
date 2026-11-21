const CACHE = 'pocket-calc-v3-20261122-r2';
const ASSETS = ['./', './index.html', './style.css?v=1.1.0', './engine.js?v=1.1.0', './basic.js?v=1.1.0', './formulas.js?v=1.1.0', './import.js?v=1.1.0', './app.js?v=1.1.0', './editor.html', './editor.css?v=1.1.0', './editor.js?v=1.1.0', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pocket-calc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(err => { if (e.request.mode === 'navigate') return caches.match('./index.html'); throw err; })));
});
