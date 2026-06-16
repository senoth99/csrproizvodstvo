import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckInClient } from "@/components/CheckInClient";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { requireAuth } from "@/lib/auth";
import { catchAuth, catchDb } from "@/lib/dbBoundary";
import { canStartShiftViaQrToday, findUserShiftToday } from "@/lib/todayShift";

export default async function CheckInPage() {
  const authResult = await catchAuth(() => requireAuth());
  if (!authResult.ok) return <ServiceUnavailable scope="check-in/auth" />;
  const user = authResult.data;

  const loaded = await catchDb("check-in", () => findUserShiftToday(user.id));
  if (!loaded.ok) return <ServiceUnavailable scope="check-in" />;

  const todayShift = loaded.data;
  if (!canStartShiftViaQrToday(todayShift)) {
    redirect("/me");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">Загрузка…</div>
      }
    >
      <CheckInClient zoneName={todayShift.zone.name} />
    </Suspense>
  );
}
