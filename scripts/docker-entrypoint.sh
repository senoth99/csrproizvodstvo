#!/bin/sh
# Перед первым запуском применяем миграции (SQLite на persistent volume или новый файл).
set -eu
cd /app || exit 1
url="${DATABASE_URL:-}"
case "$url" in
file:*|"file:"*)
  echo "[entrypoint] SQLite — prisma migrate (с baseline при P3005)"
  sh /app/scripts/prisma-sqlite-migrate.sh || exit 1
  ;;
esac
exec "$@"
