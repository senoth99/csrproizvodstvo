#!/usr/bin/env bash
# Установка webhook для входа из браузера. Запуск из корня проекта: ./scripts/telegram-set-webhook.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${TELEGRAM_BOT_TOKEN:?Задайте TELEGRAM_BOT_TOKEN в .env}"
: "${APP_URL:?Задайте APP_URL в .env (https://ваш-домен)}"
: "${TELEGRAM_WEBHOOK_SECRET:?Задайте TELEGRAM_WEBHOOK_SECRET в .env}"

# Telegram API принимает webhook только по HTTPS (даже если APP_URL в .env с http://).
WEBHOOK_URL="${APP_URL%/}/api/telegram/webhook"
if [[ "$WEBHOOK_URL" == http://* ]]; then
  echo "⚠️  APP_URL без HTTPS — для webhook подставляем https:// (исправьте APP_URL в .env на https://...)"
  WEBHOOK_URL="https://${WEBHOOK_URL#http://}"
fi

echo "Webhook URL: ${WEBHOOK_URL}"

if ! command -v jq >/dev/null 2>&1; then
  echo "Нужен jq: apt install jq / brew install jq"
  exit 1
fi

curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg url "$WEBHOOK_URL" --arg secret "$TELEGRAM_WEBHOOK_SECRET" \
    '{url: $url, secret_token: $secret, allowed_updates: ["message", "callback_query"]}')" | jq .

echo "--- getWebhookInfo ---"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq .
