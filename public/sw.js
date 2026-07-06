// Pharos Agent service worker — makes the PWA installable and keeps the shell
// available offline. Strategy: network-first for pages (fresh content, cached
// fallback when offline), cache-first for static assets (fonts, images, icons).
const CACHE = "pharos-agent-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API calls — they carry live prices, quotes, and rate limits.
  if (url.pathname.startsWith("/api/")) return;

  const isStatic = /\.(js|css|png|svg|jpg|jpeg|webp|woff2?|ico)$/.test(url.pathname) ||
    url.pathname.startsWith("/_next/static/");

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
    return;
  }

  // Pages: network first, cache fallback (offline).
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
  );
});
