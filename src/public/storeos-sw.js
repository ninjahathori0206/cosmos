/* Store OS — Service Worker
   Strategy: network-only for API; network-first for /storeos navigations; cache-first for static assets */

var CACHE_NAME = 'storeos-v1';
var SHELL_URLS = [
  '/storeos/login',
  '/css/cosmos-ui-polish.css',
  '/css/pos.css?v=sos-shell-2026c',
  '/css/lenskart-pos.css?v=storeos-20260608b',
  '/js/cosmos-ui-polish.js',
  '/js/pos.js?v=storeos-20260515-catalogue-brands-multi',
  '/storeos-manifest.json'
];

function isStoreOsNavigation(request) {
  if (request.mode === 'navigate') return true;
  return request.destination === 'document';
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_URLS);
    }).then(function () {
      return self.skipWaiting();
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

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  if (url.pathname.indexOf('/storeos') === 0 && isStoreOsNavigation(e.request)) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match('/storeos/login');
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var networkFetch = fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.method === 'GET') {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return res;
      });
      return cached || networkFetch;
    })
  );
});
