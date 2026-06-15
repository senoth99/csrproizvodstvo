import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AuthDbError, getCurrentUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { ShiftStatus } from "@/lib/enums";
import { notifyAdminsShiftArrival } from "@/lib/notifyAdmins";
import { prisma } from "@/lib/prisma";
import { findUserShiftToday } from "@/lib/todayShift";
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

    const arrivedAt = new Date();
    const existing = await prisma.workplaceArrival.findUnique({
      where: { userId: user.id },
      select: { id: true }
    });

    await prisma.workplaceArrival.upsert({
      where: { userId: user.id },
      create: { userId: user.id, arrivedAt },
      update: { arrivedAt }
    });

    await prisma.workplaceArrivalLog.create({
      data: { userId: user.id, arrivedAt }
    });

    await notifyAdminsShiftArrival({ employeeName: user.name, arrivedAt });

    let shiftStarted = false;
    let shiftAlreadyInProgress = false;
    let noShiftToday = false;
    let zoneName: string | null = null;

    const todayShift = await findUserShiftToday(user.id);
    if (todayShift) {
      zoneName = todayShift.zone.name;
      if (todayShift.status === ShiftStatus.PLANNED) {
        const otherActive = await prisma.shift.count({
          where: {
            userId: user.id,
            status: ShiftStatus.IN_PROGRESS,
            id: { not: todayShift.id }
          }
        });
        if (otherActive === 0) {
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
          shiftStarted = true;
        }
      } else if (todayShift.status === ShiftStatus.IN_PROGRESS) {
        shiftAlreadyInProgress = true;
      }
    } else {
      noShiftToday = true;
    }

    revalidatePath("/manager");
    revalidatePath(`/manager/employees/${user.id}`);
    revalidatePath("/me");
    revalidatePath("/schedule");

    return NextResponse.json({
      ok: true,
      updated: Boolean(existing),
      arrivedAt: arrivedAt.toISOString(),
      shiftStarted,
      shiftAlreadyInProgress,
      noShiftToday,
      zoneName
    });
  } catch (e) {
    console.error("[api/workplace/check-in POST] Prisma error:", e);
    return NextResponse.json({ error: "check_in_unavailable" }, { status: 503 });
  }
}
