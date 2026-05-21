/**
 * Полный список типов уведомлений в колокольчике и связанная доставка в Telegram.
 */
import { AppNotificationType } from "@/lib/enums";

type CatalogRow = {
  type: (typeof AppNotificationType)[keyof typeof AppNotificationType];
  titleRu: string;
  when: string;
  inApp: boolean;
  telegram: string;
};

export const APP_NOTIFICATIONS_CATALOG: CatalogRow[] = [
  {
    type: AppNotificationType.SHIFT_ASSIGNED_BY_MANAGER,
    titleRu: "Вам назначили смену / Вы назначили себе смену",
    when: "Руководитель выбрал себя или другого человека в ячейке «Назначить смену». Оба варианта дают уведомление и в колокольчик, и в Telegram.",
    inApp: true,
    telegram: "То же содержание в личку бота."
  },
  {
    type: AppNotificationType.SHIFT_REMOVED_BY_MANAGER,
    titleRu: "С вас сняли смену",
    when: "Руководитель или суперадмин удалил вашу запись из ячейки графика.",
    inApp: true,
    telegram: "То же текстом в личку бота."
  },
  {
    type: AppNotificationType.SHIFT_ADDED_BY_EMPLOYEE,
    titleRu: "Сотрудник записался на смену",
    when: "Сотрудник поставил смену сам или руководитель назначил сотрудника в графике.",
    inApp: true,
    telegram: "В личку бота всем ADMIN, SUPER_ADMIN и руководителям (isManager) с telegramId, кроме уже уведомлённого."
  },
  {
    type: AppNotificationType.SHIFT_REMOVED_BY_EMPLOYEE,
    titleRu: "Сотрудник снял смену",
    when: "Сотрудник убрал смену или руководитель снял запись с графика.",
    inApp: true,
    telegram: "В личку бота всем ADMIN, SUPER_ADMIN и руководителям (isManager) с telegramId."
  }
];
