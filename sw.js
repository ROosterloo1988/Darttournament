const CACHE = "darttournament-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/src/tournament-logic.js",
  "/src/web/store.js",
  "/src/web/tournament-app.js",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
