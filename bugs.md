# Баги — аудит кодовой базы

> Дата аудита: 12.06.2026  
> Дата исправления: 12.06.2026  
> Метод: параллельный обход 4 субагентами + исправление 5 субагентами + ревью `cavecrew-reviewer`

**Статус: все 34 бага исправлены.** `npm run lint` и `tsc --noEmit` проходят без ошибок.

---

## CRITICAL — ✅ исправлено

### BUG-001 · `SESSION_SECRET` с публичным fallback → подделка JWT

- **Файл:** `src/lib/sessionSecret.ts`
- **Исправление:** в production — throw при пустом секрете; в dev — fallback только с предупреждением в консоль.

### BUG-002 · `toggleBrigadeAssignment` обходит все бизнес-правила

- **Файл:** `src/app/actions.ts`
- **Исправление:** добавлены `assertCanEditBy24h`, `assertNoOverlap`, `assertZoneLimit`, `assertSingleShiftPerDay`.

### BUG-003 · Удаление смен без транзакции → потеря данных

- **Файл:** `src/app/actions.ts`
- **Исправление:** `deleteMany` + `create` обёрнуты в `prisma.$transaction`.

---

## HIGH — ✅ исправлено

### BUG-004 · `managerAssignBrigadeShift` удаляет смены до проверки пересечений

- **Исправление:** валидация (`assertNoOverlap`, `assertSingleShiftPerDay`) до удаления; мутации в транзакции.

### BUG-005 · Telegram `initData` без проверки `auth_date` → replay-атака

- **Файл:** `src/app/api/telegram/auth/route.ts`
- **Исправление:** отклонение `auth_date` старше 3600 с и из будущего (>300 с).

### BUG-006 · Магическая ссылка не одноразовая

- **Файл:** `src/app/api/login/token/[token]/route.ts`
- **Исправление:** `isActive: false` после успешной выдачи JWT/cookie (не до).

### BUG-007 · TOCTOU в browser-auth: два сеанса с одного challenge

- **Файл:** `src/app/api/telegram/browser-auth/complete/route.ts`
- **Исправление:** атомарное потребление challenge в транзакции до создания сессии.

### BUG-008 · Хардкод fallback-суперадмина в Telegram

- **Файлы:** `src/lib/telegramSignIn.ts`, `src/lib/contactTelegram.ts`
- **Исправление:** убран fallback `contact_voropaev`; SUPER_ADMIN только при явной настройке env.

### BUG-009 · `startShift` не проверяет статус смены

- **Исправление:** старт разрешён только из `PLANNED`.

### BUG-010 · CSV-экспорт: неэкранированные поля и formula injection

- **Файлы:** `src/lib/csv.ts`, `src/app/api/export/reports.csv/route.ts`, `shifts.csv/route.ts`
- **Исправление:** хелпер `csvEscape()` для всех полей.

### BUG-011 · Загрузка фото отчёта: тип файла только по client MIME

- **Файлы:** `src/lib/imageMagicBytes.ts`, `src/app/api/reports/workplace-photo/route.ts`
- **Исправление:** проверка magic bytes при upload.

### BUG-012 · Ссылка входа в админке только в server log

- **Файлы:** `src/components/AdminAccessTokenActions.tsx`, `src/app/admin/users/page.tsx`
- **Исправление:** ссылка отображается в UI с кнопкой копирования.

---

## MEDIUM — ✅ исправлено

### BUG-013 · Webhook Telegram без секрета в non-production

- **Файл:** `src/app/api/telegram/webhook/route.ts`
- **Исправление:** `TELEGRAM_WEBHOOK_SECRET` обязателен во всех окружениях; guard `msg.from`.

### BUG-014 · Middleware: `pathname.includes(".")` обходит auth

- **Файл:** `src/middleware.ts`
- **Исправление:** whitelist известных статических расширений (`.ico`, `.png`, `.css`, …).

### BUG-015 · `GET /api/notifications` возвращает 200 при ошибке БД

- **Исправление:** HTTP 503 + `error: "notifications_unavailable"`.

### BUG-016 · Race condition в workplace check-in

- **Исправление:** `prisma.workplaceArrival.upsert`.

### BUG-017 · CSV смен: `weekStartDate` сдвигается на день в UTC+

- **Исправление:** `formatInTimeZone(..., APP_TIME_ZONE, "yyyy-MM-dd")`.

### BUG-018 · `getCurrentUser` глотает ошибки БД → 401 вместо 503

- **Файлы:** `src/lib/auth.ts` (`AuthDbError`), API routes, `src/lib/dbBoundary.ts` (`catchAuth`), schedule/reports pages
- **Исправление:** DB-ошибки пробрасываются; API → 503; RSC → `ServiceUnavailable`.

