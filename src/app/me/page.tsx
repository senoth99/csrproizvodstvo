import Link from "next/link";
import { addDays } from "date-fns";
import { ChevronRight, QrCode } from "lucide-react";
import { MeProfileCard } from "@/components/MeProfileCard";
import { MyShiftsSection } from "@/components/MyShiftsSection";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { getMonthlyWorkedMinutesForUser } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { formatMoneyRu, getWeekStart } from "@/lib/utils";
import { formatWorkedMinutes, getCurrentAppMonth } from "@/lib/workedHours";

export default async function MePage() {
  const user = await requireAuth();
  const weekStart = getWeekStart();
  const weekEnd = addDays(weekStart, 14);
  const monthLabel = getCurrentAppMonth().label;
  const loaded = await catchDb("me", async () => {
    const [shifts, balanceRow, monthlyMinutes] = await Promise.all([
      prisma.shift.findMany({
        where: { userId: user.id, weekStartDate: { gte: weekStart, lt: weekEnd } },
        include: { zone: true, report: true },
        orderBy: [{ weekStartDate: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }]
      }),
      prisma.user.findUnique({ where: { id: user.id }, select: { payoutDebtCents: true } }),
      getMonthlyWorkedMinutesForUser(user.id)
    ]);
    return { shifts, payoutDebtCents: balanceRow?.payoutDebtCents ?? 0, monthlyMinutes };
  });
  if (!loaded.ok) return <ServiceUnavailable scope="me" />;
  const { shifts, payoutDebtCents, monthlyMinutes } = loaded.data;
  try {
    return (
      <div className="space-y-4">
        <MeProfileCard
          displayName={user.name}
          telegramUsername={user.telegramUsername ?? "user"}
          telegramPhotoUrl={user.telegramPhotoUrl}
          accentColor={user.color}
          initialFirstName={user.firstName ?? ""}
          initialLastName={user.lastName ?? ""}
        />
        <Link
          href="/check-in"
          className="-mt-2 card flex min-h-[52px] w-full max-w-full touch-manipulation items-center justify-between gap-3 transition-colors hover:bg-foreground/[0.04] active:opacity-90"
          aria-label="Отметить приход на производство"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-transparent">
              <QrCode className="h-5 w-5 text-muted" aria-hidden />
            </span>
            <p className="text-lg font-semibold tracking-tight">Отметить приход</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-muted" aria-hidden />
        </Link>
        <div className="card">
          <p className="ui-section-kicker">Часы за месяц</p>
          <p className="mt-1 text-xs capitalize text-muted">{monthLabel}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatWorkedMinutes(monthlyMinutes)}</p>
        </div>
        <Link
          href="/me/balance"
          className="card flex min-h-[52px] w-full max-w-full touch-manipulation items-center justify-between gap-3 transition-colors hover:bg-foreground/[0.04] active:opacity-90"
          aria-label="Открыть баланс и историю операций"
        >
          <div>
            <p className="ui-section-kicker">Баланс</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoneyRu(payoutDebtCents / 100)}</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-muted" aria-hidden />
        </Link>
        <div className="pt-2">
          <MyShiftsSection
            weekShifts={shifts.map((s) => ({
              id: s.id,
              dayOfWeek: s.dayOfWeek,
              weekStartDateIso: s.weekStartDate.toISOString(),
              startTime: s.startTime,
              endTime: s.endTime,
              status: s.status,
              zoneName: s.zone.name,
              hasReport: Boolean(s.report),
              reportStatus: s.report?.status ?? null
            }))}
          />
        </div>
      </div>
    );
  } catch (e) {
    console.error("[me/page render]", e);
    return <ServiceUnavailable scope="me" />;
  }
}
