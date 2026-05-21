import { AppNotificationType, UserRole } from "@/lib/enums";
import { notifyUserAppAndTelegram } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";

type EmployeeShiftNotifyType =
  | typeof AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE
  | typeof AppNotificationType.SHIFT_REMOVED_BY_EMPLOYEE;

/** Колокольчик + Telegram всем активным ADMIN и SUPER_ADMIN. */
export async function notifyAdminsEmployeeShiftChange(input: {
  type: EmployeeShiftNotifyType;
  employeeName: string;
  brief: string;
  payload?: unknown;
}) {
  const admins = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }
    },
    select: { id: true }
  });
  if (!admins.length) return;

  const added = input.type === AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE;
  const title = added ? "Сотрудник записался на смену" : "Сотрудник снял смену";
  const body = `${input.employeeName}: ${input.brief}`;
  const telegramText = added
    ? `📅 ${input.employeeName} записался на смену:\n${input.brief}`
    : `📅 ${input.employeeName} снял смену:\n${input.brief}`;

  await Promise.all(
    admins.map((admin) =>
      notifyUserAppAndTelegram({
        userId: admin.id,
        type: input.type,
        title,
        body,
        payload: input.payload,
        telegramText
      })
    )
  );
}
