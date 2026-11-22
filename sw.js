const CACHE = 'pocket-calc-v3-20261122-v145';
const ASSETS = ['./', './index.html', './style.css?v=1.4.5', './engine.js?v=1.4.5', './basic.js?v=1.4.5', './formulas.js?v=1.4.5', './import.js?v=1.4.5', './complete.js?v=1.4.5', './app.js?v=1.4.5', './editor.html', './editor.css?v=1.4.5', './editor.js?v=1.4.5', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.5', './angle.js?v=1.4.5', './geo.js?v=1.4.5', './points.js?v=1.4.5', './store.js?v=1.4.5', './dialog.js?v=1.4.5', './sokusetsu.js?v=1.4.5', './plot.js?v=1.4.5', './genba.js?v=1.4.5', './genba-calc.js?v=1.4.5', './zip.js?v=1.4.5', './cclwrite.js?v=1.4.5', './senkei.js?v=1.4.5', './layout.js?v=1.4.5', './proginfo.js?v=1.4.5'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pocket-calc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(err => { if (e.request.mode === 'navigate') return caches.match('./index.html'); throw err; })));
});
