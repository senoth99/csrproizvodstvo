import { redirect } from "next/navigation";

export default async function TokenLoginPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/api/login/token/${token}`);
}
