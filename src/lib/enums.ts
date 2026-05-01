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

export const ChatMessageType = {
  SHIFT_REPORT: "SHIFT_REPORT",
  SYSTEM: "SYSTEM",
  MANUAL: "MANUAL"
} as const;

export type ChatMessageType = (typeof ChatMessageType)[keyof typeof ChatMessageType];
