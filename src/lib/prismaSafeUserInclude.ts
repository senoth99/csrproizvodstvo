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
  telegramPhotoUrl: true,
  avatarUpdatedAt: true
} as const;

export const prismaUserListNameSelect = { id: true, name: true, phone: true } as const;

/** Поля User для сессии и страниц — без `include: true`, устойчивее к дрейфу схемы SQLite. */
export const prismaUserSessionSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  telegramId: true,
  telegramUsername: true,
  telegramPhotoUrl: true,
  avatarUpdatedAt: true,
  profileCompleted: true,
  ndaSigned: true,
  role: true,
  isManager: true,
  isActive: true,
  color: true,
  payoutDebtCents: true,
  approvalStatus: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true
} as const;

/** Без `payoutDebtCents`, если колонка ещё не применена миграцией. */
export const prismaUserSessionSelectLegacy = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  telegramId: true,
  telegramUsername: true,
  telegramPhotoUrl: true,
  avatarUpdatedAt: true,
  profileCompleted: true,
  ndaSigned: true,
  role: true,
  isManager: true,
  isActive: true,
  color: true,
  createdAt: true,
  updatedAt: true
} as const;

export type PrismaUserSessionRow = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  telegramPhotoUrl: string | null;
  avatarUpdatedAt: Date | null;
  profileCompleted: boolean;
  ndaSigned: boolean;
  role: string;
  isManager: boolean;
  isActive: boolean;
  color: string;
  payoutDebtCents: number;
  approvalStatus: string;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function findSessionUserByIdSafe(userId: string): Promise<PrismaUserSessionRow | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: prismaUserSessionSelect
    });
    if (!user || !user.isActive) return null;
    return user;
  } catch (firstError) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: prismaUserSessionSelectLegacy
      });
      if (!user || !user.isActive) return null;
      return {
        ...user,
        payoutDebtCents: 0,
        approvalStatus: "APPROVED",
        passwordHash: null,
        avatarUpdatedAt: null
      };
    } catch {
      throw firstError;
    }
  }
}

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
        phone: true,
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
        color: true,
        phone: true
      }
    });
    return rows.map((r) => ({ ...r, payoutDebtCents: 0 }));
  }
}
