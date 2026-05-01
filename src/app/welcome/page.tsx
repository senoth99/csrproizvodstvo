import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { WelcomeProfileForm } from "@/components/WelcomeProfileForm";

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/telegram/login");
  if (user.profileCompleted) redirect("/schedule");

  return <WelcomeProfileForm />;
}
