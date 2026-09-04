import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await getDb().execute(sql`select 1 as healthy`);
    return NextResponse.json({
      status: "ok",
      service: "kc-account-360",
      database: "ready",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("health.database.failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ status: "degraded", service: "kc-account-360", database: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
