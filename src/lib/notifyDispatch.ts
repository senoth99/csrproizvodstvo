import { prisma } from "@/lib/prisma";
import { telegramSendMessage } from "@/lib/telegramBotHelpers";
import { resolveUserTelegramChatId } from "@/lib/telegramChatId";
import { sendPushToUser } from "@/lib/webPush";

/** Максимум записей в колокольчике на одного пользователя; более старые удаляются. */
export const MAX_APP_NOTIFICATIONS_PER_USER = 10;

/** Удаляет уведомления пользователя старее N самых новых (по `createdAt`). */
async function trimAppNotificationsForUserTx(
  tx: Pick<typeof prisma, "appNotification">,
  userId: string
) {
  const excess = await tx.appNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: MAX_APP_NOTIFICATIONS_PER_USER,
    select: { id: true }
  });
  if (!excess.length) return;
  await tx.appNotification.deleteMany({
    where: { id: { in: excess.map((r) => r.id) } }
  });
}

/** Удаляет уведомления пользователя старее N самых новых (по `createdAt`). */
export async function trimAppNotificationsForUser(userId: string) {
  await trimAppNotificationsForUserTx(prisma, userId);
}

type AppNotificationInsert = {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: unknown;
  swapRequestId?: string | null;
};

export type NotifyUserInput = AppNotificationInsert & {
  pushUrl?: string;
  pushTag?: string;
  /** Не слать TG (например, если отдельно уходит сообщение с кнопками). По умолчанию TG выключен. */
  skipTelegram?: boolean;
  telegramText?: string;
};

function toNotificationRow(input: AppNotificationInsert) {
  return {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    payload: input.payload != null ? JSON.stringify(input.payload) : null,
    swapRequestId: input.swapRequestId ?? null
  };
}

function resolveNotificationUrl(input: { pushUrl?: string; payload?: unknown }): string | undefined {
  if (input.pushUrl?.trim()) return input.pushUrl.trim();
  if (input.payload && typeof input.payload === "object" && input.payload !== null) {
    const reportId = (input.payload as { reportId?: unknown }).reportId;
    if (typeof reportId === "string" && reportId) return `/reports/${reportId}`;
  }
  return undefined;
}

/** Одна транзакция: createMany + trim по каждому userId. */
export async function insertAppNotificationsBatch(inputs: AppNotificationInsert[]) {
  if (!inputs.length) return;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.appNotification.createMany({
        data: inputs.map(toNotificationRow)
      });
      const userIds = [...new Set(inputs.map((input) => input.userId))];
      for (const userId of userIds) {
        await trimAppNotificationsForUserTx(tx, userId);
      }
    });
  } catch (e) {
    console.error(
      "[insertAppNotificationsBatch] Не удалось записать уведомления. Выполните `npx prisma generate` и примените схему к БД.",
      e
    );
  }
}

/** Запись в колокольчике приложения (без push/Telegram). */
export async function insertAppNotification(input: AppNotificationInsert) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.appNotification.create({
        data: toNotificationRow(input)
      });
      await trimAppNotificationsForUserTx(tx, input.userId);
    });
  } catch (e) {
    console.error(
      "[insertAppNotification] Не удалось записать уведомление. Выполните `npx prisma generate` и примените схему к БД.",
      e
    );
  }
}

/** Колокольчик + browser push (+ опционально Telegram). */
export async function notifyUser(input: NotifyUserInput) {
  try {
    await insertAppNotification(input);

    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      url: resolveNotificationUrl({ pushUrl: input.pushUrl, payload: input.payload }),
      tag: input.pushTag ?? input.type
    });

    if (input.skipTelegram !== false) return;

    const chatId = await resolveUserTelegramChatId(input.userId);
    if (chatId == null) return;

    const text = input.telegramText ?? `${input.title}\n\n${input.body}`.trim();
    await telegramSendMessage(chatId, text.slice(0, 4090));
  } catch (e) {
    console.error("[notifyUser]", input.type, e);
  }
}

/** Одна транзакция для in-app уведомлений; push/TG — параллельно после записи. */
export async function notifyUsersBatch(inputs: NotifyUserInput[]) {
  if (!inputs.length) return;
  try {
    await insertAppNotificationsBatch(inputs);

    await Promise.all(
      inputs.map((input) =>
        sendPushToUser(input.userId, {
          title: input.title,
          body: input.body,
          url: resolveNotificationUrl({ pushUrl: input.pushUrl, payload: input.payload }),
          tag: input.pushTag ?? input.type
        })
      )
    );

    const telegramJobs = inputs.filter((input) => input.skipTelegram === false);
    await Promise.all(
      telegramJobs.map(async (input) => {
        const chatId = await resolveUserTelegramChatId(input.userId);
        if (chatId == null) return;
        const text = input.telegramText ?? `${input.title}\n\n${input.body}`.trim();
        await telegramSendMessage(chatId, text.slice(0, 4090));
      })
    );
  } catch (e) {
    console.error("[notifyUsersBatch]", e);
  }
}

/** @deprecated Алиас — используйте notifyUser; TG по умолчанию включён, push всегда. */
export function notifyUserAppAndTelegram(input: NotifyUserInput) {
  return notifyUser({
    ...input,
    skipTelegram: input.skipTelegram === true
  });
}

/** @deprecated Алиас — используйте notifyUsersBatch */
export const notifyUsersAppAndTelegramBatch = notifyUsersBatch;
