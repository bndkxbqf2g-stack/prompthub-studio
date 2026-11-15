const CACHE_PREFIX = "prompthub-static-";
const CACHE = "prompthub-static-v5";
const STATIC_ASSETS = ["/", "/styles.css", "/app.js", "/strategy-presentation.mjs", "/service-worker-client.mjs", "/regression-test-request.js", "/manifest.webmanifest", "/app-icon-source.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PROMPTHUB_ACTIVATE_UPDATE") return;
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname === "/healthz" || event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

