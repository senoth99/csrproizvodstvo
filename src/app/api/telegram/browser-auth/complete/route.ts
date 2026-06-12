import { NextResponse } from "next/server";
import { ACCESS_DENIED_CODE } from "@/lib/accessDenied";
import {
  browserLoginFinishUrl,
  getBrowserChallengeStatus,
  normalizeBrowserLoginToken
} from "@/lib/browserAuthComplete";
import { isBrowserTelegramLoginConfigured } from "@/lib/telegramBrowserLogin";

export async function POST(req: Request) {
  if (!isBrowserTelegramLoginConfigured()) {
    return NextResponse.json(
      { error: "Вход из браузера не настроен. Задайте TELEGRAM_BOT_TOKEN и NEXT_PUBLIC_TELEGRAM_BOT_USERNAME." },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Неверное тело запроса (ожидается JSON)" }, { status: 400 });
    }
    const token =
      typeof body.token === "string" ? normalizeBrowserLoginToken(body.token) : null;
    if (!token) {
      return NextResponse.json({ error: "Неверный формат токена" }, { status: 400 });
    }

    const status = await getBrowserChallengeStatus(token.hash);

    if (status === "missing" || status === "waiting") {
      return NextResponse.json({ waiting: true }, { status: 202 });
    }
    if (status === "expired") {
      return NextResponse.json({ error: "Токен устарел. Запросите новый на странице входа." }, { status: 410 });
    }
    if (status === "denied") {
      return NextResponse.json(
        {
          error: "Доступ не выдан. Обратитесь к администратору.",
          code: ACCESS_DENIED_CODE
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ready: true,
      finishUrl: browserLoginFinishUrl(token.raw)
    });
  } catch (e) {
    console.error("[api/telegram/browser-auth/complete]", e);
    return NextResponse.json(
      { error: "База недоступна. Выполните prisma migrate deploy и перезапустите сервер." },
      { status: 503 }
    );
  }
}
