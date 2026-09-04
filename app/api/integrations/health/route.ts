import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ service: "KC Account Integration API", status: "ok", version: "1.0.0", time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}

