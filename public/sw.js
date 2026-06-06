const DRIVER_HOST = "driver.hoptodrop.com";
const isDriverApp = self.location.hostname === DRIVER_HOST;
const CACHE_NAME = `hoptodrop-${isDriverApp ? "driver" : "rider"}-v3`;
const APP_SHELL = isDriverApp
  ? ["/", "/login", "/application", "/offline.html", "/manifest.webmanifest", "/driver-icon.svg"]
  : ["/", "/rider/login", "/rider/dashboard", "/offline.html", "/manifest.webmanifest", "/icon.svg", "/maskable-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/auth") || url.pathname.startsWith("/api")) return;
  if (url.hostname.includes("supabase.co") || url.hostname.includes("googleapis.com")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type === "opaque") return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => cached))
  );
});
