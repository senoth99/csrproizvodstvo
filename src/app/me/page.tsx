import Link from "next/link";
import { addDays } from "date-fns";
import { ChevronRight } from "lucide-react";
import { MeProfileCard } from "@/components/MeProfileCard";
import { MyShiftsSection } from "@/components/MyShiftsSection";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { formatMoneyRu, getWeekStart } from "@/lib/utils";

export default async function MePage() {
  const user = await requireAuth();
  const weekStart = getWeekStart();
  const weekEnd = addDays(weekStart, 14);
  const loaded = await catchDb("me", async () => {
    const [shifts, balanceRow] = await Promise.all([
      prisma.shift.findMany({
        where: { userId: user.id, weekStartDate: { gte: weekStart, lt: weekEnd } },
        include: { zone: true, report: true },
        orderBy: [{ weekStartDate: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }]
      }),
      prisma.user.findUnique({ where: { id: user.id }, select: { payoutDebtCents: true } })
    ]);
    return { shifts, payoutDebtCents: balanceRow?.payoutDebtCents ?? 0 };
  });
  if (!loaded.ok) return <ServiceUnavailable scope="me" />;
  const { shifts, payoutDebtCents } = loaded.data;
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
          href="/me/balance"
          className="-mt-2 card flex min-h-[52px] w-full max-w-full touch-manipulation items-center justify-between gap-3 transition-colors hover:bg-foreground/[0.04] active:opacity-90"
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
