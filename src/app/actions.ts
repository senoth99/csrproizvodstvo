"use server";

import { Prisma } from "@prisma/client";
import { addHours, isBefore, isSameDay, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import {
  hashToken,
  generateRawToken,
  getCurrentUser,
  refreshSessionCookieForUserId,
  requireAuth,
  requireRole
} from "@/lib/auth";
import { BRIGADES } from "@/lib/brigades";
import { prisma } from "@/lib/prisma";
import { reportSchema, shiftSchema, updateShiftSchema, userSchema, zoneLimitSchema, zoneSchema } from "@/lib/validation";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { writeAuditLog } from "@/lib/audit";
import {
  AppNotificationType,
  ShiftReportStatus,
  ShiftSource,
  ShiftStatus,
  ShiftSwapStatus,
  UserRole
} from "@/lib/enums";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { insertAppNotification, notifyUserAppAndTelegram } from "@/lib/notifyDispatch";
import { describeShiftBrief, notifyTelegramIncomingSwap, respondToShiftSwapRequest } from "@/lib/shiftSwapCore";
import {
  prismaUserListNameSelect,
  prismaUserShiftBoardSelect,
  prismaUserSwapTargetSelect
} from "@/lib/prismaSafeUserInclude";
import { isoFromWeekDay } from "@/lib/utils";
import { z } from "zod";

const managerBrigadeAssignSchema = z.object({
  brigadeId: z.string(),
  dayOfWeek: z.number().int().min(1).max(7),
  weekStartDate: z.string(),
  userId: z.string()
});

const shiftSwapCreateSchema = z.object({
  requesterShiftId: z.string(),
  targetShiftId: z.string()
});

const managerRecordPayoutSchema = z.object({
  userId: z.string().cuid(),
  amountRub: z.coerce.number().finite().positive("Сумма выплаты должна быть больше нуля")
});

const acceptShiftReportSchema = z.object({
  reportId: z.string().cuid(),
  amountRub: z.coerce.number().finite().positive("Укажите сумму начисления больше нуля")
});

function userIsReportAdmin(actor: { role: string }) {
  return actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
}

function toDateTime(weekStartDate: Date, dayOfWeek: number, time: string) {
  const date = isoFromWeekDay(weekStartDate, dayOfWeek);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function endAt(start: Date, startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const end = new Date(start);
  end.setHours(eh, em, 0, 0);
  if (eh < sh || (eh === sh && em <= sm)) end.setDate(end.getDate() + 1);
  return end;
}

async function assertCanEditBy24h(userRole: string, shiftStart: Date) {
  if (userRole !== UserRole.EMPLOYEE) return;
  if (isBefore(shiftStart, addHours(new Date(), 24))) {
    throw new Error("Смену нельзя изменить меньше чем за 24 часа до начала. Обратитесь к администратору.");
  }
}

async function assertNoOverlap(userId: string, start: Date, end: Date, exceptShiftIds: string[] = []) {
  const shifts = await prisma.shift.findMany({
    where: {
      userId,
      status: { in: [ShiftStatus.PLANNED, ShiftStatus.IN_PROGRESS, ShiftStatus.COMPLETED] },
      ...(exceptShiftIds.length ? { NOT: { id: { in: exceptShiftIds } } } : {})
    }
  });
  for (const s of shifts) {
    const sStart = toDateTime(s.weekStartDate, s.dayOfWeek, s.startTime);
    const sEnd = endAt(sStart, s.startTime, s.endTime);
    if (start < sEnd && end > sStart) throw new Error("Пересечение смен: сотрудник уже занят в это время.");
  }
}

async function assertSingleShiftPerDay(
  userId: string,
  weekStartDate: Date,
  dayOfWeek: number,
  exceptShiftId?: string
) {
  const existing = await prisma.shift.findFirst({
    where: {
      userId,
      weekStartDate,
      dayOfWeek,
      status: { not: ShiftStatus.CANCELLED },
      ...(exceptShiftId ? { NOT: { id: exceptShiftId } } : {})
    },
    select: { id: true }
  });
  if (existing) {
    throw new Error("На один день можно поставить только одну смену в одном направлении.");
  }
}

async function assertZoneLimit(zoneId: string, dayOfWeek: number, startTime: string, endTime: string, weekStartDate: Date, allowOverride: boolean) {
  const limits = await prisma.zoneLimit.findMany({ where: { zoneId, OR: [{ dayOfWeek }, { dayOfWeek: null }] } });
  const max = limits.length ? Math.min(...limits.map((l) => l.maxEmployees)) : Number.MAX_SAFE_INTEGER;
  const count = await prisma.shift.count({
    where: { zoneId, dayOfWeek, weekStartDate, startTime, endTime, status: { not: ShiftStatus.CANCELLED } }
  });
  if (count >= max && !allowOverride) throw new Error("Лимит сотрудников по зоне и времени превышен.");
}

async function ensureBrigadeZones() {
  const zoneByName = new Map<string, { id: string }>();
  for (const [idx, brigade] of BRIGADES.entries()) {
    const existing = await prisma.zone.findFirst({ where: { name: brigade.zoneName } });
    if (existing) {
      zoneByName.set(brigade.zoneName, { id: existing.id });
      continue;
    }
    const created = await prisma.zone.create({
      data: { name: brigade.zoneName, sortOrder: idx + 1, isActive: true }
    });
    zoneByName.set(brigade.zoneName, { id: created.id });
  }
  return zoneByName;
}

export async function createUser(input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const data = userSchema.parse(input);
  if (data.role === UserRole.SUPER_ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new Error("Только суперадмин может создать пользователя с ролью SUPER_ADMIN.");
  }
  if (data.role === UserRole.SUPER_ADMIN) {
    const existingSuperAdmin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
    if (existingSuperAdmin) throw new Error("Суперадмин может быть только один.");
  }
  const user = await prisma.user.create({ data });
  await writeAuditLog({ actorUserId: actor.id, action: "CREATE_USER", entityType: "User", entityId: user.id, payload: data });
  revalidatePath("/admin/users");
}

export async function updateUser(id: string, input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error("Пользователь не найден.");
  const data = userSchema.partial().parse(input);
  if (actor.role !== UserRole.SUPER_ADMIN) {
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new Error("Изменять суперадмина может только суперадмин.");
    }
    if (data.role === UserRole.SUPER_ADMIN) {
      throw new Error("Назначать роль SUPER_ADMIN может только суперадмин.");
    }
  }
  if (data.role === UserRole.SUPER_ADMIN) {
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN, id: { not: id } }
    });
    if (existingSuperAdmin) throw new Error("Суперадмин может быть только один.");
  }
  const user = await prisma.user.update({ where: { id }, data });
  await writeAuditLog({ actorUserId: actor.id, action: "UPDATE_USER", entityType: "User", entityId: id, payload: data });
  revalidatePath("/admin/users");
  return user;
}

