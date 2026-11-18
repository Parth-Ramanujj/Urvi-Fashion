// Minimal service worker: makes the app installable and shows a friendly page when a navigation fails offline.
// Network-first for everything (prices/stock must stay live); only static Next assets are cached.
const STATIC = "store-static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
      '<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">' +
      '<div><div style="font-size:48px">📶</div><h1>You\'re offline</h1><p style="color:#71717a">Check your connection and try again.</p>' +
      '<button onclick="location.reload()" style="padding:12px 24px;border-radius:999px;border:0;background:#18181b;color:#fff;font-weight:600">Retry</button></div>',
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    )));
  }
});
