import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdminsShiftArrival } from "@/lib/notifyAdmins";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkplaceQrToken } from "@/lib/workplaceQr";

export async function POST(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
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

    if (existing) {
      await prisma.workplaceArrival.update({
        where: { userId: user.id },
        data: { arrivedAt }
      });
      return NextResponse.json({
        ok: true,
        updated: true,
        arrivedAt: arrivedAt.toISOString()
      });
    }

    await prisma.workplaceArrival.create({
      data: { userId: user.id, arrivedAt }
    });
    await notifyAdminsShiftArrival({ employeeName: user.name, arrivedAt });

    return NextResponse.json({
      ok: true,
      updated: false,
      arrivedAt: arrivedAt.toISOString()
    });
  } catch (e) {
    console.error("[api/workplace/check-in POST] Prisma error:", e);
    return NextResponse.json({ error: "check_in_unavailable" }, { status: 503 });
  }
}
