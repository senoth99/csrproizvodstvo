#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="csrproizvodstvo"

echo "==> Deploying Next.js app in ${APP_DIR}"

cd "${APP_DIR}"

if [[ ! -f ".env" ]]; then
  echo "ERROR: .env file missing in ${APP_DIR} (copy from .env.example)"
  exit 1
fi

echo "==> Installing dependencies"
npm ci

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Applying database migrations (SQLite)"
bash scripts/prisma-sqlite-migrate.sh

echo "==> Building Next.js app"
export NEXT_PUBLIC_BUILD_REF="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "    NEXT_PUBLIC_BUILD_REF=${NEXT_PUBLIC_BUILD_REF}"
npm run build

echo "==> Reloading PM2 app"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js
else
  pm2 start ecosystem.config.js
fi

pm2 save

set -a
# shellcheck disable=SC1091
source .env
set +a
if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && "${SKIP_TELEGRAM_WEBHOOK:-}" != "1" ]]; then
  if command -v jq >/dev/null 2>&1; then
    echo "==> Telegram webhook"
    if bash scripts/telegram-set-webhook.sh; then
      echo "==> Telegram diagnose"
      bash scripts/telegram-diagnose.sh || echo "WARN: диагностика Telegram не прошла — приложение уже перезапущено."
    else
      echo "WARN: webhook Telegram не настроен (api.telegram.org недоступен с сервера или ошибка токена)."
      echo "       Деплой приложения завершён. Позже: ./scripts/telegram-set-webhook.sh"
      echo "       Или SKIP_TELEGRAM_WEBHOOK=1 в .env и HTTPS_PROXY для обхода блокировки."
    fi
  else
    echo "WARN: jq не установлен — выполните: ./scripts/telegram-set-webhook.sh && ./scripts/telegram-diagnose.sh"
  fi
fi

echo "==> Deploy complete"
pm2 status "${APP_NAME}"
