export type BrigadeShiftLabel = "День" | "Вечер";

export type BrigadeConfig = {
  id: string;
  title: string;
  zoneName: string;
  startTime: string;
  endTime: string;
  shiftLabel: BrigadeShiftLabel;
  icon: "heat" | "printer" | "scissors" | "cpu" | "warehouse" | "pack";
};

const DAY_SLOT = { startTime: "10:00", endTime: "18:00", shiftLabel: "День" as const };
const EVENING_SLOT = { startTime: "18:00", endTime: "00:00", shiftLabel: "Вечер" as const };

/** (д) — только день; (дв) — день и вечер. */
export const BRIGADES: BrigadeConfig[] = [
  /* ——— День 10:00–18:00 ——— */
  {
    id: "printer-dtf-day",
    title: "Принтер+ДТФ",
    zoneName: "Принтер+ДТФ",
    ...DAY_SLOT,
    icon: "printer"
  },
  {
    id: "calender-plotter-day",
    title: "Коландр + Плоттер",
    zoneName: "Коландр + Плоттер",
    ...DAY_SLOT,
    icon: "printer"
  },
  {
    id: "cnc-day",
    title: "ЧПУ",
    zoneName: "ЧПУ",
    ...DAY_SLOT,
    icon: "cpu"
  },
  {
    id: "cutting-day",
    title: "Вырезашки",
    zoneName: "Вырезашки",
    ...DAY_SLOT,
    icon: "scissors"
  },
  {
    id: "thermopress-day",
    title: "Термопресс",
    zoneName: "Термопресс",
    ...DAY_SLOT,
    icon: "heat"
  },
  {
    id: "kitting-day",
    title: "Комплектовка",
    zoneName: "Комплектовка",
    ...DAY_SLOT,
    icon: "pack"
  },
  {
    id: "warehouse-day",
    title: "Склад",
    zoneName: "Склад",
    ...DAY_SLOT,
    icon: "warehouse"
  },
  {
    id: "warehouse-staff-day",
    title: "Сотрудник склада",
    zoneName: "Сотрудник склада",
    ...DAY_SLOT,
    icon: "warehouse"
  },
  /* ——— Вечер 18:00–00:00 (только направления д/в) ——— */
  {
    id: "cnc-evening",
    title: "ЧПУ",
    zoneName: "ЧПУ",
    ...EVENING_SLOT,
    icon: "cpu"
  },
  {
    id: "cutting-evening",
    title: "Вырезашки",
    zoneName: "Вырезашки",
    ...EVENING_SLOT,
    icon: "scissors"
  },
  {
    id: "thermopress-evening",
    title: "Термопресс",
    zoneName: "Термопресс",
    ...EVENING_SLOT,
    icon: "heat"
  },
  {
    id: "kitting-evening",
    title: "Комплектовка",
    zoneName: "Комплектовка",
    ...EVENING_SLOT,
    icon: "pack"
  }
];

export const brigadeKey = (zoneName: string, startTime: string, endTime: string) =>
  `${zoneName}|${startTime}|${endTime}`;
