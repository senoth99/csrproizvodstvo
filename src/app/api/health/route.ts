import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Без auth: проверка «поднялось ли приложение и отвечает ли SQLite/Postgres». */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/health] DB недоступна:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      {
        ok: false,
        error: "database_unavailable",
        hint: "SQLite: DATABASE_URL=file:./dev.db, папка prisma/ рядом с процессом; после standalone — база может быть на уровень выше. Выполните prisma db push / migrate deploy."
      },
      { status: 503 }
    );
  }
}
