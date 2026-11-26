/* FW Studio Workspace service worker.
   Makes the app installable and fast, WITHOUT ever caching live data:
   only the app shell (this page) is cached, network-first, and every
   Firebase / Google / Cloudflare (R2) request goes straight to the network. */
const V = "fwws-v3";

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

/* ---- Phone push notifications ---- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { try { d = { body: (e.data && e.data.text()) || "" }; } catch (__) {} }
  const p = d.data || d;                                  // FCM data messages arrive under .data; fall back to flat
  const title = p.title || "FW Workspace";
  const body = p.body || "";
  const taskId = p.taskId || "";
  const data = { url: p.url || "/fwstudioworkspace/", taskId };
  e.waitUntil(self.registration.showNotification(title, {
    body, data, icon: "./icon-192.png", badge: "./icon-192.png",
    tag: taskId || undefined, renotify: !!taskId
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/fwstudioworkspace/";
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if (c.url.includes("/fwstudioworkspace") && "focus" in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
