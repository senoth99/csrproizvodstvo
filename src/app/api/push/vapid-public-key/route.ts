import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/webPush";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ error: "vapid_not_configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}
