#!/usr/bin/env bash
# Общие вызовы Telegram Bot API для shell-скриптов (таймауты, прокси, понятные ошибки).
TELEGRAM_API_BASE_URL="${TELEGRAM_API_BASE_URL:-https://api.telegram.org}"
TELEGRAM_CURL_CONNECT_TIMEOUT="${TELEGRAM_CURL_CONNECT_TIMEOUT:-15}"
TELEGRAM_CURL_MAX_TIME="${TELEGRAM_CURL_MAX_TIME:-30}"

telegram_api_curl() {
  curl -sS \
    --connect-timeout "${TELEGRAM_CURL_CONNECT_TIMEOUT}" \
    --max-time "${TELEGRAM_CURL_MAX_TIME}" \
    "$@"
}

telegram_api_unreachable_msg() {
  cat <<'EOF'
ERROR: не удалось подключиться к Telegram API (таймаут или сеть).
       Само приложение уже задеплоено — webhook можно настроить позже:
         ./scripts/telegram-set-webhook.sh
       На VPS в РФ часто нужен HTTPS_PROXY в .env или VPN.
       Чтобы пропускать шаг при деплое: SKIP_TELEGRAM_WEBHOOK=1 в .env
EOF
}

telegram_api_get() {
  local method="$1"
  telegram_api_curl "${TELEGRAM_API_BASE_URL}/bot${TELEGRAM_BOT_TOKEN}/${method}"
}

telegram_api_post_json() {
  local method="$1"
  local json="$2"
  telegram_api_curl -X POST "${TELEGRAM_API_BASE_URL}/bot${TELEGRAM_BOT_TOKEN}/${method}" \
    -H "Content-Type: application/json" \
    -d "${json}"
}
