const CACHE = 'pocket-calc-v3-20261122-v144';
const ASSETS = ['./', './index.html', './style.css?v=1.4.4', './engine.js?v=1.4.4', './basic.js?v=1.4.4', './formulas.js?v=1.4.4', './import.js?v=1.4.4', './complete.js?v=1.4.4', './app.js?v=1.4.4', './editor.html', './editor.css?v=1.4.4', './editor.js?v=1.4.4', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.4', './angle.js?v=1.4.4', './geo.js?v=1.4.4', './points.js?v=1.4.4', './store.js?v=1.4.4', './dialog.js?v=1.4.4', './sokusetsu.js?v=1.4.4', './plot.js?v=1.4.4', './genba.js?v=1.4.4', './genba-calc.js?v=1.4.4', './zip.js?v=1.4.4', './cclwrite.js?v=1.4.4', './senkei.js?v=1.4.4', './layout.js?v=1.4.4'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pocket-calc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(err => { if (e.request.mode === 'navigate') return caches.match('./index.html'); throw err; })));
});
