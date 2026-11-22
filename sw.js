const CACHE = 'pocket-calc-v3-20261122-v148';
const ASSETS = ['./', './index.html', './style.css?v=1.4.8', './engine.js?v=1.4.8', './basic.js?v=1.4.8', './formulas.js?v=1.4.8', './import.js?v=1.4.8', './complete.js?v=1.4.8', './app.js?v=1.4.8', './editor.html', './editor.css?v=1.4.8', './editor.js?v=1.4.8', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.8', './angle.js?v=1.4.8', './geo.js?v=1.4.8', './points.js?v=1.4.8', './store.js?v=1.4.8', './dialog.js?v=1.4.8', './sokusetsu.js?v=1.4.8', './plot.js?v=1.4.8', './genba.js?v=1.4.8', './genba-calc.js?v=1.4.8', './zip.js?v=1.4.8', './cclwrite.js?v=1.4.8', './senkei.js?v=1.4.8', './layout.js?v=1.4.8', './proginfo.js?v=1.4.8', './pickxy.js?v=1.4.8'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pocket-calc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).catch(err => { if (e.request.mode === 'navigate') return caches.match('./index.html'); throw err; })));
});
