/* Offline support. Network first (so a deploy shows up right away), falling back to the last cached copy when
   there's no connection. Your tasks live in localStorage, so the app itself is all that needs caching.
   Bump VERSION with the ?v= numbers in index.html on every deploy. */
const VERSION = "atria-v6";

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: false }).then(hit => hit || caches.match(req, { ignoreSearch: true })).then(hit => hit || (req.mode === "navigate" ? caches.match("./") : undefined)))
  );
});
