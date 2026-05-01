import { createHmac, createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/enums";
import { signSessionToken } from "@/lib/auth";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const entries = Array.from(params.entries()).filter(([k]) => k !== "hash");
  const dataCheckString = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return { hash, dataCheckString, params };
}

function verifyInitData(initData: string, botToken: string) {
  const parsed = parseInitData(initData);
  if (!parsed) return false;
  const secret = createHash("sha256").update(botToken).digest();
  const signature = createHmac("sha256", secret).update(parsed.dataCheckString).digest("hex");
  return signature === parsed.hash;
}

export async function POST(req: Request) {
  try {
    const { initData } = (await req.json()) as { initData?: string };
    if (!initData) return NextResponse.json({ error: "initData required" }, { status: 400 });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is missing" }, { status: 500 });
    if (!verifyInitData(initData, botToken)) return NextResponse.json({ error: "Invalid Telegram signature" }, { status: 401 });

    const parsed = parseInitData(initData);
    if (!parsed) return NextResponse.json({ error: "Invalid initData" }, { status: 400 });
    const userRaw = parsed.params.get("user");
    if (!userRaw) return NextResponse.json({ error: "Telegram user not found" }, { status: 400 });

    const tgUser = JSON.parse(userRaw) as {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      photo_url?: string;
    };
    const adminUsername = (process.env.TELEGRAM_ADMIN_USERNAME ?? "contact_voropaev").replace("@", "").toLowerCase();
    const normalizedUsername = (tgUser.username ?? "").toLowerCase();
    const allowed = await prisma.allowedTelegramUser.findFirst({
      where: { username: normalizedUsername, isActive: true }
    });
    const fallbackAdminAllowed = normalizedUsername === adminUsername;
    if (!allowed && !fallbackAdminAllowed) {
      return NextResponse.json({ error: "Доступ не выдан. Обратитесь к администратору." }, { status: 403 });
    }
    const role =
      (allowed?.role as "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE" | null) ??
      (fallbackAdminAllowed ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE);
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim() || `tg_${tgUser.id}`;

    const user = await prisma.user.upsert({
      where: { telegramId: String(tgUser.id) },
      update: {
        telegramUsername: tgUser.username ?? null,
        telegramPhotoUrl: tgUser.photo_url ?? null,
        isActive: true,
        role
      },
      create: {
        telegramId: String(tgUser.id),
        telegramUsername: tgUser.username ?? null,
        telegramPhotoUrl: tgUser.photo_url ?? null,
        firstName: tgUser.first_name ?? null,
        lastName: tgUser.last_name ?? null,
        name: displayName,
        role,
        isActive: true,
        profileCompleted: false
      }
    });

    const jwt = await signSessionToken({ userId: user.id, role: user.role as "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE" });
    const res = NextResponse.json({ ok: true, role: user.role, onboardingRequired: !user.profileCompleted });
    res.cookies.set("ps_session", jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Telegram auth failed" }, { status: 500 });
  }
}