export async function generateAccessToken(userId: string) {
  const actor = await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  await prisma.accessToken.create({ data: { userId, tokenHash } });
  await writeAuditLog({ actorUserId: actor.id, action: "ISSUE_ACCESS_TOKEN", entityType: "AccessToken", entityId: userId });
  return `${resolveAppPublicBaseUrl()}/login/token/${raw}`;
}

export async function revokeAccessToken(id: string) {
  const actor = await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  await prisma.accessToken.update({ where: { id }, data: { isActive: false, revokedAt: new Date() } });
  await writeAuditLog({ actorUserId: actor.id, action: "REVOKE_ACCESS_TOKEN", entityType: "AccessToken", entityId: id });
}

export async function createZone(input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const data = zoneSchema.parse(input);
  const zone = await prisma.zone.create({ data });
  await writeAuditLog({ actorUserId: actor.id, action: "CREATE_ZONE", entityType: "Zone", entityId: zone.id, payload: data });
  revalidatePath("/admin/zones");
}

export async function updateZone(id: string, input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const data = zoneSchema.partial().parse(input);
  await prisma.zone.update({ where: { id }, data });
  await writeAuditLog({ actorUserId: actor.id, action: "UPDATE_ZONE", entityType: "Zone", entityId: id, payload: data });
  revalidatePath("/admin/zones");
}

export async function createZoneLimit(input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  const data = zoneLimitSchema.parse(input);
  await prisma.zoneLimit.create({ data });
  await writeAuditLog({ actorUserId: actor.id, action: "CREATE_ZONE_LIMIT", entityType: "ZoneLimit", payload: data });
  revalidatePath("/admin/limits");
}

export async function createShift(input: unknown, forceOverride = false) {
  const actor = await requireAuth();
  const parsed = shiftSchema.parse(input);
  const isAdmin = actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
  if (actor.role === UserRole.EMPLOYEE && actor.id !== parsed.userId) throw new Error("Нельзя создавать смену другому сотруднику.");
  const start = toDateTime(parsed.weekStartDate, parsed.dayOfWeek, parsed.startTime);
  const end = endAt(start, parsed.startTime, parsed.endTime);
  await assertCanEditBy24h(actor.role, start);
  await assertSingleShiftPerDay(parsed.userId, parsed.weekStartDate, parsed.dayOfWeek);
  await assertNoOverlap(parsed.userId, start, end);
  await assertZoneLimit(parsed.zoneId, parsed.dayOfWeek, parsed.startTime, parsed.endTime, parsed.weekStartDate, isAdmin && forceOverride);
  const shift = await prisma.shift.create({
    data: { ...parsed, source: actor.role === UserRole.EMPLOYEE ? ShiftSource.SELF : ShiftSource.ADMIN, createdById: actor.id, updatedById: actor.id }
  });
  await writeAuditLog({ actorUserId: actor.id, action: "CREATE_SHIFT", entityType: "Shift", entityId: shift.id, payload: parsed });
  revalidatePath("/schedule");
  revalidatePath("/me");
}

