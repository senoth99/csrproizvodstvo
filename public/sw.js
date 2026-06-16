/* global self */
/* Service worker: Web Push + кэш аватаров */

const AVATAR_CACHE = "avatar-images-v1";

function isAvatarRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.pathname === "/api/users/avatar") return true;
  if (request.destination !== "image") return false;
  return /telegram/i.test(url.hostname) || url.hostname === "t.me";
}

async function staleWhileRevalidateAvatar(request) {
  const cache = await caches.open(AVATAR_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkFetch;
    return cached;
  }

  const fresh = await networkFetch;
  if (fresh) return fresh;
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!isAvatarRequest(event.request, url)) return;
  event.respondWith(staleWhileRevalidateAvatar(event.request));
});

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
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            await client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
