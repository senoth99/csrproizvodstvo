import { AppNotificationType, UserRole } from "@/lib/enums";
import { notifyUserAppAndTelegram } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";

type EmployeeShiftNotifyType =
  | typeof AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE
  | typeof AppNotificationType.SHIFT_REMOVED_BY_EMPLOYEE;

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

/** Сотрудник сам поставил / снял смену (график, форма). */
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
