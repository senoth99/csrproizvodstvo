import { redirect } from "next/navigation";
import { AuthScreenShell } from "@/components/AuthScreenShell";
import { AuthDbError, getCurrentUser } from "@/lib/auth";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { shouldSkipApprovalCheck } from "@/lib/testMode";

export default async function PendingApprovalPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) return <ServiceUnavailable scope="pending-approval" />;
    throw e;
  }

  if (!user) redirect("/login");

  const status = user.approvalStatus ?? "APPROVED";
  if (shouldSkipApprovalCheck() || status === "APPROVED") redirect("/schedule");
  if (status === "REJECTED") redirect("/access-denied");

  return (
    <AuthScreenShell
      title="Ожидание одобрения"
      description="Ваша регистрация отправлена администратору. После одобрения вы сможете пользоваться приложением."
    >
      <p className="text-center text-sm text-muted">
        Обычно это занимает немного времени. Страница обновится после одобрения — попробуйте войти позже.
      </p>
    </AuthScreenShell>
  );
}
