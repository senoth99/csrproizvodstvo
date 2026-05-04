"use client";

import Link from "next/link";
import { UserAvatar } from "@/components/UserAvatar";

export type ManagerEmployeeListItem = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  telegramUsername: string | null;
  /** Фото из Telegram после входа */
  telegramPhotoUrl?: string | null;
  color: string;
  /** Заполняется на карточке сотрудника; в списке можно не передавать. */
  ndaSigned?: boolean;
};

type Props = { employees: ManagerEmployeeListItem[] };

export function ManagerEmployeesClient({ employees }: Props) {
  if (employees.length === 0) {
    return (
      <div className="card py-10 text-center">
        <p className="text-sm font-medium text-foreground/90">Сотрудников со ролью «сотрудник» пока нет</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
          Добавьте доступ по Telegram выше или выполните{" "}
          <code className="rounded bg-surface px-1 py-0.5 text-[11px]">npm run prisma:seed</code> для демо-набора.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {employees.map((emp) => (
        <li key={emp.id}>
          <Link
            href={`/manager/employees/${emp.id}`}
            prefetch
            scroll
            data-no-swipe="true"
            className="surface-row-link"
          >
            <UserAvatar
              name={emp.name}
              photoUrl={emp.telegramPhotoUrl}
              color={emp.color}
              size="md"
              className="pointer-events-none shrink-0"
            />
            <div className="pointer-events-none min-w-0 flex-1">
              <p className="truncate font-semibold">{emp.name}</p>
              <p className="truncate text-xs text-muted">
                {emp.telegramUsername ? `@${emp.telegramUsername}` : "Нет Telegram-ника"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
