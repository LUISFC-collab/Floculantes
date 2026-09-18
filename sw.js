/* Service worker — Parte de obra (Water Transition II)
   Guarda la app en el telefono y la abre con la copia (rapido y sin conexion);
   la copia se renueva por detras y la version nueva llega por _forceUpdate. Cambia CACHE en cada despliegue para no servir data vieja. */
const CACHE = 'floculantes-v20260918b7';
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
  /* COPIA PRIMERO: la app abre al instante con lo guardado (y sin red), y
     la copia se renueva por detras. Al salir una version nueva, la pagina
     da de baja este SW y borra los caches propios antes de recargar, asi
     que la recarga trae la version nueva de la red. */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      var red = fetch(req, { cache: 'reload' })
        .then(function (res) {
          if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {}); }
          return res;
        })
        .catch(function () { return null; });
      if (cached) { try { e.waitUntil(red); } catch (_) {} return cached; }
      return red.then(function (r) { return r || caches.match('./index.html'); });
    })
  );
});
