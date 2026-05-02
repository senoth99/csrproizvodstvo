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

export const ShiftSwapStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED"
} as const;

export type ShiftSwapStatus = (typeof ShiftSwapStatus)[keyof typeof ShiftSwapStatus];

export const AppNotificationType = {
  SHIFT_SWAP_INCOMING: "SHIFT_SWAP_INCOMING",
  SHIFT_SWAP_OUTCOME: "SHIFT_SWAP_OUTCOME",
  /** Руководитель/суперадмин записал пользователя в ячейку графика */
  SHIFT_ASSIGNED_BY_MANAGER: "SHIFT_ASSIGNED_BY_MANAGER",
  /** Запись в ячейке удалена руководителем */
  SHIFT_REMOVED_BY_MANAGER: "SHIFT_REMOVED_BY_MANAGER",
  /** Ответчик нажал «Принять» по обмену */
  SHIFT_SWAP_YOU_ACCEPTED: "SHIFT_SWAP_YOU_ACCEPTED"
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
