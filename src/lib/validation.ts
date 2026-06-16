import { z } from "zod";
import { isValidPhone, normalizePhoneInput } from "@/lib/formatPhone";
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

const workTimeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Формат времени: ЧЧ:ММ");

export const reportSchema = z
  .object({
    shiftId: z.string().cuid(),
    text: z.string().min(5),
    workplacePhotoPath: z.string().min(1),
    workStartTime: workTimeSchema,
    workEndTime: workTimeSchema,
    likedUserId: z.string().cuid().optional(),
    checklistAnswers: z
      .array(
        z.object({
          itemId: z.string().cuid(),
          checked: z.boolean()
        })
      )
      .optional()
      .default([])
  })
  .superRefine((data, ctx) => {
    const [sh, sm] = data.workStartTime.split(":").map(Number);
    const [eh, em] = data.workEndTime.split(":").map(Number);
    const startM = sh * 60 + sm;
    let endM = eh * 60 + em;
    if (endM <= startM) endM += 24 * 60;
    const diff = endM - startM;
    if (diff < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Время окончания должно быть позже начала.", path: ["workEndTime"] });
    }
    if (diff > 24 * 60) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Смена не может длиться больше 24 часов.", path: ["workEndTime"] });
    }
  });

const phoneFieldSchema = z
  .string()
  .trim()
  .min(1, "Укажите контактный телефон")
  .refine((v) => isValidPhone(v), "Формат: +7 и 10 цифр")
  .transform(normalizePhoneInput);

const telegramUsernameFieldSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@+/, "").toLowerCase())
  .refine((v) => v === "" || /^[a-z][a-z0-9_]{4,31}$/.test(v), {
    message: "Username Telegram: 5–32 символа, латиница, цифры и _"
  });

export const profileNamesPhoneSchema = z.object({
  firstName: z.string().trim().min(2, "Имя минимум 2 символа"),
  lastName: z.string().trim().min(2, "Фамилия минимум 2 символа"),
  phone: phoneFieldSchema,
  telegramUsername: telegramUsernameFieldSchema.optional().default("")
});

export const zoneChecklistItemSchema = z.object({
  zoneId: z.string().cuid(),
  label: z.string().min(1).max(200)
});

export const updateZoneChecklistItemSchema = z.object({
  id: z.string().cuid(),
  label: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional()
});

export const updateReportSchema = z
  .object({
    reportId: z.string().cuid(),
    text: z.string().min(5),
    workStartTime: workTimeSchema.optional(),
    workEndTime: workTimeSchema.optional()
  })
  .superRefine((data, ctx) => {
    if (data.workStartTime && data.workEndTime) {
      const [sh, sm] = data.workStartTime.split(":").map(Number);
      const [eh, em] = data.workEndTime.split(":").map(Number);
      const startM = sh * 60 + sm;
      let endM = eh * 60 + em;
      if (endM <= startM) endM += 24 * 60;
      const diff = endM - startM;
      if (diff < 1 || diff > 24 * 60) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Проверьте время начала и окончания.", path: ["workEndTime"] });
      }
    }
  });
