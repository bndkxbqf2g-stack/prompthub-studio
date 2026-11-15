const CACHE = "prompthub-static-v3";
const STATIC_ASSETS = ["/", "/styles.css", "/app.js", "/manifest.webmanifest", "/app-icon-source.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
