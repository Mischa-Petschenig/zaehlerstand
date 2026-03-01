
var CACHE_NAME = 'zaehlerstand-v6';

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/storage.js',
  './js/data.js',
  './js/icons.js',
  './js/charts.js',
  './js/views.js',
  './js/app.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('Pre-cache partial failure:', err);
        return Promise.resolve();
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  if (request.url.indexOf('fonts.googleapis.com') !== -1 ||
      request.url.indexOf('fonts.gstatic.com') !== -1) {
    event.respondWith(
      caches.match(request).then(function(cached) {
        if (cached) return cached;
        return fetch(request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, clone);
            });
          }
          return response;
        }).catch(function() {
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then(function(response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(request).then(function(cached) {
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
