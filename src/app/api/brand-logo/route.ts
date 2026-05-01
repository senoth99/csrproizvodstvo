import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

const logoPath =
  "/Users/senoth/.cursor/projects/Users-senoth-Desktop-production-scheduler/assets/optimize-2d9b4a63-7441-4c15-aace-e2f05059ae5b.png";

export async function GET() {
  try {
    const buf = await readFile(logoPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return new NextResponse("Logo not found", { status: 404 });
  }
}
