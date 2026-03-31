const CACHE_NAME = "herramienta-cajas-cache-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./caja.html",
  "./styles.css",
  "./app.js",
  "./admin.js",
  "./manifest.webmanifest"
];

function isSameOrigin(requestUrl) {
  return new URL(requestUrl).origin === self.location.origin;
}

function isStaticAsset(pathname) {
  return /\.(?:css|js|json|webmanifest|png|jpg|jpeg|svg|ico)$/i.test(pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (!isSameOrigin(request.url)) return;

  const url = new URL(request.url);

  // Network-first for HTML/navigation keeps users on latest UI.
  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("./index.html");
        })
    );
    return;
  }

  if (!isStaticAsset(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
