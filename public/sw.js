// Minimal service worker so phones can install The Loop. It doesn't cache your data: everything still comes live from the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;text-align:center;color:#15200f;background:#f7f9f5"><h1>You\'re offline</h1><p>loop needs an internet connection. Try again when you\'re back online.</p></body>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});

// Notifications: show what the server sent, and open loop when it's tapped.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "loop", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "loop", {
    body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
    tag: d.tag, data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin)) return c.focus();
    return self.clients.openWindow(url);
  }));
});
