/* global self */
/* Service worker: Web Push для production-scheduler */

self.addEventListener("push", (event) => {
  let data = { title: "Уведомление", body: "", url: "/me", tag: undefined };

  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        data = {
          title: typeof parsed.title === "string" ? parsed.title : data.title,
          body: typeof parsed.body === "string" ? parsed.body : data.body,
          url: typeof parsed.url === "string" ? parsed.url : data.url,
          tag: typeof parsed.tag === "string" ? parsed.tag : undefined
        };
      }
    }
  } catch {
    const text = event.data?.text?.();
    if (text) data.body = text;
  }

  const options = {
    body: data.body,
    icon: "/brand-logo.png",
    badge: "/brand-logo.png",
    tag: data.tag,
    data: { url: data.url },
    renotify: Boolean(data.tag)
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/me";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            await client.navigate(rawUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(rawUrl);
      }
    })()
  );
});