export async function toggleBrigadeAssignment(input: { brigadeId: string; dayOfWeek: number; weekStartDate: string }) {
  const actor = await requireAuth();
  const brigade = BRIGADES.find((b) => b.id === input.brigadeId);
  if (!brigade) throw new Error("Бригада не найдена");
  const dayOfWeek = Number(input.dayOfWeek);
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error("Некорректный день недели");
  const weekStartDate = parseISO(input.weekStartDate);
  const zones = await ensureBrigadeZones();
  const zone = zones.get(brigade.zoneName);
  if (!zone) throw new Error("Зона не найдена");

  const existingSameCell = await prisma.shift.findFirst({
    where: {
      userId: actor.id,
      zoneId: zone.id,
      weekStartDate,
      dayOfWeek,
      startTime: brigade.startTime,
      endTime: brigade.endTime,
      status: { not: ShiftStatus.CANCELLED }
    }
  });

  if (existingSameCell) {
    await prisma.shift.delete({ where: { id: existingSameCell.id } });
    revalidatePath("/schedule");
    revalidatePath("/me");
    return;
  }

  await prisma.shift.deleteMany({
    where: {
      userId: actor.id,
      weekStartDate,
      dayOfWeek
    }
  });

  await prisma.shift.create({
    data: {
      userId: actor.id,
      zoneId: zone.id,
      weekStartDate,
      dayOfWeek,
      startTime: brigade.startTime,
      endTime: brigade.endTime,
      source: ShiftSource.SELF,
      createdById: actor.id,
      updatedById: actor.id
    }
  });
  revalidatePath("/schedule");
  revalidatePath("/me");
}

/** Назначение смены сотруднику с графика: суперадмин или руководитель (флаг isManager). */
export async function managerAssignBrigadeShift(input: unknown) {
  const actor = await requireAuth();
  if (!canOpenManagerPanel(actor)) throw new Error("Недостаточно прав.");
  const data = managerBrigadeAssignSchema.parse(input);
  const brigade = BRIGADES.find((b) => b.id === data.brigadeId);
  if (!brigade) throw new Error("Бригада не найдена");
  const weekStartDate = parseISO(data.weekStartDate);
  const zones = await ensureBrigadeZones();
  const zone = zones.get(brigade.zoneName);
  if (!zone) throw new Error("Зона не найдена");

  const target = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!target?.isActive) throw new Error("Пользователь не найден или не активен.");

  const existingSameCell = await prisma.shift.findFirst({
    where: {
      userId: data.userId,
      zoneId: zone.id,
      weekStartDate,
      dayOfWeek: data.dayOfWeek,
      startTime: brigade.startTime,
      endTime: brigade.endTime,
      status: { not: ShiftStatus.CANCELLED }
    }
  });
  if (existingSameCell) return;

  await prisma.shift.deleteMany({
    where: {
      userId: data.userId,
      weekStartDate,
      dayOfWeek: data.dayOfWeek
    }
  });

  const start = toDateTime(weekStartDate, data.dayOfWeek, brigade.startTime);
  const end = endAt(start, brigade.startTime, brigade.endTime);
  await assertNoOverlap(data.userId, start, end);
  await assertZoneLimit(zone.id, data.dayOfWeek, brigade.startTime, brigade.endTime, weekStartDate, true);

  const shift = await prisma.shift.create({
    data: {
      userId: data.userId,
      zoneId: zone.id,
      weekStartDate,
      dayOfWeek: data.dayOfWeek,
      startTime: brigade.startTime,
      endTime: brigade.endTime,
      source: ShiftSource.ADMIN,
      createdById: actor.id,
      updatedById: actor.id
    }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "MANAGER_ASSIGN_BRIGADE",
    entityType: "Shift",
    entityId: shift.id,
    payload: { ...data }
  });

  try {
    const created = await prisma.shift.findUnique({ where: { id: shift.id }, include: { zone: true } });
    if (created?.zone) {
      const brief = describeShiftBrief(created);
      const self = target.id === actor.id;
      await notifyUserAppAndTelegram({
        userId: target.id,
        type: AppNotificationType.SHIFT_ASSIGNED_BY_MANAGER,
        title: self ? "Вы назначили себе смену" : "Вам назначили смену",
        body: self ? `Вы записали себя в график: ${brief}.` : `${actor.name} записал вас в график: ${brief}.`,
        payload: { shiftId: shift.id, selfAssigned: self },
        telegramText: self
          ? `📅 Вы назначили себе смену:\n${brief}`
          : `📅 Вам назначили смену (${actor.name}):\n${brief}`
      });
    }
  } catch (e) {
    console.error("[managerAssignBrigadeShift] уведомление не отправлено, смена уже создана:", e);
  }

  revalidatePath("/schedule");
  revalidatePath("/me");
  revalidatePath("/");
}

