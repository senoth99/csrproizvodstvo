import { NextResponse } from "next/server";

/** Старые ссылки /api/brand-logo → статика из public (без fs и абсолютных путей Cursor). */
export function GET(req: Request) {
  try {
    const base = new URL(req.url);
    return NextResponse.redirect(new URL("/brand-logo.png", base.origin), 307);
  } catch (e) {
    console.error("[api/brand-logo]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
