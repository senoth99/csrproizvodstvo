#!/usr/bin/env bash
# Локальный старт без гадания: Prisma generate + db push и next dev.
# Запуск: ./scripts/dev.sh   (chmod +x при необходимости)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' \
    "" \
    "Ошибка: в PATH не найден «npm» (нет Node.js или не загружен nvm/fnm)." \
    "" \
    "  • Установка: https://nodejs.org/ LTS или Homebrew:" \
    "      brew install node" \
    "  • Если пользуетесь nvm, в этом каталоге:" \
    "      nvm install && nvm use" \
    "  • Затем снова: ./scripts/dev.sh" \
    "" >&2
  exit 127
fi

echo "→ prisma generate && prisma db push → next dev"
npm run prisma:generate
npm run db:push
exec npm run dev
