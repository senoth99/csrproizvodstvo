import { UserRole } from "@/lib/enums";

/** Пункт «Панель» у суперадмина и у помеченных руководителей */
export function canOpenManagerPanel(user: { role: string; isManager: boolean }): boolean {
  return user.role === UserRole.SUPER_ADMIN || user.isManager === true;
}
