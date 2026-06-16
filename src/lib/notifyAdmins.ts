import { AppNotificationType, UserRole } from "@/lib/enums";
import { notifyUsersBatch } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";
import { formatDateRu } from "@/lib/utils";

type EmployeeShiftNotifyType =
  | typeof AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE
  | typeof AppNotificationType.SHIFT_REMOVED_BY_EMPLOYEE;

/** ADMIN и SUPER_ADMIN — уведомления по графику (без isManager). */
export async function getScheduleAdminOnlyUserIds(excludeUserIds: string[] = []): Promise<string[]> {
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

/** ADMIN, SUPER_ADMIN и руководители (isManager) — прочие админские уведомления. */
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

/** Колокольчик + push всем, кто следит за графиком (кроме excludeUserIds). */
export async function notifyScheduleAdmins(input: {
  type: EmployeeShiftNotifyType;
  title: string;
  body: string;
  payload?: unknown;
  excludeUserIds?: string[];
  pushUrl?: string;
}) {
  const userIds = await getScheduleMonitorUserIds(input.excludeUserIds ?? []);
  if (!userIds.length) return;

  await notifyUsersBatch(
    userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
      pushUrl: input.pushUrl ?? "/schedule"
    }))
  );
}

/** Колокольчик + push всем ADMIN/SUPER_ADMIN и руководителям (isManager). */
export async function notifyAdminRoleUsers(input: {
  type: string;
  title: string;
  body: string;
  payload?: unknown;
  excludeUserIds?: string[];
  pushUrl?: string;
}) {
  const userIds = await getAdminRoleUserIds(input.excludeUserIds ?? []);
  if (!userIds.length) return;

  await notifyUsersBatch(
    userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
      pushUrl: input.pushUrl ?? "/schedule"
    }))
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

  await notifyScheduleAdmins({
    type: input.type,
    title,
    body,
    payload: input.payload,
    excludeUserIds: input.excludeUserIds,
    pushUrl: "/schedule"
  });
}

/** Сотрудник просит снять смену — только ADMIN и SUPER_ADMIN. */
export async function notifyAdminsShiftRemovalRequest(input: {
  employeeName: string;
  brief: string;
  shiftId: string;
  userId: string;
}) {
  const userIds = await getScheduleAdminOnlyUserIds([input.userId]);
  if (!userIds.length) return;

  await notifyUsersBatch(
    userIds.map((userId) => ({
      userId,
      type: AppNotificationType.SHIFT_REMOVAL_REQUESTED,
      title: "Запрос на снятие смены",
      body: `${input.employeeName} просит снять смену: ${input.brief}`,
      payload: { shiftId: input.shiftId, userId: input.userId },
      pushUrl: "/schedule"
    }))
  );
}

/** Новый отчёт по смене — ADMIN/SUPER_ADMIN (колокольчик + push). */
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

  const userIds = await getAdminRoleUserIds();
  if (!userIds.length) return;

  await notifyUsersBatch(
    userIds.map((userId) => ({
      userId,
      type: AppNotificationType.SHIFT_REPORT_SUBMITTED,
      title,
      body,
      payload: { reportId: input.reportId, shiftId: input.shiftId },
      pushUrl: `/reports/${input.reportId}`
    }))
  );
}

/** Сотрудник отметился на производстве (QR), в т.ч. повторно. */
export async function notifyAdminsShiftArrival(input: { employeeName: string; arrivedAt: Date }) {
  const timeStr = formatDateRu(input.arrivedAt, "dd.MM.yyyy HH:mm");
  const body = `${input.employeeName} — ${timeStr}`;
  const userIds = await getAdminRoleUserIds();
  if (!userIds.length) return;

  await notifyUsersBatch(
    userIds.map((userId) => ({
      userId,
      type: AppNotificationType.SHIFT_ARRIVAL,
      title: "Приход на смену",
      body,
      pushUrl: "/manager"
    }))
  );
}
