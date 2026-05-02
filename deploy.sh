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
if [[ -z "${NEXT_PUBLIC_BUILD_REF:-}" ]]; then
  export NEXT_PUBLIC_BUILD_REF="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi
echo "    NEXT_PUBLIC_BUILD_REF=${NEXT_PUBLIC_BUILD_REF}"
npm run build

echo "==> Reloading PM2 app"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js
else
  pm2 start ecosystem.config.js
fi

pm2 save

echo "==> Deploy complete"
pm2 status "${APP_NAME}"
