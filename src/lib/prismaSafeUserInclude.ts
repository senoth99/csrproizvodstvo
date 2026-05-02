/**
 * В отношениях лучше не использовать `user: true`: Prisma затянет все скалярные поля модели User.
 * Если в SQLite ещё нет колонки (например после `git pull`), страницы падают.
 * Здесь — узкие `select`, достаточные для текущего UI/API.
 */

import { UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";

export const prismaUserShiftBoardSelect = {
  id: true,
  name: true,
  color: true,
  telegramPhotoUrl: true
} as const;

export const prismaUserListNameSelect = { id: true, name: true } as const;

export const prismaUserSwapTargetSelect = {
  id: true,
  name: true,
  telegramId: true
} as const;

export const prismaUserSwapRequesterSelect = {
  id: true,
  name: true
} as const;

export const prismaUserAccessSessionSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
  isManager: true,
  profileCompleted: true,
  telegramUsername: true
} as const;

/** Сумма долгов; если колонки `payoutDebtCents` в БД ещё нет — 0 без падения страницы. */
export async function sumEmployeePayoutDebtCentsSafe(): Promise<number> {
  try {
    const agg = await prisma.user.aggregate({
      where: { role: UserRole.EMPLOYEE },
      _sum: { payoutDebtCents: true }
    });
    return agg._sum.payoutDebtCents ?? 0;
  } catch {
    return 0;
  }
}

export async function findEmployeesWithPayoutDebtForManagerSafe() {
  try {
    return await prisma.user.findMany({
      where: { role: UserRole.EMPLOYEE },
      orderBy: [{ payoutDebtCents: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        isActive: true,
        color: true,
        payoutDebtCents: true
      }
    });
  } catch {
    const rows = await prisma.user.findMany({
      where: { role: UserRole.EMPLOYEE },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
        isActive: true,
        color: true
      }
    });
    return rows.map((r) => ({ ...r, payoutDebtCents: 0 }));
  }
}
