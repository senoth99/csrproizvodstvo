import { addDays } from "date-fns";
import { MyShiftsSection } from "@/components/MyShiftsSection";
import { ProfileNameForm } from "@/components/ProfileNameForm";
import { UserAvatar } from "@/components/UserAvatar";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/utils";

export default async function MePage() {
  const user = await requireAuth();
  const weekStart = getWeekStart();
  const currentWeekEnd = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 14);
  const shifts = await prisma.shift.findMany({
    where: { userId: user.id, weekStartDate: { gte: weekStart, lt: weekEnd } },
    include: { zone: true, report: true },
    orderBy: [{ weekStartDate: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }]
  });
  const allShifts = await prisma.shift.findMany({
    where: { userId: user.id },
    include: { zone: true, report: true },
    orderBy: [{ weekStartDate: "desc" }, { dayOfWeek: "desc" }, { startTime: "asc" }]
  });
  const hours = shifts
    .filter((s) => s.weekStartDate >= weekStart && s.weekStartDate < currentWeekEnd)
    .reduce((acc, s) => acc + (Number(s.endTime.slice(0, 2)) - Number(s.startTime.slice(0, 2))), 0);
  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={user.name} photoUrl={user.telegramPhotoUrl} color={user.color} size="lg" />
          <div>
            <h1 className="text-xl font-bold">{user.name}</h1>
            <p className="text-xs text-muted">@{user.telegramUsername ?? "user"}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface px-3 py-2 text-center">
          <p className="text-[11px] text-muted">Часы за неделю</p>
          <p className="text-lg font-bold">{hours}</p>
        </div>
      </div>
      <ProfileNameForm initialFirstName={user.firstName ?? ""} initialLastName={user.lastName ?? ""} />
      <MyShiftsSection
        weekShifts={shifts.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          weekStartDateIso: s.weekStartDate.toISOString(),
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          zoneName: s.zone.name,
          hasReport: Boolean(s.report)
        }))}
        allShifts={allShifts.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          weekStartDateIso: s.weekStartDate.toISOString(),
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          zoneName: s.zone.name,
          hasReport: Boolean(s.report)
        }))}
      />
    </div>
  );
}
