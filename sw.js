const CACHE = 'pocket-calc-v3-20261127c-v1423';
const ASSETS = ['./', './index.html', './help.html', './style.css?v=1.4.23', './engine.js?v=1.4.23', './angle.js?v=1.4.23', './basic.js?v=1.4.23', './formulas.js?v=1.4.23', './import.js?v=1.4.23', './complete.js?v=1.4.23', './flick.js?v=1.4.23', './app.js?v=1.4.23', './curveview.js?v=1.4.23', './curveapp.js?v=1.4.23', './editor.html', './editor.css?v=1.4.23', './editor.js?v=1.4.23', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.23', './angle.js?v=1.4.23', './geo.js?v=1.4.23', './points.js?v=1.4.23', './store.js?v=1.4.23', './dialog.js?v=1.4.23', './sokusetsu.js?v=1.4.23', './plot.js?v=1.4.23', './genba.js?v=1.4.23', './genba-calc.js?v=1.4.23', './zip.js?v=1.4.23', './cclwrite.js?v=1.4.23', './senkei.js?v=1.4.23', './layout.js?v=1.4.23', './proginfo.js?v=1.4.23', './pickxy.js?v=1.4.23'];
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
