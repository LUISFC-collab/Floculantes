/* Service worker — Parte de obra (Water Transition II)
   Guarda la app en el telefono y la abre con la copia (rapido y sin conexion);
   la copia se renueva por detras y la version nueva llega por _forceUpdate. Cambia CACHE en cada despliegue para no servir data vieja. */
const CACHE = 'floculantes-v20260920b73';
/* lo que la app necesita para abrir sin red */
const SHELL = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];
/* lo pesado (fotos HEIC y las plantillas de los reportes, unos 5 MB): se guarda por detras, no retrasa la activacion */
const EXTRA = ['./heic2any.min.js', './panel.xlsx', './plantilla_semanal.xlsx', './lookahead.xlsx', './analisis.xlsx'];

/* Una sola llave por archivo, SIN la parte ?v=...: antes cada apertura con otra
   ?v= guardaba otra copia entera de index.html (4 MB cada una). La raiz y
   index.html comparten llave. */
function llave(u) {
  var x = new URL(u, self.location.href);
  var p = x.pathname;
  if (p.charAt(p.length - 1) === '/') p += 'index.html';
  return x.origin + p;
}
/* cada archivo por su cuenta: si uno falla (p. ej. un redireccionamiento), los
   demas se guardan igual. Antes addAll tiraba todo el lote a la primera falla. */
function guarda(c, lista) {
  return Promise.all(lista.map(function (u) {
    return fetch(u, { cache: 'reload' }).then(function (r) {
      if (r && r.ok) return c.put(llave(u), r.clone());
    }).catch(function () {});
  }));
}

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return guarda(c, SHELL).then(function () { guarda(c, EXTRA); });
  }));
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
  var k = llave(req.url);
  /* COPIA PRIMERO: la app abre al instante con lo guardado (y sin red), y
     la copia se renueva por detras. Al salir una version nueva, la pagina
     da de baja este SW y borra los caches propios antes de recargar, asi
     que la recarga trae la version nueva de la red. */
  e.respondWith(
    caches.match(k).then(function (cached) {
      var red = fetch(req, { cache: cached ? 'no-cache' : 'reload' })
        .then(function (res) {
          if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(k, copy); }).catch(function () {}); }
          return res;
        })
        .catch(function () { return null; });
      if (cached) { try { e.waitUntil(red); } catch (_) {} return cached; }
      /* sin red y sin copia: una navegacion cae a la app guardada */
      return red.then(function (r) { return r || ((req.mode === 'navigate' || req.destination === 'document') ? caches.match(llave('./')) : undefined); });
    })
  );
});
