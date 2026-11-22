const CACHE = 'pocket-calc-v3-20261122-v146';
const ASSETS = ['./', './index.html', './style.css?v=1.4.6', './engine.js?v=1.4.6', './basic.js?v=1.4.6', './formulas.js?v=1.4.6', './import.js?v=1.4.6', './complete.js?v=1.4.6', './app.js?v=1.4.6', './editor.html', './editor.css?v=1.4.6', './editor.js?v=1.4.6', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.6', './angle.js?v=1.4.6', './geo.js?v=1.4.6', './points.js?v=1.4.6', './store.js?v=1.4.6', './dialog.js?v=1.4.6', './sokusetsu.js?v=1.4.6', './plot.js?v=1.4.6', './genba.js?v=1.4.6', './genba-calc.js?v=1.4.6', './zip.js?v=1.4.6', './cclwrite.js?v=1.4.6', './senkei.js?v=1.4.6', './layout.js?v=1.4.6', './proginfo.js?v=1.4.6'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pocket-calc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(err => { if (e.request.mode === 'navigate') return caches.match('./index.html'); throw err; })));
});
