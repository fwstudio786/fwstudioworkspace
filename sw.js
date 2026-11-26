/* FW Studio Workspace service worker.
   Makes the app installable and fast, WITHOUT ever caching live data:
   only the app shell (this page) is cached, network-first, and every
   Firebase / Google / Cloudflare (R2) request goes straight to the network. */
const V = "fwws-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then((c) => c.addAll(["./", "./index.html"]).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.map((k) => (k === V ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // never touch uploads / writes
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return;       // Firebase, gstatic, R2, Google APIs -> always live network

  if (req.mode === "navigate") {                    // app shell: network-first, fall back to cache offline
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put("./index.html", cp)).catch(() => {}); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
