const CACHE_NAME = 'book-tracker-cache-v1';
const urlsToCache = [
  '/', // Alias for index.html
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  // Add icon paths if you want them cached immediately
  // 'images/icons/icon-72x72.png',
  // 'images/icons/icon-96x96.png',
  // 'images/icons/icon-128x128.png',
  // 'images/icons/icon-144x144.png',
  // 'images/icons/icon-152x152.png',
  // 'images/icons/icon-192x192.png',
  // 'images/icons/icon-384x384.png',
  // 'images/icons/icon-512x512.png'
  // Add other static assets like fonts if needed
];

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        self.skipWaiting(); // Activate worker immediately
      })
      .catch(error => {
        console.error('Service Worker: Caching failed', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim(); // Take control of uncontrolled clients
    })
  );
});

// Fetch event: Serve cached assets first, fallback to network
self.addEventListener('fetch', event => {
  console.log('Service Worker: Fetching', event.request.url);
  // Let the browser handle requests for extensions or non-GET requests
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
     return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Serve from cache
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }
        // Not in cache, fetch from network
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // Optional: Cache dynamically fetched resources if needed
            // Be careful caching everything, especially API responses unless intended
            // if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            //   const responseToCache = networkResponse.clone();
            //   caches.open(CACHE_NAME)
            //     .then(cache => {
            //       cache.put(event.request, responseToCache);
            //     });
            // }
            return networkResponse;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed', error);
            // Optional: Return a fallback offline page/resource
            // return caches.match('offline.html');
          });
      })
  );
});
