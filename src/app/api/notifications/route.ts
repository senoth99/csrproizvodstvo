import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("[api/notifications GET] session", e);
    return NextResponse.json({ items: [], error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ items: [], error: "unauthorized" }, { status: 401 });

  try {
    const items = await prisma.appNotification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
        swapRequestId: true,
        payload: true
      }
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[api/notifications GET] Prisma error — проверьте миграции и npx prisma generate:", e);
    return NextResponse.json({ items: [] });
  }
}

export async function PATCH(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("[api/notifications PATCH] session", e);
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const ids: string[] = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  const markAll = Boolean(body.markAll);

  try {
    if (markAll) {
      await prisma.appNotification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() }
      });
      return NextResponse.json({ ok: true });
    }

    if (!ids.length) return NextResponse.json({ ok: false }, { status: 400 });

    await prisma.appNotification.updateMany({
      where: { userId: user.id, id: { in: ids } },
      data: { readAt: new Date() }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/notifications PATCH] Prisma error — проверьте миграции и npx prisma generate:", e);
    return NextResponse.json({ ok: false, error: "notifications_unavailable" }, { status: 503 });
  }
}