export async function managerRemoveShift(shiftId: string) {
  const actor = await requireAuth();
  if (!canOpenManagerPanel(actor)) throw new Error("Недостаточно прав.");
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { zone: true }
  });
  if (!shift) throw new Error("Смена не найдена.");
  if (shift.status === ShiftStatus.CANCELLED) return;

  const brief = describeShiftBrief(shift);

  await prisma.shift.delete({ where: { id: shiftId } });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "MANAGER_REMOVE_SHIFT",
    entityType: "Shift",
    entityId: shiftId,
    payload: { userId: shift.userId }
  });

  if (shift.userId !== actor.id) {
    try {
      await notifyUserAppAndTelegram({
        userId: shift.userId,
        type: AppNotificationType.SHIFT_REMOVED_BY_MANAGER,
        title: "С вас сняли смену",
        body: `${actor.name} удалил вашу запись из графика: ${brief}.`,
        payload: { shiftId }
      });
    } catch (e) {
      console.error("[managerRemoveShift] уведомление не отправлено, запись уже удалена:", e);
    }
  }

  revalidatePath("/schedule");
  revalidatePath("/me");
  revalidatePath("/");
}

export async function managerRecordPayout(input: unknown) {
  const actor = await requireAuth();
  if (!canOpenManagerPanel(actor)) throw new Error("Недостаточно прав.");

  const data = managerRecordPayoutSchema.parse(input);
  const amountCents = Math.round(data.amountRub * 100);
  if (amountCents <= 0) throw new Error("Некорректная сумма выплаты.");

  let updated: { prevDebtCents: number; nextDebtCents: number };
  try {
    updated = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: data.userId },
        select: { id: true, role: true, payoutDebtCents: true }
      });
      if (!target || target.role !== UserRole.EMPLOYEE) throw new Error("Сотрудник не найден.");

      const nextDebtCents = Math.max(0, target.payoutDebtCents - amountCents);
      await tx.user.update({
        where: { id: data.userId },
        data: { payoutDebtCents: nextDebtCents }
      });
      return { prevDebtCents: target.payoutDebtCents, nextDebtCents };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      throw new Error("Схема базы без поля выплат. Выполните на сервере: npx prisma db push и перезапустите приложение.");
    }
    throw e instanceof Error ? e : new Error("Не удалось записать выплату.");
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: "MANAGER_RECORD_PAYOUT",
    entityType: "User",
    entityId: data.userId,
    payload: {
      amountRub: data.amountRub,
      prevDebtCents: updated.prevDebtCents,
      nextDebtCents: updated.nextDebtCents
    }
  });

  revalidatePath("/manager");
  revalidatePath("/manager/payouts");
  revalidatePath("/manager/employees");
  revalidatePath("/me");
  revalidatePath("/me/balance");
}

export async function managerRecordAccrual(input: unknown) {
  const actor = await requireAuth();
  if (!canOpenManagerPanel(actor)) throw new Error("Недостаточно прав.");

  const data = managerRecordPayoutSchema.parse(input);
  const amountCents = Math.round(data.amountRub * 100);
  if (amountCents <= 0) throw new Error("Некорректная сумма начисления.");

  let updated: { prevDebtCents: number; nextDebtCents: number };
  try {
    updated = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: data.userId },
        select: { id: true, role: true, payoutDebtCents: true }
      });
      if (!target || target.role !== UserRole.EMPLOYEE) throw new Error("Сотрудник не найден.");

      const nextDebtCents = target.payoutDebtCents + amountCents;
      await tx.user.update({
        where: { id: data.userId },
        data: { payoutDebtCents: nextDebtCents }
      });
      return { prevDebtCents: target.payoutDebtCents, nextDebtCents };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      throw new Error("Схема базы без поля выплат. Выполните на сервере: npx prisma db push и перезапустите приложение.");
    }
    throw e instanceof Error ? e : new Error("Не удалось записать начисление.");
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: "MANAGER_RECORD_ACCRUAL",
    entityType: "User",
    entityId: data.userId,
    payload: {
      amountRub: data.amountRub,
      prevDebtCents: updated.prevDebtCents,
      nextDebtCents: updated.nextDebtCents
    }
  });

  revalidatePath("/manager");
  revalidatePath("/manager/payouts");
  revalidatePath("/manager/employees");
  revalidatePath("/me");
  revalidatePath("/me/balance");
}

