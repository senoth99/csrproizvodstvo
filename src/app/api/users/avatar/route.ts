import { readFile, unlink, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { AuthDbError, getCurrentUser } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache";
import { detectImageFromBuffer } from "@/lib/imageMagicBytes";
import { prisma } from "@/lib/prisma";
import {
  AVATAR_HTTP_CACHE_CONTROL,
  getAvatarApiPath,
  getAvatarDiskPath,
  resolveAvatarDiskPath
} from "@/lib/userAvatar";

const MAX_BYTES = 512 * 1024;

export async function GET(req: Request) {
  let viewer;
  try {
    viewer = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/users/avatar GET] auth DB", e);
      return new NextResponse(null, { status: 503 });
    }
    console.error("[api/users/avatar GET] session", e);
    return new NextResponse(null, { status: 503 });
  }
  if (!viewer) return new NextResponse(null, { status: 401 });

  const url = new URL(req.url);
  const parsed = z.string().cuid().safeParse(url.searchParams.get("userId"));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const userId = parsed.data;

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, avatarUpdatedAt: true }
    });
    if (!target?.isActive || !target.avatarUpdatedAt) {
      return new NextResponse(null, { status: 404 });
    }

    const diskPath = resolveAvatarDiskPath(userId);
    if (!diskPath) return new NextResponse(null, { status: 404 });

    const version =
      url.searchParams.get("v")?.trim() ||
      String(target.avatarUpdatedAt.getTime());
    const etag = `"${userId}-${version}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": AVATAR_HTTP_CACHE_CONTROL
        }
      });
    }

    const buf = await readFile(diskPath);
    const detected = detectImageFromBuffer(buf);
    if (!detected) return new NextResponse(null, { status: 415 });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": detected.mime,
        ETag: etag,
        "Cache-Control": AVATAR_HTTP_CACHE_CONTROL
      }
    });
  } catch (e) {
    console.error("[api/users/avatar GET]", e);
    return new NextResponse(null, { status: 500 });
  }
}

export async function POST(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/users/avatar POST] auth DB", e);
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }
    console.error("[api/users/avatar POST] session", e);
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
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
    const absPath = getAvatarDiskPath(user.id);
    await writeFile(absPath, buffer);

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUpdatedAt: now }
    });

    revalidatePath("/me");
    revalidatePath("/schedule");
    revalidateTag(CACHE_TAGS.employees);

    return NextResponse.json({ path: getAvatarApiPath(user.id, now) });
  } catch (e) {
    console.error("[api/users/avatar POST]", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}

export async function DELETE() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof AuthDbError) {
      console.error("[api/users/avatar DELETE] auth DB", e);
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }
    console.error("[api/users/avatar DELETE] session", e);
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const diskPath = resolveAvatarDiskPath(user.id);
    if (diskPath) {
      await unlink(diskPath).catch(() => undefined);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUpdatedAt: null }
    });

    revalidatePath("/me");
    revalidatePath("/schedule");
    revalidateTag(CACHE_TAGS.employees);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/users/avatar DELETE]", e);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
