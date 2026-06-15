import { readFile } from "fs/promises";
import { AppNotificationType, UserRole } from "@/lib/enums";
import { notifyUserAppAndTelegram } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";
import { telegramSendMessage, telegramSendPhoto } from "@/lib/telegramBotHelpers";
import { formatDateRu } from "@/lib/utils";
import { resolveReportPhotoDiskPath } from "@/lib/workplaceReportPhoto";
import { resolveUserTelegramChatId } from "@/lib/telegramChatId";

type EmployeeShiftNotifyType =
  | typeof AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE
  | typeof AppNotificationType.SHIFT_REMOVED_BY_EMPLOYEE;

/** ADMIN, SUPER_ADMIN и руководители (isManager) — все админские уведомления. */
export async function getAdminRoleUserIds(excludeUserIds: string[] = []): Promise<string[]> {
  const exclude = new Set(excludeUserIds);
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } }, { isManager: true }]
    },
    select: { id: true }
  });
  return rows.map((r) => r.id).filter((id) => !exclude.has(id));
}

/** @deprecated Алиас — используйте getAdminRoleUserIds */
export async function getScheduleMonitorUserIds(excludeUserIds: string[] = []): Promise<string[]> {
  return getAdminRoleUserIds(excludeUserIds);
}

/** Колокольчик + Telegram всем, кто следит за графиком (кроме excludeUserIds). */
export async function notifyScheduleAdmins(input: {
  type: EmployeeShiftNotifyType;
  title: string;
  body: string;
  telegramText: string;
  payload?: unknown;
  excludeUserIds?: string[];
}) {
  const userIds = await getScheduleMonitorUserIds(input.excludeUserIds ?? []);
  if (!userIds.length) return;

  await Promise.all(
    userIds.map((userId) =>
      notifyUserAppAndTelegram({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload,
        telegramText: input.telegramText
      })
    )
  );
}

/** Колокольчик + Telegram всем ADMIN/SUPER_ADMIN и руководителям (isManager). */
export async function notifyAdminRoleUsers(input: {
  type: string;
  title: string;
  body: string;
  telegramText: string;
  payload?: unknown;
  excludeUserIds?: string[];
}) {
  const userIds = await getAdminRoleUserIds(input.excludeUserIds ?? []);
  if (!userIds.length) return;

  await Promise.all(
    userIds.map((userId) =>
      notifyUserAppAndTelegram({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload,
        telegramText: input.telegramText
      })
    )
  );
}

/** Сотрудник сам поставил / снял смену — всем ADMIN/SUPER_ADMIN и isManager. */
export async function notifyAdminsEmployeeShiftChange(input: {
  type: EmployeeShiftNotifyType;
  employeeName: string;
  brief: string;
  payload?: unknown;
  /** Обычно id сотрудника, чтобы не дублировать личное уведомление. */
  excludeUserIds?: string[];
}) {
  const added = input.type === AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE;
  const title = added ? "Сотрудник записался на смену" : "Сотрудник снял смену";
  const body = `${input.employeeName}: ${input.brief}`;
  const telegramText = added
    ? `📅 ${input.employeeName} записался на смену:\n${input.brief}`
    : `📅 ${input.employeeName} снял смену:\n${input.brief}`;

  await notifyScheduleAdmins({
    type: input.type,
    title,
    body,
    telegramText,
    payload: input.payload,
    excludeUserIds: input.excludeUserIds
  });
}

const TELEGRAM_PHOTO_CAPTION_MAX = 1024;
const TELEGRAM_MESSAGE_MAX = 4090;

function chunkTelegramText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks;
}

/** Подпись к фото (≤1024) + остаток отчёта отдельными сообщениями (≤4090). */
function buildShiftReportTelegramParts(header: string, reportText: string): {
  caption: string;
  followUpMessages: string[];
} {
  const full = `${header}\n\n${reportText}`;
  if (full.length <= TELEGRAM_PHOTO_CAPTION_MAX) {
    return { caption: full, followUpMessages: [] };
  }

  const prefix = `${header}\n\n`;
  const room = TELEGRAM_PHOTO_CAPTION_MAX - prefix.length - 1;
  if (room <= 0) {
    return {
      caption: header.slice(0, TELEGRAM_PHOTO_CAPTION_MAX),
      followUpMessages: chunkTelegramText(reportText, TELEGRAM_MESSAGE_MAX)
    };
  }

  const inCaption = reportText.slice(0, room);
  const rest = reportText.slice(room);
  const caption = rest.length ? `${prefix}${inCaption}…` : `${prefix}${inCaption}`;
  return {
    caption,
    followUpMessages: rest.length ? chunkTelegramText(rest, TELEGRAM_MESSAGE_MAX) : []
  };
}

async function sendShiftReportTelegram(
  chatId: number,
  photoBytes: Buffer | null,
  header: string,
  reportText: string
) {
  const { caption, followUpMessages } = buildShiftReportTelegramParts(header, reportText);

  if (photoBytes?.length) {
    await telegramSendPhoto(chatId, photoBytes, caption);
  } else {
    const chunks = chunkTelegramText(`${header}\n\n${reportText}`, TELEGRAM_MESSAGE_MAX);
    await telegramSendMessage(chatId, chunks[0] ?? header);
    for (let i = 1; i < chunks.length; i++) {
      await telegramSendMessage(chatId, chunks[i]!);
    }
    return;
  }

  for (const part of followUpMessages) {
    await telegramSendMessage(chatId, part);
  }
}

/** Новый отчёт по смене с фото — ADMIN/SUPER_ADMIN (колокольчик + фото в Telegram). */
export async function notifyAdminsShiftReportSubmitted(input: {
  reportId: string;
  shiftId: string;
  employeeName: string;
  brief: string;
  text: string;
}) {
  const reportText = input.text.trim();
  const title = "Новый отчёт по смене";
  const body = `${input.employeeName}\n${input.brief}\n\n${reportText}`;
  const telegramHeader = `📋 Отчёт по смене\n${input.employeeName}\n${input.brief}`;

  const userIds = await getAdminRoleUserIds();
  if (!userIds.length) return;

  const photoPath = resolveReportPhotoDiskPath(input.shiftId);
  let photoBytes: Buffer | null = null;
  if (photoPath) {
    try {
      photoBytes = await readFile(photoPath);
    } catch {
      photoBytes = null;
    }
  }

  await Promise.all(
    userIds.map(async (userId) => {
      await notifyUserAppAndTelegram({
        userId,
        type: AppNotificationType.SHIFT_REPORT_SUBMITTED,
        title,
        body,
        payload: { reportId: input.reportId, shiftId: input.shiftId },
        skipTelegram: true
      });

      const chatId = await resolveUserTelegramChatId(userId);
      if (chatId == null) return;

      await sendShiftReportTelegram(chatId, photoBytes, telegramHeader, reportText);
    })
  );
}

/** Сотрудник отметился на производстве (QR), в т.ч. повторно. */
export async function notifyAdminsShiftArrival(input: { employeeName: string; arrivedAt: Date }) {
  const timeStr = formatDateRu(input.arrivedAt, "dd.MM.yyyy HH:mm");
  const body = `${input.employeeName} — ${timeStr}`;
  const telegramText = `🏭 Приход на смену\n${input.employeeName}\n${timeStr}`;
  const userIds = await getAdminRoleUserIds();
  if (!userIds.length) return;

  await Promise.all(
    userIds.map((userId) =>
      notifyUserAppAndTelegram({
        userId,
        type: AppNotificationType.SHIFT_ARRIVAL,
        title: "Приход на смену",
        body,
        telegramText
      })
    )
  );
}
