import { readFile } from "fs/promises";
import { AppNotificationType, UserRole } from "@/lib/enums";
import { notifyUserAppAndTelegram } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";
import { telegramSendPhoto } from "@/lib/telegramBotHelpers";
import { formatDateRu } from "@/lib/utils";
import { resolveReportPhotoDiskPath } from "@/lib/workplaceReportPhoto";

type EmployeeShiftNotifyType =
  | typeof AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE
  | typeof AppNotificationType.SHIFT_REMOVED_BY_EMPLOYEE;

/** Только ADMIN и SUPER_ADMIN (без isManager). */
export async function getAdminRoleUserIds(excludeUserIds: string[] = []): Promise<string[]> {
  const exclude = new Set(excludeUserIds);
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }
    },
    select: { id: true }
  });
  return rows.map((r) => r.id).filter((id) => !exclude.has(id));
}

/** Кому слать обзорные уведомления по графику: роли ADMIN/SUPER_ADMIN и руководители (isManager). */
export async function getScheduleMonitorUserIds(excludeUserIds: string[] = []): Promise<string[]> {
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

/** Колокольчик + Telegram только ADMIN и SUPER_ADMIN. */
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

/** Сотрудник сам поставил / снял смену (график, форма). Снятие — только ADMIN/SUPER_ADMIN в Telegram. */
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

  if (added) {
    await notifyScheduleAdmins({
      type: input.type,
      title,
      body,
      telegramText,
      payload: input.payload,
      excludeUserIds: input.excludeUserIds
    });
    return;
  }

  await notifyAdminRoleUsers({
    type: input.type,
    title,
    body,
    telegramText,
    payload: input.payload,
    excludeUserIds: input.excludeUserIds
  });
}

/** Новый отчёт по смене с фото — ADMIN/SUPER_ADMIN (колокольчик + фото в Telegram). */
export async function notifyAdminsShiftReportSubmitted(input: {
  reportId: string;
  shiftId: string;
  employeeName: string;
  brief: string;
  text: string;
}) {
  const preview =
    input.text.length > 280 ? `${input.text.slice(0, 277).trim()}…` : input.text.trim();
  const title = "Новый отчёт по смене";
  const body = `${input.employeeName}\n${input.brief}\n\n${preview}`;
  const telegramCaption = `📋 Отчёт по смене\n${input.employeeName}\n${input.brief}\n\n${preview}`.slice(0, 1024);

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
        telegramText: telegramCaption,
        skipTelegram: Boolean(photoBytes?.length)
      });

      if (!photoBytes?.length) return;
      const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true }
      });
      const chatId = row?.telegramId != null && row.telegramId !== "" ? Number(row.telegramId) : NaN;
      if (!Number.isFinite(chatId)) return;
      await telegramSendPhoto(chatId, photoBytes, telegramCaption);
    })
  );
}

/** Сотрудник впервые отметился на производстве (QR). */
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
