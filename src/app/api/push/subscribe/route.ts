import { NextResponse } from "next/server";
import { AuthDbError, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SubscribeBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
};

async function requireAuthenticatedUser() {
  try {
    return await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) throw e;
    throw new AuthDbError(undefined, { cause: e });
  }
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/push/subscribe POST] auth DB", e);
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
    }
    console.error("[api/push/subscribe POST] session", e);
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "invalid_subscription" }, { status: 400 });
  }

  try {
    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId: user.id, endpoint }
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: body.userAgent?.slice(0, 512) ?? null
      },
      update: {
        p256dh,
        auth,
        userAgent: body.userAgent?.slice(0, 512) ?? null
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/push/subscribe POST] Prisma error:", e);
    return NextResponse.json({ ok: false, error: "subscribe_failed" }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/push/subscribe DELETE] auth DB", e);
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
    }
    console.error("[api/push/subscribe DELETE] session", e);
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: SubscribeBody = {};
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    body = {};
  }

  const endpoint = body.endpoint?.trim();

  try {
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id, endpoint }
      });
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/push/subscribe DELETE] Prisma error:", e);
    return NextResponse.json({ ok: false, error: "unsubscribe_failed" }, { status: 503 });
  }
}
