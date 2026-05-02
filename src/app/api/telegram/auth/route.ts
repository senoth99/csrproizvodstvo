import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createSessionResponseFromTgUser, type TgMiniAppUser } from "@/lib/telegramSignIn";

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
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const signature = createHmac("sha256", secret).update(parsed.dataCheckString).digest("hex");
  return signature === parsed.hash;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const initData =
      body && typeof body === "object" && "initData" in body && typeof (body as { initData: unknown }).initData === "string"
        ? (body as { initData: string }).initData
        : undefined;
    if (!initData) return NextResponse.json({ error: "initData required" }, { status: 400 });

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      return NextResponse.json(
        { error: "Не задан TELEGRAM_BOT_TOKEN в .env — без него Mini App не авторизует." },
        { status: 503 }
      );
    }
    if (!verifyInitData(initData, botToken)) return NextResponse.json({ error: "Invalid Telegram signature" }, { status: 401 });

    const parsed = parseInitData(initData);
    if (!parsed) return NextResponse.json({ error: "Invalid initData" }, { status: 400 });
    const userRaw = parsed.params.get("user");
    if (!userRaw) return NextResponse.json({ error: "Telegram user not found" }, { status: 400 });

    let tgUser: TgMiniAppUser;
    try {
      tgUser = JSON.parse(userRaw) as TgMiniAppUser;
    } catch {
      return NextResponse.json({ error: "Malformed Telegram user field" }, { status: 400 });
    }
    if (typeof tgUser?.id !== "number" || !Number.isFinite(tgUser.id)) {
      return NextResponse.json({ error: "Invalid Telegram user id" }, { status: 400 });
    }
    return await createSessionResponseFromTgUser(tgUser);
  } catch (e) {
    console.error("[api/telegram/auth]", e);
    return NextResponse.json(
      { error: "Сбой авторизации Telegram. Проверьте лог сервера, БД и TELEGRAM_BOT_TOKEN." },
      { status: 503 }
    );
  }
}
