export type BrigadeShiftLabel = "День" | "Вечер" | "Ночь";

export type BrigadeConfig = {
  id: string;
  title: string;
  zoneName: string;
  startTime: string;
  endTime: string;
  shiftLabel: BrigadeShiftLabel;
  icon: "heat" | "printer" | "scissors" | "cpu" | "warehouse";
};

export const BRIGADES: BrigadeConfig[] = [
  /* ——— День 10:00–18:00 ——— */
  {
    id: "thermopress-day",
    title: "Термопресс",
    zoneName: "Термопресс",
    startTime: "10:00",
    endTime: "18:00",
    shiftLabel: "День",
    icon: "heat"
  },
  {
    id: "dtf-plotter-day",
    title: "ДТФ и Плоттер",
    zoneName: "ДТФ и Плоттер",
    startTime: "10:00",
    endTime: "18:00",
    shiftLabel: "День",
    icon: "printer"
  },
  {
    id: "cutting-day",
    title: "Вырезальщики",
    zoneName: "Вырезальщики",
    startTime: "10:00",
    endTime: "18:00",
    shiftLabel: "День",
    icon: "scissors"
  },
  {
    id: "cnc-day",
    title: "ЧПУ",
    zoneName: "ЧПУ",
    startTime: "10:00",
    endTime: "18:00",
    shiftLabel: "День",
    icon: "cpu"
  },
  {
    id: "warehouse-day",
    title: "Склад",
    zoneName: "Склад",
    startTime: "10:00",
    endTime: "18:00",
    shiftLabel: "День",
    icon: "warehouse"
  },
  /* ——— Вечер 18:00–00:00 ——— */
  {
    id: "thermopress-evening",
    title: "Термопресс",
    zoneName: "Термопресс",
    startTime: "18:00",
    endTime: "00:00",
    shiftLabel: "Вечер",
    icon: "heat"
  },
  {
    id: "dtf-plotter-evening",
    title: "ДТФ и Плоттер",
    zoneName: "ДТФ и Плоттер",
    startTime: "18:00",
    endTime: "00:00",
    shiftLabel: "Вечер",
    icon: "printer"
  },
  {
    id: "cutting-evening",
    title: "Вырезальщики",
    zoneName: "Вырезальщики",
    startTime: "18:00",
    endTime: "00:00",
    shiftLabel: "Вечер",
    icon: "scissors"
  },
  {
    id: "cnc-evening",
    title: "ЧПУ",
    zoneName: "ЧПУ",
    startTime: "18:00",
    endTime: "00:00",
    shiftLabel: "Вечер",
    icon: "cpu"
  },
  {
    id: "warehouse-evening",
    title: "Склад",
    zoneName: "Склад",
    startTime: "18:00",
    endTime: "00:00",
    shiftLabel: "Вечер",
    icon: "warehouse"
  },
  /* ——— Ночь 20:00–02:00 (только ЧПУ, термопресс, вырезальщики) ——— */
  {
    id: "thermopress-night",
    title: "Термопресс",
    zoneName: "Термопресс",
    startTime: "20:00",
    endTime: "02:00",
    shiftLabel: "Ночь",
    icon: "heat"
  },
  {
    id: "cutting-night",
    title: "Вырезальщики",
    zoneName: "Вырезальщики",
    startTime: "20:00",
    endTime: "02:00",
    shiftLabel: "Ночь",
    icon: "scissors"
  },
  {
    id: "cnc-night",
    title: "ЧПУ",
    zoneName: "ЧПУ",
    startTime: "20:00",
    endTime: "02:00",
    shiftLabel: "Ночь",
    icon: "cpu"
  }
];

export const brigadeKey = (zoneName: string, startTime: string, endTime: string) =>
  `${zoneName}|${startTime}|${endTime}`;
