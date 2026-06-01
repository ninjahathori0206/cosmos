/* Store OS PWA — Service Worker
   Scope: /storeos/ — caches Store OS shell + shared static assets under allowed paths.
   Strategy: network-only for /api/*; network-first for /storeos navigations; cache-first for allowed static GET. */

var CACHE_NAME = 'storeos-v8-lab-edit-lenses';

var SHELL_URLS = [
  '/storeos/login',
  '/css/cosmos-ui-polish.css',
  '/css/pos.css',
  '/css/lenskart-pos.css',
  '/css/fonts.css',
  '/js/cosmos-ui-polish.js',
  '/js/cosmos-bucket-scan.js',
  '/js/jsQR.min.js',
  '/js/pos-order-queue-catalog.js',
  '/js/pos.js',
  '/js/storeos-pwa.js',
  '/js/cosmos-pwa-update.js',
  '/storeos-manifest.json',
  '/config/bootstrap.json',
  '/img/storeos-icon-192.png',
  '/img/storeos-icon-512.png',
  '/favicon.ico'
];

var ALLOWED_PREFIXES = ['/storeos', '/css/', '/js/', '/img/', '/config/', '/favicon.ico'];

function isStoreOsNavigation(request) {
  if (request.mode === 'navigate') return true;
  return request.destination === 'document';
}

function isAllowedStaticPath(pathname) {
  if (pathname === '/storeos-manifest.json') return true;
  for (var i = 0; i < ALLOWED_PREFIXES.length; i++) {
    if (pathname.indexOf(ALLOWED_PREFIXES[i]) === 0) return true;
  }
  return false;
}

function shouldHandleFetch(url, request) {
  if (request.method !== 'GET') return false;
  /* API — never intercept; browser handles network errors for fetch() in app JS */
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.indexOf('/storeos') === 0) return true;
  return isAllowedStaticPath(url.pathname);
}

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_URLS);
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k)   { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (!shouldHandleFetch(url, e.request)) return;

  if (url.pathname.indexOf('/storeos') === 0 && isStoreOsNavigation(e.request)) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match('/storeos/login');
      })
    );
    return;
  }

  if (!isAllowedStaticPath(url.pathname) && url.pathname.indexOf('/storeos') !== 0) {
    return;
  }

  if (/\.(js|css)$/i.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.method === 'GET' && isAllowedStaticPath(url.pathname)) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
            cache.put(url.pathname, res.clone());
          });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || caches.match(url.pathname, { ignoreSearch: true });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var networkFetch = fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.method === 'GET' && isAllowedStaticPath(url.pathname)) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return res;
      }).catch(function () {
        return caches.match(url.pathname, { ignoreSearch: true });
      });
      return cached || caches.match(e.request, { ignoreSearch: true }).then(function (pathCached) {
        return pathCached || networkFetch;
      });
    })
  );
});
