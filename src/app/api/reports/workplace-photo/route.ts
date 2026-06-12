import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthDbError, getCurrentUser } from "@/lib/auth";
import { ShiftReportStatus, ShiftStatus, UserRole } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { detectImageFromBuffer } from "@/lib/imageMagicBytes";
import {
  getReportPhotoApiPath,
  getReportPhotoDiskPath,
  resolveReportPhotoDiskPath
} from "@/lib/workplaceReportPhoto";

const MAX_BYTES = 3 * 1024 * 1024;

function userCanViewReportPhoto(
  viewer: { id: string; role: string; isManager?: boolean | null },
  shift: { userId: string }
) {
  if (shift.userId === viewer.id) return true;
  return (
    viewer.role === UserRole.ADMIN ||
    viewer.role === UserRole.SUPER_ADMIN ||
    Boolean(viewer.isManager)
  );
}

export async function GET(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/reports/workplace-photo GET] auth DB", e);
      return new NextResponse(null, { status: 503 });
    }
    console.error("[api/reports/workplace-photo GET] session", e);
    return new NextResponse(null, { status: 503 });
  }
  if (!user) return new NextResponse(null, { status: 401 });

  const url = new URL(req.url);
  const parsed = z.string().cuid().safeParse(url.searchParams.get("shiftId"));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const shiftId = parsed.data;

  try {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { userId: true }
    });
    if (!shift || !userCanViewReportPhoto(user, shift)) {
      return new NextResponse(null, { status: 403 });
    }

    const diskPath = resolveReportPhotoDiskPath(shiftId);
    if (!diskPath) return new NextResponse(null, { status: 404 });

    const buf = await readFile(diskPath);
    const detected = detectImageFromBuffer(buf);
    if (!detected) return new NextResponse(null, { status: 415 });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": detected.mime,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (e) {
    console.error("[api/reports/workplace-photo GET]", e);
    return new NextResponse(null, { status: 500 });
  }
}

export async function POST(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/reports/workplace-photo POST] auth DB", e);
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }
    console.error("[api/reports/workplace-photo POST] session", e);
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const detected = detectImageFromBuffer(buffer);
  if (!detected) {
    return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
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

    const absPath = getReportPhotoDiskPath(shiftId);
    const { writeFile } = await import("fs/promises");
    await writeFile(absPath, buffer);

    return NextResponse.json({ path: getReportPhotoApiPath(shiftId) });
  } catch (e) {
    console.error("[api/reports/workplace-photo POST]", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
