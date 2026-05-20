/* Store Pilot PWA — Service Worker
   Scope: registered at / — only caches Store Pilot shell + shared static assets + login.
   Strategy: network-only for /api/*; network-first for /storepilot navigations; cache-first for allowed static GET. */

var CACHE_NAME = 'storepilot-v1';

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
  '/js/storepilot-prototype.js',
  '/js/storepilot-pwa.js',
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

function shouldHandleFetch(url, request) {
  if (request.method !== 'GET') return false;
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.indexOf('/storepilot') === 0) return true;
  if (isAllowedStaticPath(url.pathname)) return true;
  return false;
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
      });
      return cached || networkFetch;
    })
  );
});
