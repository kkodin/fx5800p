const CACHE = 'pocket-calc-v3-20261126-v1418';
const ASSETS = ['./', './index.html', './help.html', './style.css?v=1.4.18', './engine.js?v=1.4.18', './basic.js?v=1.4.18', './formulas.js?v=1.4.18', './import.js?v=1.4.18', './complete.js?v=1.4.18', './app.js?v=1.4.18', './curveview.js?v=1.4.18', './editor.html', './editor.css?v=1.4.18', './editor.js?v=1.4.18', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './genba.html', './genba.css?v=1.4.18', './angle.js?v=1.4.18', './geo.js?v=1.4.18', './points.js?v=1.4.18', './store.js?v=1.4.18', './dialog.js?v=1.4.18', './sokusetsu.js?v=1.4.18', './plot.js?v=1.4.18', './genba.js?v=1.4.18', './genba-calc.js?v=1.4.18', './zip.js?v=1.4.18', './cclwrite.js?v=1.4.18', './senkei.js?v=1.4.18', './layout.js?v=1.4.18', './proginfo.js?v=1.4.18', './pickxy.js?v=1.4.18'];
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
