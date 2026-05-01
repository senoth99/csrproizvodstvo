export type BrigadeConfig = {
  id: string;
  title: string;
  zoneName: string;
  startTime: string;
  endTime: string;
  shiftLabel: "День" | "Вечер";
  icon: "heat" | "printer" | "scissors" | "cpu" | "warehouse";
};

export const BRIGADES: BrigadeConfig[] = [
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
    id: "dtf-plotter-evening",
    title: "ДТФ и Плоттер",
    zoneName: "ДТФ и Плоттер",
    startTime: "18:00",
    endTime: "02:00",
    shiftLabel: "Вечер",
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
    id: "cnc-evening",
    title: "ЧПУ",
    zoneName: "ЧПУ",
    startTime: "18:00",
    endTime: "02:00",
    shiftLabel: "Вечер",
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
  }
];

export const brigadeKey = (zoneName: string, startTime: string, endTime: string) =>
  `${zoneName}|${startTime}|${endTime}`;
