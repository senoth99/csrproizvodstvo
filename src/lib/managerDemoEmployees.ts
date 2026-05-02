import { UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";

/** Префикс в `telegramId`, чтобы записи можно было узнать и не дублировать при повторных вызовах. */
const DEMO_TELEGRAM_ID_PREFIX = "__demo_manager_employee__";

/**
 * Только для `NODE_ENV === "development"`: если в базе нет сотрудников (EMPLOYEE),
 * добавляет несколько тестовых учётных записей для страницы «Сотрудники» в панели руководителя.
 */
function allowDemoEmployeesOnEmpty(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.MANAGER_DEMO_USERS_ON_EMPTY === "1";
}

export async function ensureManagerDemoEmployeesIfEmpty(): Promise<void> {
  if (!allowDemoEmployeesOnEmpty()) return;

  try {
    const existing = await prisma.user.count({
      where: { role: UserRole.EMPLOYEE }
    });
    if (existing > 0) return;

    await prisma.user.createMany({
      data: [
        {
          name: "Демо — Анна Сергеева",
          firstName: "Анна",
          lastName: "Сергеева",
          telegramUsername: "demo_anna",
          telegramId: `${DEMO_TELEGRAM_ID_PREFIX}1`,
          role: UserRole.EMPLOYEE,
          profileCompleted: true,
          payoutDebtCents: 482500,
          color: "#3b82f6",
          isActive: true
        },
        {
          name: "Демо — Пётр Козлов",
          firstName: "Пётр",
          lastName: "Козлов",
          telegramUsername: "demo_petr",
          telegramId: `${DEMO_TELEGRAM_ID_PREFIX}2`,
          role: UserRole.EMPLOYEE,
          profileCompleted: false,
          payoutDebtCents: 315000,
          color: "#22c55e",
          isActive: true
        },
        {
          name: "Демо — Мария Орлова",
          firstName: "Мария",
          lastName: "Орлова",
          telegramUsername: null,
          telegramId: `${DEMO_TELEGRAM_ID_PREFIX}3`,
          role: UserRole.EMPLOYEE,
          profileCompleted: true,
          payoutDebtCents: 0,
          color: "#eab308",
          isActive: true
        },
        {
          name: "Демо — Олег (не активен)",
          firstName: "Олег",
          lastName: "Никаноров",
          telegramUsername: "demo_oleg",
          telegramId: `${DEMO_TELEGRAM_ID_PREFIX}4`,
          role: UserRole.EMPLOYEE,
          profileCompleted: true,
          payoutDebtCents: 94000,
          color: "#a855f7",
          isActive: false
        }
      ]
    });
  } catch (e) {
    console.warn("[ensureManagerDemoEmployeesIfEmpty]", e);
  }
}