export async function createShiftSwapRequest(input: unknown) {
  const actor = await requireAuth();
  if (actor.role !== UserRole.EMPLOYEE) {
    throw new Error("Обмен через график доступен только сотрудникам.");
  }

  const data = shiftSwapCreateSchema.parse(input);
  if (data.requesterShiftId === data.targetShiftId) throw new Error("Выберите разные записи.");

  const offer = await prisma.shift.findUnique({
    where: { id: data.requesterShiftId },
    include: { zone: true, report: true, timeLog: true }
  });
  const target = await prisma.shift.findUnique({
    where: { id: data.targetShiftId },
    include: {
      zone: true,
      report: true,
      timeLog: true,
      user: { select: prismaUserSwapTargetSelect }
    }
  });

  if (!offer || !target) throw new Error("Смена не найдена.");
  if (offer.userId !== actor.id) throw new Error("В обмен можно предложить только свою смену.");
  if (target.userId === actor.id) throw new Error("Нельзя запросить обмен самому себе.");

  if (offer.status !== ShiftStatus.PLANNED || target.status !== ShiftStatus.PLANNED) {
    throw new Error("Обмен возможен только для запланированных смен.");
  }
  if (offer.report || target.report || offer.timeLog?.startedAt || target.timeLog?.startedAt) {
    throw new Error("Обмен недоступен: смена уже с отчётом или активным учётом времени.");
  }

  if (offer.weekStartDate.getTime() !== target.weekStartDate.getTime()) {
    throw new Error("Обмен только внутри одной недели.");
  }

  const offerStart = toDateTime(offer.weekStartDate, offer.dayOfWeek, offer.startTime);
  await assertCanEditBy24h(actor.role, offerStart);

  const conflicting = await prisma.shiftSwapRequest.findFirst({
    where: {
      targetShiftId: data.targetShiftId,
      status: ShiftSwapStatus.PENDING
    }
  });
  if (conflicting) throw new Error("По этой смене уже есть ожидающий запрос. Попробуйте позже.");

  const dup = await prisma.shiftSwapRequest.findFirst({
    where: {
      status: ShiftSwapStatus.PENDING,
      requesterUserId: actor.id,
      targetShiftId: data.targetShiftId,
      requesterShiftId: data.requesterShiftId
    }
  });
  if (dup) throw new Error("Такой запрос уже отправлен.");

  const row = await prisma.shiftSwapRequest.create({
    data: {
      requesterUserId: actor.id,
      requesterShiftId: data.requesterShiftId,
      targetShiftId: data.targetShiftId,
      status: ShiftSwapStatus.PENDING
    }
  });

  const offerBrief = describeShiftBrief(offer);
  const targetBrief = describeShiftBrief(target);

  await insertAppNotification({
    userId: target.userId,
    type: AppNotificationType.SHIFT_SWAP_INCOMING,
    title: "Запрос на обмен сменами",
    body: `${actor.name} хочет обменять: вы отдаёте (${targetBrief}), забираете (${offerBrief}).`,
    swapRequestId: row.id,
    payload: { swapRequestId: row.id, kind: "incoming" }
  });

  await notifyTelegramIncomingSwap({
    responderTelegramId: target.user.telegramId,
    requestId: row.id,
    requesterName: actor.name,
    offerLabel: offerBrief,
    targetLabel: targetBrief
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "SHIFT_SWAP_REQUEST",
    entityType: "ShiftSwapRequest",
    entityId: row.id,
    payload: data
  });
  revalidatePath("/schedule");
  revalidatePath("/");
}

export type RespondShiftSwapResult = { ok: true } | { ok: false; message: string };

export async function respondShiftSwapRequestAction(input: unknown): Promise<RespondShiftSwapResult> {
  const actor = await requireAuth();
  const parsed = z
    .object({
      swapRequestId: z.string(),
      accept: z.boolean()
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Некорректные данные запроса." };
  }
  const result = await respondToShiftSwapRequest(
    parsed.data.swapRequestId,
    parsed.data.accept,
    actor.id
  );
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true };
}

export async function updateShift(input: unknown, forceOverride = false) {
  const actor = await requireAuth();
  const parsed = updateShiftSchema.parse(input);
  const current = await prisma.shift.findUniqueOrThrow({ where: { id: parsed.id } });
  if (actor.role === UserRole.EMPLOYEE && current.userId !== actor.id) throw new Error("Можно менять только свои смены.");
  const weekStartDate = parsed.weekStartDate ?? current.weekStartDate;
  const dayOfWeek = parsed.dayOfWeek ?? current.dayOfWeek;
  const startTime = parsed.startTime ?? current.startTime;
  const endTime = parsed.endTime ?? current.endTime;
  const zoneId = parsed.zoneId ?? current.zoneId;
  const start = toDateTime(weekStartDate, dayOfWeek, startTime);
  const end = endAt(start, startTime, endTime);
  await assertCanEditBy24h(actor.role, start);
  await assertSingleShiftPerDay(current.userId, weekStartDate, dayOfWeek, current.id);
  await assertNoOverlap(current.userId, start, end, [current.id]);
  const isAdmin = actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
  await assertZoneLimit(zoneId, dayOfWeek, startTime, endTime, weekStartDate, isAdmin && forceOverride);
  await prisma.shift.update({ where: { id: current.id }, data: { ...parsed, updatedById: actor.id } });
  await writeAuditLog({ actorUserId: actor.id, action: "UPDATE_SHIFT", entityType: "Shift", entityId: current.id, payload: parsed });
  revalidatePath("/schedule");
  revalidatePath("/me");
}

