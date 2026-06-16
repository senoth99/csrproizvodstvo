import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let vapidConfigured = false;

/** Настраивает VAPID из env; false, если ключи не заданы. */
export function configureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  return publicKey || null;
}

function resolvePushUrl(url?: string): string {
  const base = resolveAppPublicBaseUrl();
  if (!url?.trim()) return `${base}/me`;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  notification: PushNotificationPayload
): Promise<{ ok: true } | { ok: false; statusCode?: number; gone?: boolean }> {
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: resolvePushUrl(notification.url),
    tag: notification.tag ?? undefined
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      payload
    );
    return { ok: true };
  } catch (e) {
    const statusCode =
      e && typeof e === "object" && "statusCode" in e ? Number((e as { statusCode: unknown }).statusCode) : undefined;
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, statusCode, gone: true };
    }
    console.error("[sendPushToSubscription]", subscription.endpoint.slice(0, 48), e);
    return { ok: false, statusCode };
  }
}

/** Browser push одному пользователю (все его подписки). */
export async function sendPushToUser(userId: string, notification: PushNotificationPayload) {
  if (!configureVapid()) return { sent: 0, removed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true }
  });
  if (!subscriptions.length) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushToSubscription(sub, notification);
      if (result.ok) {
        sent += 1;
        return;
      }
      if (result.gone) staleIds.push(sub.id);
    })
  );

  if (staleIds.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
    removed = staleIds.length;
  }

  return { sent, removed };
}

/** Browser push нескольким пользователям параллельно. */
export async function sendPushToUsers(userIds: string[], notification: PushNotificationPayload) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return { sent: 0, removed: 0 };

  const results = await Promise.all(unique.map((userId) => sendPushToUser(userId, notification)));
  return results.reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, removed: acc.removed + r.removed }),
    { sent: 0, removed: 0 }
  );
}
