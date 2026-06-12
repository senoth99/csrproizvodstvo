import { NextResponse } from "next/server";
import { resolveAppPublicBaseUrl } from "@/lib/appUrl";
import { fetchTelegramBotUsername, fetchTelegramWebhookInfo } from "@/lib/telegramBotInfo";

export const runtime = "nodejs";

/** Публичная диагностика Telegram-бота (без секретов). */
export async function GET() {
  const tokenSet = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const secretSet = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim());
  const publicUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").trim();
  const expectedWebhook = `${resolveAppPublicBaseUrl()}/api/telegram/webhook`;

  const [liveUsername, webhookInfo] = tokenSet
    ? await Promise.all([fetchTelegramBotUsername(), fetchTelegramWebhookInfo()])
    : [null, null];

  const usernameMismatch =
    liveUsername != null &&
    publicUsername.length > 0 &&
    liveUsername.toLowerCase() !== publicUsername.toLowerCase();

  const webhookUrlOk = Boolean(webhookInfo?.url && webhookInfo.url === expectedWebhook);
  const webhookHasError = Boolean(webhookInfo?.last_error_message);

  const ok =
    tokenSet &&
    secretSet &&
    Boolean(liveUsername) &&
    webhookUrlOk &&
    !webhookHasError &&
    !usernameMismatch;

  return NextResponse.json({
    ok,
    tokenConfigured: tokenSet,
    webhookSecretConfigured: secretSet,
    botUsernameLive: liveUsername,
    botUsernameBuild: publicUsername || null,
    usernameMismatch,
    expectedWebhookUrl: expectedWebhook,
    webhook: webhookInfo
      ? {
          url: webhookInfo.url ?? null,
          pendingUpdates: webhookInfo.pending_update_count ?? 0,
          lastErrorDate: webhookInfo.last_error_date ?? null,
          lastErrorMessage: webhookInfo.last_error_message ?? null
        }
      : null,
    hints: [
      !tokenSet && "Задайте TELEGRAM_BOT_TOKEN в .env",
      !secretSet && "Задайте TELEGRAM_WEBHOOK_SECRET и выполните ./scripts/telegram-set-webhook.sh",
      usernameMismatch &&
        liveUsername &&
        `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (${publicUsername}) не совпадает с ботом токена (@${liveUsername}) — пересоберите после исправления .env`,
      webhookInfo && !webhookInfo.url && "Webhook не установлен — ./scripts/telegram-set-webhook.sh",
      webhookInfo?.url && webhookInfo.url !== expectedWebhook &&
        `Webhook указывает на ${webhookInfo.url}, ожидается ${expectedWebhook}`,
      webhookInfo?.last_error_message && `Telegram не достучался до webhook: ${webhookInfo.last_error_message}`
    ].filter(Boolean)
  });
}
