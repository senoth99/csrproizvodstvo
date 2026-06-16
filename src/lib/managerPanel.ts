import { UserRole } from "@/lib/enums";

/** Пункт «Панель» у суперадмина и у помеченных руководителей (отчёты, выплаты — не график). */
export function canOpenManagerPanel(user: { role: string; isManager: boolean }): boolean {
  return user.role === UserRole.SUPER_ADMIN || user.isManager === true;
}

/** Назначить смену другому человеку на графике — ADMIN и SUPER_ADMIN. */
export function canAssignShiftsToOthers(user: { role: string }): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
}

/** Снять смену с графика — ADMIN и SUPER_ADMIN. */
export function canRemoveShifts(user: { role: string }): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
}

/** Обычный сотрудник (не админ): может ставить смену только себе. */
export function isRegularScheduleUser(user: { role: string }): boolean {
  return !canAssignShiftsToOthers(user);
}
