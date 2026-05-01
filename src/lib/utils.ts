import { clsx, type ClassValue } from "clsx";
import { addDays, format, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const getWeekStart = (date = new Date()) =>
  startOfWeek(date, { weekStartsOn: 1 });

export const formatDateRu = (date: Date, pattern = "dd.MM.yyyy") =>
  format(date, pattern, { locale: ru });

export const weekDays = Array.from({ length: 7 }, (_, i) => ({
  index: i + 1,
  name: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"][i]
}));

export const isoFromWeekDay = (weekStart: Date, dayOfWeek: number) =>
  addDays(weekStart, dayOfWeek - 1);
