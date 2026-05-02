# Внутреннее приложение графика и отчетности производства

Простое внутреннее веб-приложение для сотрудников и администраторов:
- сотрудники ставят себе смены на неделю вперед;
- в день смены запускают и завершают смену;
- после завершения отправляют отчет (он же уходит в общий чат);
- админы контролируют график, лимиты зон, отчеты и аудит.

## Стек

- Next.js + TypeScript + Tailwind CSS
- shadcn/ui (базовые UI-компоненты)
- Prisma ORM (**локально — SQLite**, в проде возможен Postgres)
- Zod, date-fns, jose, crypto
- Docker Compose (опционально)

## Роли

- `SUPER_ADMIN`: полный контроль пользователей, зон, лимитов, логов, токенов.
- `ADMIN`: управление графиком, сменами, отчетами, лимитами (без управления суперадмином).
- `EMPLOYEE`: свои смены, старт/завершение, отчеты, просмотр общего графика.

## Локальная разработка (Mac / без Docker)

1. **Установите Node.js 20+** и убедитесь, что в терминале есть `node` и `npm` (`npm -v`).
   Если команда **`npm run dev`** даёт `command not found: npm`, установите Node (см. сайт или `brew install node`) или подключите [nvm](https://github.com/nvm-sh/nvm): в каталоге проекта есть **`.nvmrc`** (`nvm install && nvm use`).
2. Скопируйте переменные: `cp .env.example .env` (разумные значения для разработки уже в примере: SQLite, вход без бота).
3. Установите зависимости: `npm install`
4. Примените схему к базе и поднимите dev-сервер одной строкой:
   - **`npm run dev:fresh`**  
   или  
   - **`./scripts/dev.sh`**  
5. Откройте **`http://localhost:3000/telegram/login`** и при необходимости нажмите **«Войти как тестовый пользователь»** (нужно `TELEGRAM_ALLOW_DEV_LOGIN=true` в `.env`, как в `.env.example`).

Без правок после `git pull` иногда нужно только: `npm install && npm run setup:local` и затем **`npm run dev`**.

---

## Структура проекта

- `src/app` — страницы, server actions, API-роуты
- `src/components` — UI и бизнес-компоненты (график, чат, формы, бейджи)
- `src/lib` — auth, prisma, валидация, утилиты, аудит
- `prisma/schema.prisma` — схема БД
- `prisma/seed.ts` — тестовые данные

## Запуск через Docker

1. Скопируйте окружение:
   - `cp .env.example .env`
2. Запустите контейнеры:
   - `docker compose up --build -d`
3. Откройте:
   - `http://localhost:3000`

## Миграции Prisma

Локально:
- `npm install`
- `npm run prisma:generate`
- `npm run prisma:migrate`

В Docker:
- миграции применяются через `npx prisma migrate deploy` при старте `app`.

## Seed

- `npm run prisma:seed`

Создаются:
- пользователи (Суперадмин, Админ, Коля, Дима, Андрей, Ваня П, Макар, Даниил);
- зоны (Термопресс, Плоттер и ДТФ, Вырезальщик, ЧПУ);
- базовые лимиты;
- тестовые смены на текущую неделю.

После seed в консоль выводится ссылка входа для суперадмина:
- `http://localhost:3000/login/token/<token>`

## Основные команды

- `npm run dev:fresh` / `./scripts/dev.sh` — **рекомендуется локально**: Prisma generate + db push + `next dev`
- `npm run setup:local` — только Prisma generate + db push (без сервера)
- `npm run dev` — только Next (если база уже настроена)
- `npm run build` — production build
- `npm run start` — запуск production
- `npm run lint` — линтер
- `npm run prisma:generate` — генерация Prisma Client
- `npm run prisma:migrate` — миграции в dev
- `npm run prisma:seed` — seed данных

## Реализовано

- вход только по токен-ссылке;
- сессия в `HttpOnly` cookies (`SameSite=Lax`, `Secure` в production);
- роли и server-side проверки прав;
- серверные проверки 24 часов, пересечений и лимитов зон;
- старт/завершение смены, отчет по смене;
- общий чат отчетов;
- аудит критических действий;
- CSV-экспорт смен и отчетов.

## TODO

- экспорт недели в `.xlsx`;
- UI-копирование недели и расширенная редактура смен прямо в таблице;
- страница системных настроек в админке.
