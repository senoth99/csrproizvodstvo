/** Ответ server action для мгновенного обновления доски без router.refresh(). */
export type BrigadeBoardShift = {
  id: string;
  userId: string;
  dayOfWeek: number;
  zoneName: string;
  startTime: string;
  endTime: string;
  user: { id: string; name: string; color: string; telegramPhotoUrl: string | null };
};

export type ToggleBrigadeAssignmentResult =
  | { kind: "removed"; shiftId: string }
  | { kind: "removal_requested"; shiftId: string }
  | { kind: "added"; shift: BrigadeBoardShift; removedShiftIds: string[] };

export type ManagerAssignBrigadeResult =
  | { kind: "noop" }
  | { kind: "assigned"; shift: BrigadeBoardShift; removedShiftIds: string[] };

export type ManagerRemoveShiftResult = { kind: "removed"; shiftId: string } | { kind: "noop" };

export function applyToggleBrigadeResult(
  shifts: BrigadeBoardShift[],
  result: ToggleBrigadeAssignmentResult
): BrigadeBoardShift[] {
  if (result.kind === "removed") {
    return shifts.filter((s) => s.id !== result.shiftId);
  }
  if (result.kind === "removal_requested") {
    return shifts;
  }
  const removed = new Set(result.removedShiftIds);
  return [...shifts.filter((s) => !removed.has(s.id)), result.shift];
}

export function applyManagerAssignResult(
  shifts: BrigadeBoardShift[],
  result: ManagerAssignBrigadeResult
): BrigadeBoardShift[] {
  if (result.kind === "noop") return shifts;
  const removed = new Set(result.removedShiftIds);
  return [...shifts.filter((s) => !removed.has(s.id)), result.shift];
}

export function applyManagerRemoveResult(
  shifts: BrigadeBoardShift[],
  result: ManagerRemoveShiftResult
): BrigadeBoardShift[] {
  if (result.kind === "noop") return shifts;
  return shifts.filter((s) => s.id !== result.shiftId);
}
