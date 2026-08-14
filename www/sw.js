const CACHE_VERSION = "foundry-v25";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./plans.js",
  "./exercise-info.js",
  "./storage.js",
  "./charts.js",
  "./app.js",
  "./sync.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/logo.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./chart.umd.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { mode: url.startsWith("http") ? "no-cors" : "same-origin" })).catch(() => {})
        )
      );
    })
    // No skipWaiting here: new versions wait until the person taps the
    // update banner, so a deploy never reloads the app mid-workout.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve from cache instantly, refresh cache in background.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
          });
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// The update banner asks the waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
