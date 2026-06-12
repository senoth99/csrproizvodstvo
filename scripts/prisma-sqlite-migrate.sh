#!/usr/bin/env sh
# SQLite: migrate deploy; если база уже с таблицами без _prisma_migrations (P3005) — baseline одной миграции.
set -eu
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

if npx prisma migrate deploy 2>"$log"; then
  # SQLite на VPS: подтянуть колонки, если схема ушла вперёд без миграции
  case "${DATABASE_URL:-}" in
    file:*)
      echo "[prisma] db push (sync drift)…"
      npx prisma db push --skip-generate 2>/dev/null || true
      ;;
  esac
  exit 0
fi

if grep -q "P3005" "$log" 2>/dev/null || grep -q "schema is not empty" "$log" 2>/dev/null; then
  echo "[prisma] База не пуста без истории миграций — помечаем 20260202200000_init как уже применённую (baseline)."
  npx prisma migrate resolve --applied "20260202200000_init" 2>/dev/null || true
  if npx prisma migrate deploy; then
    case "${DATABASE_URL:-}" in
      file:*)
        npx prisma db push --skip-generate 2>/dev/null || true
        ;;
    esac
    exit 0
  fi
fi

cat "$log" >&2
exit 1