export async function cancelShift(id: string) {
  const actor = await requireAuth();
  const shift = await prisma.shift.findUniqueOrThrow({ where: { id } });
  if (actor.role === UserRole.EMPLOYEE && shift.userId !== actor.id) throw new Error("Можно отменять только свои смены.");
  const start = toDateTime(shift.weekStartDate, shift.dayOfWeek, shift.startTime);
  await assertCanEditBy24h(actor.role, start);
  await prisma.shift.update({ where: { id }, data: { status: ShiftStatus.CANCELLED, updatedById: actor.id } });
  await writeAuditLog({ actorUserId: actor.id, action: "CANCEL_SHIFT", entityType: "Shift", entityId: id });
  revalidatePath("/schedule");
}

export async function startShift(shiftId: string) {
  const user = await requireAuth();
  const shift = await prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });
  if (shift.userId !== user.id) throw new Error("Можно начать только свою смену.");
  const active = await prisma.shift.count({ where: { userId: user.id, status: ShiftStatus.IN_PROGRESS } });
  if (active > 0) throw new Error("У вас уже есть активная смена.");
  await prisma.shift.update({ where: { id: shiftId }, data: { status: ShiftStatus.IN_PROGRESS } });
  await prisma.shiftTimeLog.upsert({
    where: { shiftId },
    create: { shiftId, userId: user.id, startedAt: new Date() },
    update: { startedAt: new Date() }
  });
  await writeAuditLog({ actorUserId: user.id, action: "START_SHIFT", entityType: "Shift", entityId: shiftId });
  revalidatePath("/me");
  revalidatePath("/schedule");
}

export async function endShift(shiftId: string) {
  const user = await requireAuth();
  const shift = await prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });
  if (shift.userId !== user.id) throw new Error("Можно завершить только свою смену.");
  if (shift.status !== ShiftStatus.IN_PROGRESS) throw new Error("Смена не запущена.");
  await prisma.shift.update({ where: { id: shiftId }, data: { status: ShiftStatus.COMPLETED } });
  await prisma.shiftTimeLog.upsert({
    where: { shiftId },
    create: { shiftId, userId: user.id, endedAt: new Date() },
    update: { endedAt: new Date() }
  });
  await writeAuditLog({ actorUserId: user.id, action: "END_SHIFT", entityType: "Shift", entityId: shiftId });
  revalidatePath("/me");
}

export async function submitShiftReport(input: unknown) {
  const user = await requireAuth();
  const data = reportSchema.parse(input);
  const shift = await prisma.shift.findUniqueOrThrow({
    where: { id: data.shiftId },
    include: { report: true }
  });
  if (shift.userId !== user.id) throw new Error("Можно отправлять отчет только по своей смене.");
  if (shift.status === ShiftStatus.CANCELLED) throw new Error("Смена отменена, отчёт недоступен.");
  const shiftDay = isoFromWeekDay(shift.weekStartDate, shift.dayOfWeek);
  if (!isSameDay(shiftDay, new Date())) throw new Error("Отчёт можно отправить только в день смены.");
  if (shift.report?.status === ShiftReportStatus.ACCEPTED) throw new Error("Отчёт уже принят.");

  const { reportIdForPath } = await prisma.$transaction(async (tx) => {
    // Только поля, которые есть у любого Prisma Client: без status/updatedAt — иначе «Unknown argument»
    // на старых клиентах; updatedAt подставляет БД (@default + @updatedAt в schema).
    const rep = await tx.shiftReport.upsert({
      where: { shiftId: data.shiftId },
      create: {
        shiftId: data.shiftId,
        userId: user.id,
        text: data.text.trim()
      },
      update: {
        text: data.text.trim()
      }
    });

    await tx.shift.update({
      where: { id: data.shiftId },
      data: { status: ShiftStatus.COMPLETED, updatedById: user.id }
    });
    await tx.shiftTimeLog.upsert({
      where: { shiftId: data.shiftId },
      create: { shiftId: data.shiftId, userId: user.id, endedAt: new Date() },
      update: { endedAt: new Date() }
    });
    return { reportIdForPath: rep.id };
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "SUBMIT_SHIFT_REPORT",
    entityType: "ShiftReport",
    entityId: shift.id,
    payload: { reportId: reportIdForPath }
  });
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportIdForPath}`);
  revalidatePath("/me");
  revalidatePath("/schedule");
}

export async function acceptShiftReportWithAccrual(input: unknown) {
  const actor = await requireAuth();
  if (!userIsReportAdmin(actor)) throw new Error("Только администратор может принять отчёт.");

  const data = acceptShiftReportSchema.parse(input);
  const amountCents = Math.round(data.amountRub * 100);
  if (amountCents <= 0) throw new Error("Некорректная сумма.");

  const ledger = await prisma.$transaction(async (tx) => {
    const report = await tx.shiftReport.findUnique({
      where: { id: data.reportId },
      include: { shift: { select: { id: true } } }
    });
    if (!report) throw new Error("Отчёт не найден.");
    if (report.status !== ShiftReportStatus.PENDING_REVIEW) throw new Error("Отчёт уже обработан.");

    const target = await tx.user.findUnique({
      where: { id: report.userId },
      select: { id: true, payoutDebtCents: true, isActive: true }
    });
    if (!target || !target.isActive) {
      throw new Error("Пользователь не найден или отключён — начисление по отчёту невозможно.");
    }

    const nextDebtCents = target.payoutDebtCents + amountCents;

    await tx.user.update({
      where: { id: report.userId },
      data: { payoutDebtCents: nextDebtCents }
    });
    await tx.shiftReport.update({
      where: { id: report.id },
      data: {
        status: ShiftReportStatus.ACCEPTED,
        accrualAmountCents: amountCents,
        acceptedAt: new Date(),
        acceptedByUserId: actor.id
      }
    });

    return {
      userId: report.userId,
      reportId: report.id,
      shiftId: report.shift.id,
      prevDebtCents: target.payoutDebtCents,
      nextDebtCents
    };
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "MANAGER_RECORD_ACCRUAL",
    entityType: "User",
    entityId: ledger.userId,
    payload: {
      amountRub: data.amountRub,
      prevDebtCents: ledger.prevDebtCents,
      nextDebtCents: ledger.nextDebtCents,
      shiftReportId: ledger.reportId,
      shiftId: ledger.shiftId
    }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "ACCEPT_SHIFT_REPORT",
    entityType: "ShiftReport",
    entityId: ledger.reportId,
    payload: { amountRub: data.amountRub, userId: ledger.userId }
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${data.reportId}`);
  revalidatePath("/me");
  revalidatePath("/me/balance");
  revalidatePath("/schedule");
  revalidatePath("/manager");
  revalidatePath("/manager/payouts");
  revalidatePath("/manager/employees");
}

