import { z } from "zod";
import { ShiftSource, ShiftStatus, UserRole } from "./enums";

export const userSchema = z.object({
  name: z.string().min(2),
  role: z.enum([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EMPLOYEE]),
  color: z.string().min(4),
  isActive: z.boolean()
});

export const zoneSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.coerce.number().int()
});

export const zoneLimitSchema = z.object({
  zoneId: z.string().cuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(7).nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  maxEmployees: z.coerce.number().int().min(1)
});

export const shiftSchema = z.object({
  userId: z.string().cuid(),
  zoneId: z.string().cuid(),
  weekStartDate: z.coerce.date(),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  source: z.enum([ShiftSource.SELF, ShiftSource.ADMIN]).default(ShiftSource.SELF),
  comment: z.string().optional()
});

export const updateShiftSchema = shiftSchema.partial().extend({
  id: z.string().cuid(),
  status: z.enum([ShiftStatus.PLANNED, ShiftStatus.IN_PROGRESS, ShiftStatus.COMPLETED, ShiftStatus.CANCELLED]).optional()
});

export const reportSchema = z.object({
  shiftId: z.string().cuid(),
  text: z.string().min(5)
});
