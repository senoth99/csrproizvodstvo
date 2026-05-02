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
    type: AppNotificationType.SHIFT_SWAP_INCOMING,
    titleRu: "Запрос на обмен сменами",
    when: "Сотрудник нажал на вашу смену в графике и отправил запрос обмена.",
    inApp: true,
    telegram: "Текст + инлайн-кнопки «Принять / Отклонить» (отдельная отправка, не через notifyUserAppAndTelegram)."
  },
  {
    type: AppNotificationType.SHIFT_SWAP_OUTCOME,
    titleRu: "Запрос на обмен",
    when: "Второй участник принял или отклонил ваш запрос на обмен.",
    inApp: true,
    telegram: "То же текстом в личку бота (заголовок + пояснение)."
  },
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
    type: AppNotificationType.SHIFT_SWAP_YOU_ACCEPTED,
    titleRu: "Обмен выполнен",
    when: "Вы нажали «Принять» по запросу обмена — график обновлён.",
    inApp: true,
    telegram: "Короткое подтверждение в бот после принятия (дублирует здравый смысл действия)."
  }
];
