import { UserRole, type UserRole as UserRoleValue } from "@/lib/enums";

const labels: Record<UserRoleValue, string> = {
  SUPER_ADMIN: "Суперадмин",
  ADMIN: "Админ",
  EMPLOYEE: "Сотрудник"
};

export function RoleBadge({ role }: { role: string }) {
  const normalizedRole = (Object.values(UserRole).includes(role as UserRoleValue) ? role : UserRole.EMPLOYEE) as UserRoleValue;
  return <span className="rounded-full border border-border px-2 py-1 text-xs">{labels[normalizedRole]}</span>;
}
