import { requireAuth } from "@/lib/auth";
import { BRIGADES } from "@/lib/brigades";
import { BrigadeBoard } from "@/components/BrigadeBoard";
import { WeekModeSwitch } from "@/components/WeekModeSwitch";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/utils";
import { addDays } from "date-fns";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireAuth();
  const params = await searchParams;
  const weekMode: "current" | "next" = params.week === "next" ? "next" : "current";
  const currentWeekStart = getWeekStart(new Date());
  const nextWeekStart = addDays(currentWeekStart, 7);
  const weekStartDate = weekMode === "next" ? nextWeekStart : currentWeekStart;
  const shifts = await prisma.shift.findMany({
    where: { weekStartDate },
    include: { user: true, zone: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
  });
  const allowedKeys = new Set(BRIGADES.map((b) => `${b.zoneName}|${b.startTime}|${b.endTime}`));
  const boardShifts = shifts
    .filter((s) => allowedKeys.has(`${s.zone.name}|${s.startTime}|${s.endTime}`))
    .map((s) => ({
      id: s.id,
      userId: s.userId,
      dayOfWeek: s.dayOfWeek,
      zoneName: s.zone.name,
      startTime: s.startTime,
      endTime: s.endTime,
      user: {
        id: s.user.id,
        name: s.user.name,
        color: s.user.color,
        telegramPhotoUrl: s.user.telegramPhotoUrl ?? null
      }
    }));
  return (
    <div className="space-y-4">
      <WeekModeSwitch
        mode={weekMode}
        currentWeekStartIso={currentWeekStart.toISOString()}
        nextWeekStartIso={nextWeekStart.toISOString()}
      />
      <BrigadeBoard
        brigades={BRIGADES}
        shifts={boardShifts}
        currentUserId={user.id}
        weekStartDateIso={weekStartDate.toISOString()}
        weekMode={weekMode}
      />
    </div>
  );
}
