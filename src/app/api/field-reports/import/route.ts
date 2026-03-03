import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated endpoint. Use POST /api/daily-installation-reports for upload + parse.",
    },
    { status: 410 }
  );
}
