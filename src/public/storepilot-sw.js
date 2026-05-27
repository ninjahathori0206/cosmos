/* Store Pilot PWA — Service Worker
   Scope: registered at / — only caches Store Pilot shell + shared static assets + login.
   Strategy: network-only for /api/*; network-first for /js/* and /css/*; cache-first fallback for other static. */

var CACHE_NAME = 'storepilot-v6-pwa-update';

var SHELL_URLS = [
  '/',
  '/login.html',
  '/storepilot/dashboard',
  '/css/cosmos-ui-polish.css',
  '/css/fonts.css',
  '/js/cosmos-ui-polish.js',
  '/js/cosmos-modules-catalog.js',
  '/js/cosmos-module-switch.js',
  '/js/cosmos-bucket-scan.js',
  '/js/cosmos-record-list.js',
  '/js/storepilot-prototype.js',
  '/js/storepilot-pwa.js',
  '/js/cosmos-pwa-update.js',
  '/js/login.js',
  '/storepilot-manifest.json',
  '/config/bootstrap.json',
  '/img/storepilot-icon-192.png',
  '/img/storepilot-icon-512.png',
  '/favicon.ico'
];

var MODULE_PREFIXES = ['/storepilot', '/css/', '/js/', '/img/', '/config/', '/favicon.ico'];

function isStorePilotNavigation(request) {
  if (request.mode === 'navigate') return true;
  return request.destination === 'document';
}

function isAllowedStaticPath(pathname) {
  if (pathname === '/' || pathname === '/login.html') return true;
  for (var i = 0; i < MODULE_PREFIXES.length; i++) {
    if (pathname.indexOf(MODULE_PREFIXES[i]) === 0) return true;
  }
  return pathname === '/storepilot-manifest.json';
}

function isNetworkFirstStatic(pathname) {
  return pathname.indexOf('/js/') === 0 || pathname.indexOf('/css/') === 0;
}

function shouldHandleFetch(url, request) {
  if (request.method !== 'GET') return false;
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.indexOf('/storepilot') === 0) return true;
  if (isAllowedStaticPath(url.pathname)) return true;
  return false;
}

function cachePutOnOk(request, response) {
  if (response && response.status === 200 && request.method === 'GET') {
    var clone = response.clone();
    caches.open(CACHE_NAME).then(function (cache) {
      cache.put(request, clone);
    });
  }
}

function networkFirstStatic(request, url) {
  return fetch(request).then(function (res) {
    cachePutOnOk(request, res);
    return res;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      return caches.match(url.pathname, { ignoreSearch: true });
    });
  });
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

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  if (url.pathname.indexOf('/storepilot') === 0 && isStorePilotNavigation(e.request)) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match('/').then(function (cached) {
          return cached || caches.match('/login.html');
        });
      })
    );
    return;
  }

  if (!isAllowedStaticPath(url.pathname) && url.pathname.indexOf('/storepilot') !== 0) {
    return;
  }

  if (isNetworkFirstStatic(url.pathname)) {
    e.respondWith(networkFirstStatic(e.request, url));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var networkFetch = fetch(e.request).then(function (res) {
        cachePutOnOk(e.request, res);
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
