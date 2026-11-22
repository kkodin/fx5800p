const CACHE = 'pocket-calc-v3-20261122-v1412';
const ASSETS = ['./', './index.html', './help.html', './style.css?v=1.4.12', './engine.js?v=1.4.12', './basic.js?v=1.4.12', './formulas.js?v=1.4.12', './import.js?v=1.4.12', './complete.js?v=1.4.12', './app.js?v=1.4.12', './editor.html', './editor.css?v=1.4.12', './editor.js?v=1.4.12', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.12', './angle.js?v=1.4.12', './geo.js?v=1.4.12', './points.js?v=1.4.12', './store.js?v=1.4.12', './dialog.js?v=1.4.12', './sokusetsu.js?v=1.4.12', './plot.js?v=1.4.12', './genba.js?v=1.4.12', './genba-calc.js?v=1.4.12', './zip.js?v=1.4.12', './cclwrite.js?v=1.4.12', './senkei.js?v=1.4.12', './layout.js?v=1.4.12', './proginfo.js?v=1.4.12', './pickxy.js?v=1.4.12'];
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
