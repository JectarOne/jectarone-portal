import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storageConfigured } from "@/lib/storage";

// Ops health check for uptime monitors + deployment gates. No auth (returns no
// sensitive data). 200 when the DB is reachable, 503 otherwise.
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  let db: "ok" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    db = "down";
  }

  const body = {
    status: db === "ok" ? "ok" : "degraded",
    time: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.APP_VERSION ?? "dev",
    checks: {
      database: db,
      storage: storageConfigured() ? "configured" : "unconfigured",
    },
  };
  return NextResponse.json(body, {
    status: db === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
