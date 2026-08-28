/* Service worker — Parte de obra (Water Transition II)
   Guarda la app en el telefono y la abre SIN conexion, pero SIEMPRE trae la version
   mas nueva cuando hay internet. Cambia CACHE en cada despliegue para no servir data vieja. */
const CACHE = 'floculantes-v20260827a5';
const SHELL = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png', './heic2any.min.js'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  /* OJO: CacheStorage se comparte por DOMINIO con la pagina de TESTEO (WaterTransition).
     Solo se borran caches PROPIOS (floculantes-*) — nunca los de la otra pagina. */
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE && (k.indexOf('floculantes-') === 0 || k.indexOf('obra-feable-') === 0); }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('version.txt') > -1) return;
  e.respondWith(
    fetch(req, { cache: 'reload' })
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      })
      .catch(function () { return caches.match(req).then(function (r) { return r || caches.match('./index.html'); }); })
  );
});
