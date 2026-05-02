#!/bin/sh
# Перед первым запуском применяем миграции (SQLite на persistent volume или новый файл).
set -eu
cd /app || exit 1
url="${DATABASE_URL:-}"
case "$url" in
file:*|"file:"*)
  echo "[entrypoint] SQLite — prisma migrate deploy"
  npx prisma migrate deploy --skip-generate
  ;;
esac
exec "$@"