### BUG-019 · `assertZoneLimit` считает обновляемую смену

- **Исправление:** параметр `excludeShiftId` при подсчёте.

### BUG-020 · `submitShiftReport`: проверка ACCEPTED вне транзакции

- **Исправление:** re-check статуса внутри `$transaction`.

### BUG-021 · Менеджер может реактивировать отключённого ADMIN

- **Исправление:** `updateMany` только для `UserRole.EMPLOYEE`.

### BUG-022 · `toDateTime` + `assertCanEditBy24h` на UTC-сервере

- **Исправление:** `toDateTime`/`endAt` через `Europe/Moscow` (`toZonedTime`/`fromZonedTime`).

### BUG-023 · `reportStatus == null` трактуется как «принят»

- **Файл:** `src/components/MyShiftsSection.tsx`
- **Исправление:** `null` = pending, не accepted.

### BUG-024 · «Сохранено» в профиле никогда не видно

- **Файл:** `src/components/MeProfileCard.tsx`
- **Исправление:** сообщение вынесено за пределы формы.

### BUG-025 · `ReportTextEditor` показывает старый текст после сохранения

- **Исправление:** `savedText` state в display mode.

### BUG-026 · Ошибка БД на графике → «нет пользователей»

- **Файл:** `src/app/schedule/page.tsx`
- **Исправление:** `ServiceUnavailable` при ошибке загрузки сотрудников.

### BUG-027 · `SwipePageSwitch` игнорирует направление свайпа

- **Исправление:** left/right учитывают знак `deltaX`.

---

## LOW — ✅ исправлено

### BUG-028 · `revokeAccessToken` без `revalidatePath`

- **Исправление:** `revalidatePath("/admin/users")` в `revokeAccessToken` и `generateAccessToken`.

### BUG-029 · GET workplace-photo всегда отдаёт `image/jpeg`

- **Исправление:** MIME определяется по magic bytes при отдаче.

### BUG-030 · `msg.from!` в webhook — хрупкий non-null assertion

- **Исправление:** guard `if (!msg.from) return false`.

### BUG-031 · Audit log: `entityId` = shift.id для `ShiftReport`

- **Исправление:** `entityId: reportIdForPath`.

### BUG-032 · `ShiftTimeLog` без `startedAt` при прямом submit

- **Исправление:** `startedAt` из time log или планового начала смены.

### BUG-033 · Race при инициализации workplace QR token

- **Файл:** `src/lib/workplaceQr.ts`
- **Исправление:** upsert + re-read после гонки.

### BUG-034 · Двойной запрос `getCurrentUser` на страницах отчётов

- **Исправление:** один вызов `requireAuth()` / `catchAuth(() => requireAuth())`.

---

## Сводка

| Серьёзность | Было | Исправлено |
|-------------|------|------------|
| CRITICAL    | 3    | 3          |
| HIGH        | 9    | 9          |
| MEDIUM      | 15   | 15         |
| LOW         | 7    | 7          |
| **Всего**   | **34** | **34**   |

## Изменённые / новые файлы

| Область | Файлы |
|---------|-------|
| Auth / security | `sessionSecret.ts`, `auth.ts`, `middleware.ts`, `telegramSignIn.ts`, `contactTelegram.ts`, telegram API routes, `login/token/route.ts` |
| Business logic | `actions.ts` |
| API | `export/*.ts`, `notifications/route.ts`, `workplace/check-in/route.ts`, `reports/workplace-photo/route.ts` |
| Lib | `csv.ts` *(new)*, `imageMagicBytes.ts` *(new)*, `workplaceQr.ts`, `dbBoundary.ts` |
| UI | `AdminAccessTokenActions.tsx` *(new)*, `admin/users/page.tsx`, `MyShiftsSection.tsx`, `MeProfileCard.tsx`, `ReportTextEditor.tsx`, `SwipePageSwitch.tsx`, `schedule/page.tsx`, `reports/page.tsx`, `reports/[id]/page.tsx` |

## Заметки после исправления

- **Webhook в dev:** нужен `TELEGRAM_WEBHOOK_SECRET` в `.env`, иначе webhook вернёт 503.
- **Production:** обязательны `SESSION_SECRET`, `TELEGRAM_ADMIN_USERNAME` (или `TELEGRAM_ADMIN_TELEGRAM_ID`).
- **Магические ссылки:** теперь одноразовые — для повторного входа генерируйте новую ссылку в админке.

---

*Аудит: 4 explore-субагента. Исправления: 4 generalPurpose + 1 cavecrew-builder. Ревью: cavecrew-reviewer.*
