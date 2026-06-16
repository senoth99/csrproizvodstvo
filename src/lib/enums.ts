export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  EMPLOYEE: "EMPLOYEE"
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ShiftStatus = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
} as const;

export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const ShiftSource = {
  SELF: "SELF",
  ADMIN: "ADMIN"
} as const;

export type ShiftSource = (typeof ShiftSource)[keyof typeof ShiftSource];

export const AppNotificationType = {
  /** Руководитель/суперадмин записал пользователя в ячейку графика */
  SHIFT_ASSIGNED_BY_MANAGER: "SHIFT_ASSIGNED_BY_MANAGER",
  /** Запись в ячейке удалена руководителем */
  SHIFT_REMOVED_BY_MANAGER: "SHIFT_REMOVED_BY_MANAGER",
  /** Сотрудник сам записался на смену (график / форма) */
  SHIFT_ADDED_BY_EMPLOYEE: "SHIFT_ADDED_BY_EMPLOYEE",
  /** Сотрудник просит админа снять смену (сам снять не может) */
  SHIFT_REMOVAL_REQUESTED: "SHIFT_REMOVAL_REQUESTED",
  /** Сотрудник сам снял смену с графика */
  SHIFT_REMOVED_BY_EMPLOYEE: "SHIFT_REMOVED_BY_EMPLOYEE",
  /** Сотрудник отметился на производстве (QR) */
  SHIFT_ARRIVAL: "SHIFT_ARRIVAL",
  /** Смена начата по QR-коду на производстве */
  SHIFT_STARTED_BY_QR: "SHIFT_STARTED_BY_QR",
  /** Сотрудник отправил отчёт по смене (с фото) */
  SHIFT_REPORT_SUBMITTED: "SHIFT_REPORT_SUBMITTED",
  /** Напоминание: завтра смена (21:00 МСК) */
  SHIFT_REMINDER: "SHIFT_REMINDER",
  /** Новая регистрация — ожидает одобрения админа */
  USER_REGISTRATION_PENDING: "USER_REGISTRATION_PENDING",
  /** Регистрация одобрена */
  USER_REGISTRATION_APPROVED: "USER_REGISTRATION_APPROVED",
  /** Регистрация отклонена */
  USER_REGISTRATION_REJECTED: "USER_REGISTRATION_REJECTED"
} as const;

export type AppNotificationType = (typeof AppNotificationType)[keyof typeof AppNotificationType];

export const ChatMessageType = {
  SHIFT_REPORT: "SHIFT_REPORT",
  SYSTEM: "SYSTEM",
  MANUAL: "MANUAL"
} as const;

export type ChatMessageType = (typeof ChatMessageType)[keyof typeof ChatMessageType];

export const ShiftReportStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  ACCEPTED: "ACCEPTED"
} as const;

export type ShiftReportStatus = (typeof ShiftReportStatus)[keyof typeof ShiftReportStatus];
