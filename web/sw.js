// Çevrimdışı çalışma: uygulama kabuğu önbelleğe alınır.
// Yeni sürüm yayınlandığında VERSION değişir, eski önbellek silinir.
const VERSION = "notdefteri-v28";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/db.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/ink.js",
  "./js/paper.js",
  "./js/covers.js",
  "./js/library.js",
  "./js/editor.js",
  "./js/panels.js",
  "./js/export.js",
  "./js/pages.js",
  "./js/settings.js",
  "./js/backup.js",
  "./js/addpage.js",
  "./js/flip.js",
  "./js/gestures.js",
  "./js/fan.js",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
