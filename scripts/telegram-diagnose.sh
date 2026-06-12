#!/usr/bin/env bash
# Диагностика Telegram-бота и webhook. Запуск: ./scripts/telegram-diagnose.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${TELEGRAM_BOT_TOKEN:?Задайте TELEGRAM_BOT_TOKEN в .env}"
: "${APP_URL:?Задайте APP_URL в .env}"

if ! command -v jq >/dev/null 2>&1; then
  echo "Нужен jq: apt install jq / brew install jq"
  exit 1
fi

WEBHOOK_URL="${APP_URL%/}/api/telegram/webhook"
if [[ "$WEBHOOK_URL" == http://* ]]; then
  WEBHOOK_URL="https://${WEBHOOK_URL#http://}"
fi

echo "=== getMe ==="
ME="$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe")"
echo "$ME" | jq .
BOT_USER="$(echo "$ME" | jq -r '.result.username // empty')"
if [[ -z "$BOT_USER" ]]; then
  echo "ERROR: getMe не вернул username — проверьте TELEGRAM_BOT_TOKEN"
  exit 1
fi

PUBLIC_USER="${NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:-}"
PUBLIC_USER="${PUBLIC_USER//@/}"
if [[ -n "$PUBLIC_USER" && "$PUBLIC_USER" != "$BOT_USER" ]]; then
  echo "WARN: NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=@${PUBLIC_USER} ≠ бот токена @${BOT_USER}"
  echo "      Ссылка «Открыть бота» теперь берёт username из getMe, но пересоберите с правильным NEXT_PUBLIC_ для консистентности."
fi

echo ""
echo "=== getWebhookInfo ==="
WH="$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")"
echo "$WH" | jq .

WH_URL="$(echo "$WH" | jq -r '.result.url // empty')"
LAST_ERR="$(echo "$WH" | jq -r '.result.last_error_message // empty')"
PENDING="$(echo "$WH" | jq -r '.result.pending_update_count // 0')"

if [[ -z "$WH_URL" ]]; then
  echo "ERROR: webhook не установлен. Выполните: ./scripts/telegram-set-webhook.sh"
  exit 1
fi

if [[ "$WH_URL" != "$WEBHOOK_URL" ]]; then
  echo "ERROR: webhook URL = $WH_URL"
  echo "       ожидается   = $WEBHOOK_URL"
  exit 1
fi

if [[ -z "${TELEGRAM_WEBHOOK_SECRET:-}" ]]; then
  echo "ERROR: TELEGRAM_WEBHOOK_SECRET не задан в .env"
  exit 1
fi

if [[ -n "$LAST_ERR" ]]; then
  echo "ERROR: Telegram не может достучаться до webhook: $LAST_ERR"
  exit 1
fi

echo ""
echo "=== probe webhook (локально) ==="
if command -v curl >/dev/null 2>&1; then
  HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: ${TELEGRAM_WEBHOOK_SECRET}" \
    -d '{"message":{"message_id":1,"chat":{"id":1},"from":{"id":1,"username":"diag"},"text":"/start diag"}}' || echo "000")"
  echo "POST $WEBHOOK_URL → HTTP $HTTP_CODE (ожидается 200)"
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "ERROR: webhook endpoint не отвечает 200 — проверьте nginx/PM2/приложение"
    exit 1
  fi
fi

echo ""
echo "OK: бот @${BOT_USER}, webhook ${WEBHOOK_URL}, pending=${PENDING}"
