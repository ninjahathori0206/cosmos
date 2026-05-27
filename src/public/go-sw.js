/* Eyewoot Go — Service Worker
   Strategy: network-first for API, cache-first for static shell */

var CACHE_NAME = 'eyewoot-go-v2-pwa-update';
var SHELL_URLS = [
  '/go',
  '/css/go.css',
  '/css/cosmos-ui-polish.css',
  '/js/cosmos-ui-polish.js',
  '/js/cosmos-pwa-update.js',
  '/js/go.js',
  '/go-manifest.json'
];

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

  /* API calls — network only (never cache) */
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  /* Static shell — cache-first, fall back to network */
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var networkFetch = fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.method === 'GET') {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
        }
        return res;
      });
      return cached || networkFetch;
    })
  );
});
