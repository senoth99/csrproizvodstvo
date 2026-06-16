import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { AuthDbError, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AppNotificationType, ShiftStatus } from "@/lib/enums";
import { notifyAdminsShiftArrival } from "@/lib/notifyAdmins";
import { notifyUser } from "@/lib/notifyDispatch";
import { prisma } from "@/lib/prisma";
import { describeShiftBrief } from "@/lib/shiftBrief";
import { canStartShiftViaQrToday, findUserShiftToday } from "@/lib/todayShift";
import { getOrCreateWorkplaceQrToken } from "@/lib/workplaceQr";

export async function POST(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/workplace/check-in POST] auth DB", e);
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }
    console.error("[api/workplace/check-in POST] session", e);
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  try {
    const expected = await getOrCreateWorkplaceQrToken();
    if (token !== expected) {
      return NextResponse.json({ error: "invalid_token" }, { status: 403 });
    }

    const todayShift = await findUserShiftToday(user.id);
    if (!canStartShiftViaQrToday(todayShift)) {
      return NextResponse.json({ error: "no_shift_today" }, { status: 403 });
    }

    const otherActive = await prisma.shift.count({
      where: {
        userId: user.id,
        status: ShiftStatus.IN_PROGRESS,
        id: { not: todayShift.id }
      }
    });
    if (otherActive > 0) {
      return NextResponse.json({ error: "other_shift_active" }, { status: 409 });
    }

    const arrivedAt = new Date();
    const zoneName = todayShift.zone.name;

    await prisma.workplaceArrival.upsert({
      where: { userId: user.id },
      create: { userId: user.id, arrivedAt },
      update: { arrivedAt }
    });

    await prisma.workplaceArrivalLog.create({
      data: { userId: user.id, arrivedAt }
    });

    await notifyAdminsShiftArrival({ employeeName: user.name, arrivedAt });

    await prisma.shift.update({
      where: { id: todayShift.id },
      data: { status: ShiftStatus.IN_PROGRESS, updatedById: user.id }
    });
    await prisma.shiftTimeLog.upsert({
      where: { shiftId: todayShift.id },
      create: { shiftId: todayShift.id, userId: user.id, startedAt: arrivedAt },
      update: { startedAt: arrivedAt }
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: "START_SHIFT",
      entityType: "Shift",
      entityId: todayShift.id,
      payload: { source: "qr" }
    });

    after(async () => {
      try {
        const brief = describeShiftBrief(todayShift);
        await notifyUser({
          userId: user.id,
          type: AppNotificationType.SHIFT_STARTED_BY_QR,
          title: "Всё отлично!",
          body: `Ваша смена начата: ${brief}.`,
          pushUrl: "/me",
          payload: { shiftId: todayShift.id, source: "qr" }
        });
      } catch (e) {
        console.error("[api/workplace/check-in] shift started notify:", e);
      }
    });

    revalidatePath("/manager");
    revalidatePath(`/manager/employees/${user.id}`);
    revalidatePath("/me");
    revalidatePath("/schedule");

    return NextResponse.json({
      ok: true,
      arrivedAt: arrivedAt.toISOString(),
      shiftStarted: true,
      zoneName
    });
  } catch (e) {
    console.error("[api/workplace/check-in POST] Prisma error:", e);
    return NextResponse.json({ error: "check_in_unavailable" }, { status: 503 });
  }
}
