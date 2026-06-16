import { redirect } from "next/navigation";
import { AuthDbError, getCurrentUser, isProfileReady } from "@/lib/auth";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { WelcomeProfileForm } from "@/components/WelcomeProfileForm";

export default async function WelcomePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) return <ServiceUnavailable scope="welcome" />;
    throw e;
  }
  if (!user) redirect("/login");
  if (isProfileReady(user)) redirect("/schedule");

  return (
    <WelcomeProfileForm
      initialFirstName={user.firstName ?? ""}
      initialLastName={user.lastName ?? ""}
      initialPhone={user.phone ?? ""}
    />
  );
}
