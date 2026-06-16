import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import { BRIGADES } from "@/lib/brigades";
import { BrigadeBoard } from "@/components/BrigadeBoard";
import { ScheduleMonthSwitch } from "@/components/ScheduleMonthSwitch";
import { ScheduleMonthTable } from "@/components/ScheduleMonthTable";
import { ScheduleViewSwitch, type ScheduleView } from "@/components/ScheduleViewSwitch";
import { ScheduleWeekTable } from "@/components/ScheduleWeekTable";
import { WeekModeSwitch } from "@/components/WeekModeSwitch";
import { canAssignShiftsToOthers, canRemoveShifts } from "@/lib/managerPanel";
import { getCachedActiveEmployeesForSchedule } from "@/lib/cache";
import { catchAuth, catchDb } from "@/lib/dbBoundary";
import { ShiftStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { prismaUserShiftBoardSelect } from "@/lib/prismaSafeUserInclude";
import {
  buildMonthScheduleTable,
  buildWeekScheduleTable,
  getAppMonthMeta,
  mapShiftToTableInput,
  parseMonthParam
} from "@/lib/scheduleTable";
import { getCurrentAppMonth } from "@/lib/workedHours";
import { addAppDays, getWeekStart } from "@/lib/utils";
import { resolveUserAvatarUrl } from "@/lib/userAvatar";

const scheduleUserSelect = {
  ...prismaUserShiftBoardSelect,
  firstName: true,
  lastName: true
};

function parseView(raw: string | undefined): ScheduleView {
  if (raw === "table" || raw === "month") return raw;
  return "brigades";
}

export default async function SchedulePage({
  searchParams
}: {
  searchParams: Promise<{ week?: string; view?: string; month?: string }>;
}) {
  const authResult = await catchAuth(() => requireAuth());
  if (!authResult.ok) return <ServiceUnavailable scope="schedule" />;
  const user = authResult.data;
  const params = await searchParams;
  const view = parseView(params.view);
  const weekMode: "current" | "next" = params.week === "next" ? "next" : "current";
  const currentWeekStart = getWeekStart(new Date());
  const nextWeekStart = addAppDays(currentWeekStart, 7);
  const weekStartDate = weekMode === "next" ? nextWeekStart : currentWeekStart;
  const canManageSchedule = canAssignShiftsToOthers(user);
  const canRemoveScheduleShifts = canRemoveShifts(user);

  const currentMonth = getCurrentAppMonth();
  const monthParsed = parseMonthParam(params.month) ?? { year: currentMonth.year, month: currentMonth.month };
  const monthMeta = getAppMonthMeta(monthParsed.year, monthParsed.month);

  const needEmployees = canManageSchedule && view === "brigades";

  const [loaded, employeesLoaded] = await Promise.all([
    catchDb("schedule/shifts", async () => {
      if (view === "month") {
        const monthShifts = await prisma.shift.findMany({
          where: {
            weekStartDate: { in: monthMeta.weekStarts },
            status: { not: ShiftStatus.CANCELLED }
          },
          include: { user: { select: scheduleUserSelect }, zone: true },
          orderBy: [{ weekStartDate: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }]
        });
        return { weekShifts: [], monthShifts };
      }

      const weekShifts = await prisma.shift.findMany({
        where: { weekStartDate, status: { not: ShiftStatus.CANCELLED } },
        include: { user: { select: scheduleUserSelect }, zone: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
      });
      return { weekShifts, monthShifts: [] as typeof weekShifts };
    }),
    needEmployees
      ? catchDb("schedule/employees", () => getCachedActiveEmployeesForSchedule())
      : Promise.resolve({ ok: true as const, data: [] as Awaited<ReturnType<typeof getCachedActiveEmployeesForSchedule>> })
  ]);

  if (!loaded.ok) return <ServiceUnavailable scope="schedule/shifts" />;

  let assignableEmployees: {
    id: string;
    name: string;
    color: string;
    telegramPhotoUrl: string | null;
  }[] = [];
  if (needEmployees) {
    if (!employeesLoaded.ok) return <ServiceUnavailable scope="schedule/employees" />;
    assignableEmployees = employeesLoaded.data.map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color,
      telegramPhotoUrl: resolveUserAvatarUrl(u)
    }));
  }

  try {
    const { weekShifts, monthShifts } = loaded.data;
    const allowedKeys = new Set(BRIGADES.map((b) => `${b.zoneName}|${b.startTime}|${b.endTime}`));

    const boardShifts = weekShifts
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
          telegramPhotoUrl: resolveUserAvatarUrl(s.user!)
        }
      }));

    const tableWeekInputs = weekShifts
      .filter((s) => s.user && s.zone)
      .map((s) => mapShiftToTableInput({ ...s, user: s.user!, zone: s.zone! }));

    const tableMonthInputs = monthShifts
      .filter((s) => s.user && s.zone)
      .map((s) => mapShiftToTableInput({ ...s, user: s.user!, zone: s.zone! }));

    const weekTableRows = buildWeekScheduleTable(tableWeekInputs);
    const monthTableRows = buildMonthScheduleTable(
      tableMonthInputs,
      monthParsed.year,
      monthParsed.month,
      monthMeta.daysInMonth
    );

    return (
      <div className="space-y-4">
        <ScheduleViewSwitch
          view={view}
          weekMode={weekMode}
          monthYear={monthParsed.year}
          monthMonth={monthParsed.month}
        />

        {view === "brigades" ? (
          <>
            <WeekModeSwitch
              mode={weekMode}
              currentWeekStartIso={currentWeekStart.toISOString()}
              nextWeekStartIso={nextWeekStart.toISOString()}
              scheduleView="brigades"
              monthYear={monthParsed.year}
              monthMonth={monthParsed.month}
            />
            <BrigadeBoard
              brigades={BRIGADES}
              shifts={boardShifts}
              currentUserId={user.id}
              weekStartDateIso={weekStartDate.toISOString()}
              weekMode={weekMode}
              canManageSchedule={canManageSchedule}
              canRemoveShifts={canRemoveScheduleShifts}
              assignableEmployees={assignableEmployees}
            />
          </>
        ) : null}

        {view === "table" ? (
          <>
            <WeekModeSwitch
              mode={weekMode}
              currentWeekStartIso={currentWeekStart.toISOString()}
              nextWeekStartIso={nextWeekStart.toISOString()}
              scheduleView="table"
              monthYear={monthParsed.year}
              monthMonth={monthParsed.month}
            />
            <ScheduleWeekTable employees={weekTableRows} weekStartDateIso={weekStartDate.toISOString()} />
          </>
        ) : null}

        {view === "month" ? (
          <div data-no-swipe="true" className="space-y-3">
            <ScheduleMonthSwitch
              year={monthParsed.year}
              month={monthParsed.month}
              label={monthMeta.label}
              weekMode={weekMode}
            />
            <ScheduleMonthTable employees={monthTableRows} days={monthMeta.days} />
          </div>
        ) : null}
      </div>
    );
  } catch (e) {
    console.error("[schedule/page render]", e);
    return <ServiceUnavailable scope="schedule" />;
  }
}