export async function getWeekSchedule(weekStartDateIso?: string) {
  await requireAuth();
  const weekStartDate = weekStartDateIso ? parseISO(weekStartDateIso) : new Date();
  return prisma.shift.findMany({
    where: { weekStartDate },
    include: { user: { select: prismaUserShiftBoardSelect }, zone: true, report: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
  });
}

export async function getReports() {
  const user = await requireAuth();
  const isAdmin = userIsReportAdmin(user);
  return prisma.shiftReport.findMany({
    where: isAdmin ? undefined : { userId: user.id },
    include: {
      user: { select: prismaUserListNameSelect },
      shift: { include: { zone: true } },
      acceptedBy: { select: prismaUserListNameSelect }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getReportById(reportId: string) {
  const user = await requireAuth();
  const report = await prisma.shiftReport.findUnique({
    where: { id: reportId },
    include: {
      user: { select: prismaUserListNameSelect },
      shift: { include: { zone: true } },
      acceptedBy: { select: prismaUserListNameSelect }
    }
  });
  if (!report) return null;
  const isAdmin = userIsReportAdmin(user);
  if (!isAdmin && report.userId !== user.id) return null;
  return report;
}

export async function updateMyProfile(input: unknown) {
  const user = await requireAuth();
  const schema = z.object({
    firstName: z.string().trim().min(2, "Имя минимум 2 символа"),
    lastName: z.string().trim().min(2, "Фамилия минимум 2 символа")
  });
  const data = schema.parse(input);
  const displayName = `${data.lastName} ${data.firstName}`.trim();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      name: displayName,
      profileCompleted: true
    }
  });
  await refreshSessionCookieForUserId(user.id);
  revalidatePath("/me");
}

export async function completeWelcomeProfile(input: unknown) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Нужна авторизация");
  const schema = z.object({
    firstName: z.string().trim().min(2, "Имя минимум 2 символа"),
    lastName: z.string().trim().min(2, "Фамилия минимум 2 символа")
  });
  const data = schema.parse(input);
  const displayName = `${data.lastName} ${data.firstName}`.trim();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      name: displayName,
      profileCompleted: true
    }
  });
  await refreshSessionCookieForUserId(user.id);
  revalidatePath("/welcome");
  revalidatePath("/schedule");
  revalidatePath("/me");
}

export async function addAllowedTelegramUser(input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN]);
  const schema = z.object({
    username: z
      .string()
      .trim()
      .min(3, "username слишком короткий")
      .toLowerCase()
      .transform((v) => v.replace(/^@/, "")),
    isManager: z.boolean().optional().default(false)
  });
  const data = schema.parse(input);
  const superAdminUsername = (process.env.TELEGRAM_ADMIN_USERNAME ?? "").trim().toLowerCase().replace(/^@/, "");
  const role = data.username === superAdminUsername ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE;
  const managerFlag = role === UserRole.SUPER_ADMIN ? false : Boolean(data.isManager);
  if (role === UserRole.SUPER_ADMIN) {
    const existingSuperAdmin = await prisma.allowedTelegramUser.findFirst({
      where: { role: UserRole.SUPER_ADMIN, username: { not: data.username } }
    });
    if (existingSuperAdmin) throw new Error("Суперадмин может быть только один.");
  }
  const row = await prisma.allowedTelegramUser.upsert({
    where: { username: data.username },
    update: { role, isActive: true, isManager: managerFlag },
    create: { username: data.username, role, isActive: true, isManager: managerFlag }
  });
  await prisma.user.updateMany({
    where: { telegramUsername: data.username },
    data: { isManager: managerFlag }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "ALLOW_TELEGRAM_USER",
    entityType: "AllowedTelegramUser",
    entityId: row.id,
    payload: { ...data, role, isManager: managerFlag }
  });
  revalidatePath("/admin/access");
  revalidatePath("/manager");
}

