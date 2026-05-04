import { clsx, type ClassValue } from "clsx";
import { addDays, getISODay, parseISO, startOfDay, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { twMerge } from "tailwind-merge";

/** Календарь и подписи дат — всегда по Москве (сервер и клиент). */
export const APP_TIME_ZONE = "Europe/Moscow";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Начало календарного дня в Москве (UTC-инстант полуночи по Москве). */
export function startOfAppDay(date: Date): Date {
  const z = toZonedTime(date, APP_TIME_ZONE);
  return fromZonedTime(startOfDay(z), APP_TIME_ZONE);
}

/** Понедельник текущей недели (по Москве), 00:00. */
export const getWeekStart = (date = new Date()) => {
  const z = toZonedTime(date, APP_TIME_ZONE);
  const ws = startOfWeek(z, { weekStartsOn: 1 });
  return fromZonedTime(ws, APP_TIME_ZONE);
};

/** Сдвиг на N календарных дней в часовом поясе приложения (от «московской» даты `date`). */
export function addAppDays(date: Date, amount: number): Date {
  const z = toZonedTime(date, APP_TIME_ZONE);
  return fromZonedTime(addDays(z, amount), APP_TIME_ZONE);
}

export const isSameAppDay = (left: Date, right: Date) =>
  startOfAppDay(left).getTime() === startOfAppDay(right).getTime();

export const isBeforeAppDay = (left: Date, right: Date) =>
  startOfAppDay(left).getTime() < startOfAppDay(right).getTime();

/** ISO день недели 1–7 (пн–вс) по календарю Москвы. */
export const getAppISODay = (date = new Date()) => getISODay(toZonedTime(date, APP_TIME_ZONE));

/** `format` падает RangeError на Invalid Date — на SSR это даёт Internal Server Error. */
export const formatDateRu = (date: Date, pattern = "dd.MM.yyyy") =>
  Number.isFinite(date.getTime()) ? formatInTimeZone(date, APP_TIME_ZONE, pattern, { locale: ru }) : "—";

/** Для ISO из API/пропсов: безопасно для клиентского рендера (в т.ч. SSR). */
export const safeParseISO = (iso: string, fallback = new Date()) => {
  const d = parseISO(iso);
  return Number.isFinite(d.getTime()) ? d : fallback;
};

export const weekDays = Array.from({ length: 7 }, (_, i) => ({
  index: i + 1,
  name: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"][i]
}));

/** Дата слота в неделе `weekStart` (понедельник по Москве) для `dayOfWeek` 1–7. */
export const isoFromWeekDay = (weekStart: Date, dayOfWeek: number) => {
  const z = toZonedTime(weekStart, APP_TIME_ZONE);
  return fromZonedTime(addDays(z, dayOfWeek - 1), APP_TIME_ZONE);
};

export const formatMoneyRu = (amountRub: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(amountRub)))} ₽`;
