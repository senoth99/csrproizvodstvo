import Link from "next/link";
import { ChevronRight, HandCoins, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { ManagerPanelInsights } from "@/components/ManagerPanelInsights";
import { ManagerTodayBrigades } from "@/components/ManagerTodayBrigades";
import { requireAuth } from "@/lib/auth";
import { BRIGADES } from "@/lib/brigades";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { catchDb } from "@/lib/dbBoundary";
import { ShiftStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { prismaUserShiftBoardSelect } from "@/lib/prismaSafeUserInclude";
import { addAppDays, formatDateRu, getAppISODay, getWeekStart, startOfAppDay, weekDays } from "@/lib/utils";
import { resolveUserAvatarUrl } from "@/lib/userAvatar";

export const dynamic = "force-dynamic";

export default async function ManagerPanelPage() {
  const user = await requireAuth();
  if (!canOpenManagerPanel(user)) redirect("/schedule");

  const today = new Date();
  const weekStart = getWeekStart(today);
  const dayOfWeek = getAppISODay(today);
  const weekdayLabel = weekDays.find((d) => d.index === dayOfWeek)?.name ?? "Сегодня";
  const dateLabel = formatDateRu(today, "dd.MM.yyyy");

  const todayLoaded = await catchDb("manager/today-brigades", async () => {
    const dayStart = startOfAppDay(today);
    const dayEnd = addAppDays(today, 1);

    const [shifts, peerLikes, arrivalLogs] = await Promise.all([
      prisma.shift.findMany({
        where: {
          weekStartDate: weekStart,
          dayOfWeek,
          status: { not: ShiftStatus.CANCELLED }
        },
        include: { user: { select: prismaUserShiftBoardSelect }, zone: true }
      }),
      prisma.shiftPeerLike.findMany({
        where: {
          shiftReport: {
            shift: {
              weekStartDate: weekStart,
              dayOfWeek
            }
          }
        },
        select: {
          toUser: { select: prismaUserShiftBoardSelect }
        }
      }),
      prisma.workplaceArrivalLog.findMany({
        where: { arrivedAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { arrivedAt: "desc" },
        select: {
          id: true,
          arrivedAt: true,
          user: { select: prismaUserShiftBoardSelect }
        }
      })
    ]);

    return { shifts, peerLikes, arrivalLogs };
  });

  const allowedKeys = new Set(BRIGADES.map((b) => `${b.zoneName}|${b.startTime}|${b.endTime}`));

  const todayArrivals = todayLoaded.ok
    ? todayLoaded.data.arrivalLogs.map((row) => ({
        id: row.id,
        userId: row.user.id,
        name: row.user.name,
        color: row.user.color,
        telegramPhotoUrl: resolveUserAvatarUrl(row.user),
        arrivedAtIso: row.arrivedAt.toISOString(),
        arrivedAtLabel: formatDateRu(row.arrivedAt, "HH:mm")
      }))
    : [];

  const latestArrivalByUser = new Map<string, string>();
  for (const row of todayArrivals) {
    if (!latestArrivalByUser.has(row.userId)) {
      latestArrivalByUser.set(row.userId, row.arrivedAtLabel);
    }
  }

  const todayShifts =
    todayLoaded.ok
      ? todayLoaded.data.shifts
          .filter((s) => allowedKeys.has(`${s.zone.name}|${s.startTime}|${s.endTime}`))
          .map((s) => ({
            id: s.id,
            zoneName: s.zone.name,
            startTime: s.startTime,
            endTime: s.endTime,
            user: {
              name: s.user.name,
              color: s.user.color,
              telegramPhotoUrl: resolveUserAvatarUrl(s.user)
            },
            arrivalLabel: latestArrivalByUser.get(s.user.id) ?? null
          }))
      : [];

  const likeCounts = new Map<
    string,
    { user: { id: string; name: string; color: string; telegramPhotoUrl: string | null }; count: number }
  >();
  if (todayLoaded.ok) {
    for (const row of todayLoaded.data.peerLikes) {
      const existing = likeCounts.get(row.toUser.id);
      if (existing) {
        existing.count += 1;
      } else {
        likeCounts.set(row.toUser.id, {
          user: { ...row.toUser, telegramPhotoUrl: resolveUserAvatarUrl(row.toUser) },
          count: 1
        });
      }
    }
  }
  const todayLikes = todayLoaded.ok
    ? [...likeCounts.values()]
        .sort((a, b) => b.count - a.count || a.user.name.localeCompare(b.user.name, "ru"))
        .map(({ user, count }) => ({
          userId: user.id,
          name: user.name,
          color: user.color,
          telegramPhotoUrl: user.telegramPhotoUrl ?? null,
          count
        }))
    : [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold uppercase tracking-display sm:text-3xl">Панель руководителя</h1>

      {todayLoaded.ok ? (
        <ManagerTodayBrigades
          brigades={BRIGADES}
          shifts={todayShifts}
          weekdayLabel={weekdayLabel}
          dateLabel={dateLabel}
        />
      ) : (
        <p className="text-sm text-muted">Не удалось загрузить бригады на сегодня. Обновите страницу позже.</p>
      )}

      {todayLoaded.ok ? <ManagerPanelInsights likes={todayLikes} arrivals={todayArrivals} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/manager/employees"
          className="card flex min-h-[52px] touch-manipulation items-center gap-3 transition-colors hover:bg-foreground/[0.04]"
          aria-label="Сотрудники"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-transparent">
            <Users className="h-5 w-5 text-muted" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">Сотрудники</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </Link>

        <Link
          href="/manager/payouts"
          className="card flex min-h-[52px] touch-manipulation items-center gap-3 transition-colors hover:bg-foreground/[0.04]"
          aria-label="Выплаты"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-transparent">
            <HandCoins className="h-5 w-5 text-muted" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">Выплаты</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
