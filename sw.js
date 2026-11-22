const CACHE = 'pocket-calc-v3-20261122-v147';
const ASSETS = ['./', './index.html', './style.css?v=1.4.7', './engine.js?v=1.4.7', './basic.js?v=1.4.7', './formulas.js?v=1.4.7', './import.js?v=1.4.7', './complete.js?v=1.4.7', './app.js?v=1.4.7', './editor.html', './editor.css?v=1.4.7', './editor.js?v=1.4.7', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.7', './angle.js?v=1.4.7', './geo.js?v=1.4.7', './points.js?v=1.4.7', './store.js?v=1.4.7', './dialog.js?v=1.4.7', './sokusetsu.js?v=1.4.7', './plot.js?v=1.4.7', './genba.js?v=1.4.7', './genba-calc.js?v=1.4.7', './zip.js?v=1.4.7', './cclwrite.js?v=1.4.7', './senkei.js?v=1.4.7', './layout.js?v=1.4.7', './proginfo.js?v=1.4.7', './pickxy.js?v=1.4.7'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pocket-calc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(err => { if (e.request.mode === 'navigate') return caches.match('./index.html'); throw err; })));
});