export async function adminSetTelegramUserManager(input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN]);
  const schema = z.object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => v.replace(/^@/, "")),
    isManager: z.boolean()
  });
  const data = schema.parse(input);
  const superAdminUsername = (process.env.TELEGRAM_ADMIN_USERNAME ?? "").trim().toLowerCase().replace(/^@/, "");
  if (data.username === superAdminUsername) throw new Error("Флаг не нужен для суперадмина.");
  const allow = await prisma.allowedTelegramUser.findFirst({
    where: { username: data.username }
  });
  if (!allow) throw new Error("Запись доступа для этого username не найдена — добавьте пользователя снова.");
  await prisma.allowedTelegramUser.updateMany({
    where: { username: data.username },
    data: { isManager: data.isManager }
  });
  await prisma.user.updateMany({
    where: { telegramUsername: data.username },
    data: { isManager: data.isManager }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: data.isManager ? "SET_MANAGER" : "UNSET_MANAGER",
    entityType: "AllowedTelegramUser",
    entityId: data.username,
    payload: data
  });
  revalidatePath("/admin/access");
  revalidatePath("/manager");
}

export async function toggleAllowedTelegramUser(id: string, active: boolean) {
  const actor = await requireRole([UserRole.SUPER_ADMIN]);
  await prisma.allowedTelegramUser.update({ where: { id }, data: { isActive: active } });
  await writeAuditLog({
    actorUserId: actor.id,
    action: active ? "ENABLE_TELEGRAM_USER" : "DISABLE_TELEGRAM_USER",
    entityType: "AllowedTelegramUser",
    entityId: id
  });
  revalidatePath("/admin/access");
}

export async function adminUpdateUserProfile(input: unknown) {
  const actor = await requireRole([UserRole.SUPER_ADMIN]);
  const schema = z.object({
    userId: z.string().cuid(),
    firstName: z.string().trim().min(2, "Имя минимум 2 символа"),
    lastName: z.string().trim().min(2, "Фамилия минимум 2 символа")
  });
  const data = schema.parse(input);
  const name = `${data.lastName} ${data.firstName}`.trim();
  await prisma.user.update({
    where: { id: data.userId },
    data: { firstName: data.firstName, lastName: data.lastName, name }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "ADMIN_UPDATE_USER_PROFILE",
    entityType: "User",
    entityId: data.userId,
    payload: data
  });
  revalidatePath("/admin/access");
}

export async function revokeTelegramAccessByUsername(usernameInput: string) {
  const actor = await requireRole([UserRole.SUPER_ADMIN]);
  const username = usernameInput.trim().toLowerCase().replace(/^@/, "");
  const superAdminUsername = (process.env.TELEGRAM_ADMIN_USERNAME ?? "").trim().toLowerCase().replace(/^@/, "");
  if (username === superAdminUsername) throw new Error("Нельзя отзывать доступ у суперадмина.");
  await prisma.allowedTelegramUser.updateMany({
    where: { username },
    data: { isActive: false }
  });
  await prisma.user.updateMany({
    where: { telegramUsername: username, role: { not: UserRole.SUPER_ADMIN } },
    data: { isActive: false }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "REVOKE_TELEGRAM_ACCESS_BY_USERNAME",
    entityType: "AllowedTelegramUser",
    entityId: username
  });
  revalidatePath("/admin/access");
}

export async function deleteEmployeeByUsername(usernameInput: string) {
  const actor = await requireRole([UserRole.SUPER_ADMIN]);
  const username = usernameInput.trim().toLowerCase().replace(/^@/, "");
  const superAdminUsername = (process.env.TELEGRAM_ADMIN_USERNAME ?? "").trim().toLowerCase().replace(/^@/, "");
  if (username === superAdminUsername) throw new Error("Суперадмина нельзя удалить.");

  const target = await prisma.user.findFirst({ where: { telegramUsername: username } });
  if (target?.role === UserRole.SUPER_ADMIN) throw new Error("Суперадмина нельзя удалить.");

  await prisma.$transaction(async (tx) => {
    await tx.allowedTelegramUser.deleteMany({ where: { username } });
    await tx.user.deleteMany({
      where: {
        telegramUsername: username,
        role: { not: UserRole.SUPER_ADMIN }
      }
    });
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "DELETE_EMPLOYEE_BY_USERNAME",
    entityType: "User",
    entityId: username
  });
  revalidatePath("/admin/access");
}
