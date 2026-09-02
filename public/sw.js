/* VÉRTIGO Cup — Service Worker de notificaciones push.
 * Registrado en /sw.js. Recibe los push del sistema (VAPID) y muestra
 * la notificación nativa; el click abre /notificaciones (o el link del
 * payload si viene).
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "VÉRTIGO Cup", body: "" };
  }
  const title = data.title || "VÉRTIGO Cup";
  const options = {
    body: data.body || "",
    icon: "/brand/logo-vertigo.webp",
    badge: "/brand/logo-vertigo.webp",
    data: { url: data.link || "/notificaciones" },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/notificaciones";
  const url = new URL(target, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin)) {
          return client.navigate(url).then((c) => c && c.focus());
        }
      }
      return clients.openWindow(url);
    })
  );
});
