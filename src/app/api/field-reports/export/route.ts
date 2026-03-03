import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated endpoint. Export is not part of the new daily installation pipeline.",
    },
    { status: 410 }
  );
}
