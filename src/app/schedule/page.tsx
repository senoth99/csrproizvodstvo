import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import { BRIGADES } from "@/lib/brigades";
import { BrigadeBoard } from "@/components/BrigadeBoard";
import { WeekModeSwitch } from "@/components/WeekModeSwitch";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { catchAuth, catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { prismaUserShiftBoardSelect } from "@/lib/prismaSafeUserInclude";
import { getWeekStart } from "@/lib/utils";
import { addDays } from "date-fns";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const authResult = await catchAuth(() => requireAuth());
  if (!authResult.ok) return <ServiceUnavailable scope="schedule" />;
  const user = authResult.data;
  const params = await searchParams;
  const weekMode: "current" | "next" = params.week === "next" ? "next" : "current";
  const currentWeekStart = getWeekStart(new Date());
  const nextWeekStart = addDays(currentWeekStart, 7);
  const weekStartDate = weekMode === "next" ? nextWeekStart : currentWeekStart;
  const canManageSchedule = canOpenManagerPanel(user);
  const shiftsLoaded = await catchDb("schedule/shifts", () =>
    prisma.shift.findMany({
      where: { weekStartDate },
      include: { user: { select: prismaUserShiftBoardSelect }, zone: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    })
  );
  if (!shiftsLoaded.ok) return <ServiceUnavailable scope="schedule/shifts" />;

  let assignableEmployees: {
    id: string;
    name: string;
    color: string;
    telegramPhotoUrl: string | null;
  }[] = [];
  if (canManageSchedule) {
    const employeesLoaded = await catchDb("schedule/employees", () =>
      prisma.user.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          telegramPhotoUrl: true
        }
      })
    );
    if (!employeesLoaded.ok) return <ServiceUnavailable scope="schedule/employees" />;
    assignableEmployees = employeesLoaded.data.map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color,
      telegramPhotoUrl: u.telegramPhotoUrl ?? null
    }));
  }

  try {
    const shifts = shiftsLoaded.data;
    const allowedKeys = new Set(BRIGADES.map((b) => `${b.zoneName}|${b.startTime}|${b.endTime}`));
    const boardShifts = shifts
      .filter(
        (s) =>
          s.user &&
          s.zone &&
          allowedKeys.has(`${s.zone.name}|${s.startTime}|${s.endTime}`)
      )
      .map((s) => ({
        id: s.id,
        userId: s.userId,
        dayOfWeek: s.dayOfWeek,
        zoneName: s.zone!.name,
        startTime: s.startTime,
        endTime: s.endTime,
        user: {
          id: s.user!.id,
          name: s.user!.name,
          color: s.user!.color,
          telegramPhotoUrl: s.user!.telegramPhotoUrl ?? null
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
          canManageSchedule={canManageSchedule}
          assignableEmployees={assignableEmployees}
        />
      </div>
    );
  } catch (e) {
    console.error("[schedule/page render]", e);
    return <ServiceUnavailable scope="schedule" />;
  }
}
