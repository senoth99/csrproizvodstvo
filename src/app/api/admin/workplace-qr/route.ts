import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { UserRole } from "@/lib/enums";
import { getOrCreateWorkplaceQrToken, getWorkplaceCheckInUrl } from "@/lib/workplaceQr";

export async function GET() {
  const auth = await requireRoleApi([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  if (!auth.ok) return auth.response;

  try {
    const token = await getOrCreateWorkplaceQrToken();
    const url = getWorkplaceCheckInUrl(token);
    const png = await QRCode.toBuffer(url, { type: "png", margin: 2, width: 512 });

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="workplace-qr.png"',
        "Cache-Control": "private, no-store"
      }
    });
  } catch (e) {
    console.error("[api/admin/workplace-qr GET]", e);
    return NextResponse.json({ error: "qr_unavailable" }, { status: 503 });
  }
}
