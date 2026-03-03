import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated endpoint. Use /api/daily-installation-reports and /api/daily-installation-reports/:fileId.",
    },
    { status: 410 }
  );
}
