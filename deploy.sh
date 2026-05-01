#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/production-scheduler"
APP_NAME="production-scheduler"

echo "==> Deploying ${APP_NAME} in ${APP_DIR}"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "ERROR: ${APP_DIR} not found"
  exit 1
fi

cd "${APP_DIR}"

if [[ ! -f ".env" ]]; then
  echo "ERROR: .env file missing in ${APP_DIR}"
  exit 1
fi

echo "==> Installing dependencies"
npm ci

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Applying database schema"
npx prisma db push

echo "==> Building Next.js app"
npm run build

echo "==> Reloading PM2 app"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 reload "${APP_NAME}"
else
  pm2 start ecosystem.config.js
fi

pm2 save

echo "==> Deploy complete"
pm2 status "${APP_NAME}"
