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

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -d ".git" ]]; then
  echo "==> Pulling latest from git"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  git fetch origin "${branch}"
  git pull --ff-only origin "${branch}"
fi

echo "==> Checking production env"
missing=()
[[ -z "${SESSION_SECRET:-}" || "${SESSION_SECRET}" == "change_me_super_long_random_secret" ]] && missing+=("SESSION_SECRET")
[[ -z "${APP_URL:-}" || "${APP_URL}" == http://localhost* ]] && missing+=("APP_URL (https://…)")
[[ -z "${DATABASE_URL:-}" ]] && missing+=("DATABASE_URL")
if ((${#missing[@]})); then
  echo "ERROR: fix in .env before deploy: ${missing[*]}"
  exit 1
fi
if [[ "${NEXT_PUBLIC_TELEGRAM_AUTH_DEV:-}" == "true" || "${TELEGRAM_ALLOW_DEV_LOGIN:-}" == "true" ]]; then
  echo "WARN: отключите dev-вход (NEXT_PUBLIC_TELEGRAM_AUTH_DEV=false, TELEGRAM_ALLOW_DEV_LOGIN=false)"
fi
if [[ -z "${VAPID_PUBLIC_KEY:-}" || -z "${VAPID_PRIVATE_KEY:-}" ]]; then
  echo "WARN: Web Push не настроен (VAPID_*). Сгенерируйте: npx tsx scripts/generate-vapid-keys.ts"
fi
if [[ -z "${SUPER_ADMIN_PHONE:-}" ]]; then
  echo "WARN: SUPER_ADMIN_PHONE не задан — суперадмин по телефону не определится при регистрации"
fi

echo "==> Ensuring upload directories"
case "${DATABASE_URL:-}" in
  file:*)
    db_path="${DATABASE_URL#file:}"
    if [[ "${db_path}" != /* ]]; then
      db_path="${APP_DIR}/${db_path#./}"
    fi
    uploads_default="$(dirname "${db_path}")/uploads"
    ;;
  *)
    uploads_default="${APP_DIR}/data/uploads"
    ;;
esac
uploads_root="${UPLOADS_DIR:-${uploads_default}}"
mkdir -p "${uploads_root}/reports" "${uploads_root}/avatars"
echo "    uploads: ${uploads_root}"

echo "==> Installing dependencies"
npm ci

echo "==> Generating Prisma client"
npx prisma generate

if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  echo "==> Stopping ${APP_NAME} before database migration (SQLite lock)"
  pm2 stop "${APP_NAME}" || true
fi

echo "==> Applying database migrations (SQLite)"
bash scripts/prisma-sqlite-migrate.sh

if [[ -f "scripts/migrate-existing-users.ts" ]]; then
  echo "==> Normalizing existing users (phone / approval)"
  npx tsx scripts/migrate-existing-users.ts || echo "WARN: migrate-existing-users skipped"
fi

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
