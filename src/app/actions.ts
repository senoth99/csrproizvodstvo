"use server";

import { addHours, isBefore, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { hashToken, generateRawToken, getCurrentUser, requireAuth, requireRole } from "@/lib/auth";
import { BRIGADES } from "@/lib/brigades";
import { prisma } from "@/lib/prisma";
import { reportSchema, shiftSchema, updateShiftSchema, userSchema, zoneLimitSchema, zoneSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { ShiftSource, ShiftStatus, UserRole } from "@/lib/enums";
import { isoFromWeekDay } from "@/lib/utils";
import { z } from "zod";

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

async function assertNoOverlap(userId: string, start: Date, end: Date, exceptShiftId?: string) {
  const shifts = await prisma.shift.findMany({
    where: {
      userId,
      status: { in: [ShiftStatus.PLANNED, ShiftStatus.IN_PROGRESS, ShiftStatus.COMPLETED] },
      ...(exceptShiftId ? { NOT: { id: exceptShiftId } } : {})
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
  const actor = await requireRole([UserRole.SUPER_ADMIN]);
  const data = userSchema.parse(input);
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
  const data = userSchema.partial().parse(input);
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
  return `${process.env.APP_URL ?? "http://localhost:3000"}/login/token/${raw}`;
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
  await assertNoOverlap(current.userId, start, end, current.id);
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
  const shift = await prisma.shift.findUniqueOrThrow({ where: { id: data.shiftId } });
  if (shift.userId !== user.id) throw new Error("Можно отправлять отчет только по своей смене.");
  await prisma.shiftReport.upsert({
    where: { shiftId: data.shiftId },
    create: { shiftId: data.shiftId, userId: user.id, text: data.text },
    update: { text: data.text }
  });
  await writeAuditLog({ actorUserId: user.id, action: "SUBMIT_SHIFT_REPORT", entityType: "ShiftReport", entityId: shift.id });
  revalidatePath("/reports");
}

export async function getWeekSchedule(weekStartDateIso?: string) {
  await requireAuth();
  const weekStartDate = weekStartDateIso ? parseISO(weekStartDateIso) : new Date();
  return prisma.shift.findMany({
    where: { weekStartDate },
    include: { user: true, zone: true, report: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
  });
}

export async function getReports() {
  await requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  return prisma.shiftReport.findMany({
    include: { user: true, shift: { include: { zone: true } } },
    orderBy: { createdAt: "desc" }
  });
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
  });
  const data = schema.parse(input);
  const superAdminUsername = (process.env.TELEGRAM_ADMIN_USERNAME ?? "").trim().toLowerCase().replace(/^@/, "");
  const role = data.username === superAdminUsername ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE;
  if (role === UserRole.SUPER_ADMIN) {
    const existingSuperAdmin = await prisma.allowedTelegramUser.findFirst({
      where: { role: UserRole.SUPER_ADMIN, username: { not: data.username } }
    });
    if (existingSuperAdmin) throw new Error("Суперадмин может быть только один.");
  }
  const row = await prisma.allowedTelegramUser.upsert({
    where: { username: data.username },
    update: { role, isActive: true },
    create: { username: data.username, role, isActive: true }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "ALLOW_TELEGRAM_USER",
    entityType: "AllowedTelegramUser",
    entityId: row.id,
    payload: { ...data, role }
  });
  revalidatePath("/admin/access");
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
