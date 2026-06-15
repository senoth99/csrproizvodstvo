#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${PORT:-3000}"
SECRET="${CRON_SECRET:-}"
URL="http://127.0.0.1:${PORT}/api/cron/shift-reminders"

if [[ -n "$SECRET" ]]; then
  curl -sS -f -H "Authorization: Bearer ${SECRET}" "$URL"
else
  curl -sS -f "$URL"
fi

echo ""
