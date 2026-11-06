// Minimal service worker so phones can install The Loop. It doesn't cache your data: everything still comes live from the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;text-align:center;color:#15200f;background:#f7f9f5"><h1>You\'re offline</h1><p>The Loop needs an internet connection. Try again when you\'re back online.</p></body>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
