const CACHE = 'pocket-calc-v3-20261122-v1411';
const ASSETS = ['./', './index.html', './style.css?v=1.4.11', './engine.js?v=1.4.11', './basic.js?v=1.4.11', './formulas.js?v=1.4.11', './import.js?v=1.4.11', './complete.js?v=1.4.11', './app.js?v=1.4.11', './editor.html', './editor.css?v=1.4.11', './editor.js?v=1.4.11', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.11', './angle.js?v=1.4.11', './geo.js?v=1.4.11', './points.js?v=1.4.11', './store.js?v=1.4.11', './dialog.js?v=1.4.11', './sokusetsu.js?v=1.4.11', './plot.js?v=1.4.11', './genba.js?v=1.4.11', './genba-calc.js?v=1.4.11', './zip.js?v=1.4.11', './cclwrite.js?v=1.4.11', './senkei.js?v=1.4.11', './layout.js?v=1.4.11', './proginfo.js?v=1.4.11', './pickxy.js?v=1.4.11'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE)
  .then(cache => cache.addAll(ASSETS.map(path => new Request(new URL(path, self.location.href), { cache: 'reload' }))))
  .then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pocket-calc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    // オンラインでは新しい画面を取得する。オフラインでは現在の版の画面を使う。
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(e.request, { ignoreSearch: true })) || cache.match('./index.html');
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async cache => (await cache.match(e.request)) || fetch(e.request)));
});
