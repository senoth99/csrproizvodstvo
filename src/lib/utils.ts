import { clsx, type ClassValue } from "clsx";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const getWeekStart = (date = new Date()) =>
  startOfWeek(date, { weekStartsOn: 1 });

/** `date-fns/format` падает RangeError на Invalid Date — на SSR это даёт Internal Server Error. */
export const formatDateRu = (date: Date, pattern = "dd.MM.yyyy") =>
  Number.isFinite(date.getTime()) ? format(date, pattern, { locale: ru }) : "—";

/** Для ISO из API/пропсов: безопасно для клиентского рендера (в т.ч. SSR). */
export const safeParseISO = (iso: string, fallback = new Date()) => {
  const d = parseISO(iso);
  return Number.isFinite(d.getTime()) ? d : fallback;
};

export const weekDays = Array.from({ length: 7 }, (_, i) => ({
  index: i + 1,
  name: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"][i]
}));

export const isoFromWeekDay = (weekStart: Date, dayOfWeek: number) =>
  addDays(weekStart, dayOfWeek - 1);

export const formatMoneyRu = (amountRub: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(amountRub)))} ₽`;
