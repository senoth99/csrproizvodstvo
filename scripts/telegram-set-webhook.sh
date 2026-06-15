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

# shellcheck disable=SC1091
source "$(dirname "$0")/telegram-api.sh"

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

echo "--- getMe (проверка токена) ---"
if ! ME="$(telegram_api_get getMe)"; then
  telegram_api_unreachable_msg
  exit 1
fi
echo "$ME" | jq '{ok, username: .result.username, id: .result.id}'
if [[ "$(echo "$ME" | jq -r '.ok // false')" != "true" ]]; then
  echo "ERROR: getMe вернул ошибку — проверьте TELEGRAM_BOT_TOKEN"
  exit 1
fi

echo "--- deleteWebhook (сброс старого URL) ---"
if ! DEL="$(telegram_api_post_json deleteWebhook '{}')"; then
  telegram_api_unreachable_msg
  exit 1
fi
echo "$DEL" | jq .

SET_JSON="$(jq -n --arg url "$WEBHOOK_URL" --arg secret "$TELEGRAM_WEBHOOK_SECRET" \
  '{url: $url, secret_token: $secret, allowed_updates: ["message", "callback_query"]}')"
if ! SET="$(telegram_api_post_json setWebhook "$SET_JSON")"; then
  telegram_api_unreachable_msg
  exit 1
fi
echo "$SET" | jq .

echo "--- getWebhookInfo ---"
if ! INFO="$(telegram_api_get getWebhookInfo)"; then
  telegram_api_unreachable_msg
  exit 1
fi
echo "$INFO" | jq .
