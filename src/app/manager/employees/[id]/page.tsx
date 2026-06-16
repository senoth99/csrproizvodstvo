import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ManagerEmployeeProfileClient } from "@/components/ManagerEmployeeProfileClient";
import type { ManagerEmployeeListItem } from "@/components/ManagerEmployeesClient";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import { canOpenManagerPanel } from "@/lib/managerPanel";
import { catchDb } from "@/lib/dbBoundary";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/enums";
import { formatDateRu } from "@/lib/utils";
import { resolveUserAvatarUrl } from "@/lib/userAvatar";

export default async function ManagerEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!canOpenManagerPanel(user)) redirect("/schedule");

  const { id } = await params;

  const loaded = await catchDb(`manager/employees/${id}`, async () => {
    const userRow = await prisma.user.findFirst({
      where: { id, role: UserRole.EMPLOYEE },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        telegramUsername: true,
        telegramPhotoUrl: true,
        avatarUpdatedAt: true,
        color: true,
        ndaSigned: true,
        phone: true
      }
    });
    if (!userRow) return null;

    const [arrivalLogs, peerLikes] = await Promise.all([
      prisma.workplaceArrivalLog.findMany({
        where: { userId: id },
        orderBy: { arrivedAt: "desc" },
        take: 50,
        select: { id: true, arrivedAt: true }
      }),
      prisma.shiftPeerLike.findMany({
        where: { toUserId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          shiftReport: {
            select: {
              shift: {
                select: {
                  zone: { select: { name: true } },
                  startTime: true,
                  endTime: true,
                  weekStartDate: true,
                  dayOfWeek: true
                }
              }
            }
          }
        }
      })
    ]);

    return { userRow, arrivalLogs, peerLikes };
  });

  if (!loaded.ok) return <ServiceUnavailable scope={`manager/employees/${id}`} />;
  const data = loaded.data;
  if (!data) notFound();

  const row = data.userRow;
  const employee: ManagerEmployeeListItem = {
    id: row.id,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    telegramUsername: row.telegramUsername,
    telegramPhotoUrl: resolveUserAvatarUrl(row),
    color: row.color,
    ndaSigned: row.ndaSigned,
    phone: row.phone
  };

  const arrivalHistory = data.arrivalLogs.map((log) => ({
    id: log.id,
    label: formatDateRu(log.arrivedAt, "dd.MM.yyyy HH:mm")
  }));

  const likesHistory = data.peerLikes.map((like) => {
    const shift = like.shiftReport.shift;
    return {
      id: like.id,
      label: formatDateRu(like.createdAt, "dd.MM.yyyy"),
      shiftLabel: `${shift.zone.name} · ${shift.startTime}–${shift.endTime}`
    };
  });

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Link
          href="/manager/employees"
          className="group inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl border border-border bg-transparent px-3 py-2 text-sm font-medium text-muted transition hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" aria-hidden />
          К списку
        </Link>
      </div>
      <p className="text-sm text-muted">Карточка сотрудника</p>

      <ManagerEmployeeProfileClient
        employee={employee}
        arrivalHistory={arrivalHistory}
        likesHistory={likesHistory}
      />
    </div>
  );
}
