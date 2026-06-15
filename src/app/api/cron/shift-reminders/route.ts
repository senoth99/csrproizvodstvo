import { NextResponse } from "next/server";
import { sendTomorrowShiftReminders } from "@/lib/shiftReminders";

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers.get("x-cron-secret")?.trim();
  return header === secret;
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await sendTomorrowShiftReminders({ force });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[api/cron/shift-reminders]", e);
    return NextResponse.json({ error: "reminder_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
