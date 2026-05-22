import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ShiftReportStatus, ShiftStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("[api/reports/workplace-photo] session", e);
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const shiftIdRaw = form.get("shiftId");
  const file = form.get("file");
  const shiftParsed = z.string().cuid().safeParse(shiftIdRaw);
  if (!shiftParsed.success) {
    return NextResponse.json({ error: "invalid_shift_id" }, { status: 400 });
  }
  const shiftId = shiftParsed.data;

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  try {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { report: { select: { status: true } } }
    });
    if (!shift) return NextResponse.json({ error: "shift_not_found" }, { status: 404 });
    if (shift.userId !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (shift.status === ShiftStatus.CANCELLED) {
      return NextResponse.json({ error: "shift_cancelled" }, { status: 400 });
    }
    if (shift.report?.status === ShiftReportStatus.ACCEPTED) {
      return NextResponse.json({ error: "report_accepted" }, { status: 400 });
    }

    const relDir = path.join("uploads", "reports");
    const absDir = path.join(process.cwd(), "public", relDir);
    mkdirSync(absDir, { recursive: true });
    const filename = `${shiftId}.jpg`;
    const absPath = path.join(absDir, filename);
    await writeFile(absPath, buffer);

    const webPath = `/${relDir.replace(/\\/g, "/")}/${filename}`;
    return NextResponse.json({ path: webPath });
  } catch (e) {
    console.error("[api/reports/workplace-photo]", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
