import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated endpoint. Storage scanning sync was removed in favor of DB-first upload pipeline.",
    },
    { status: 410 }
  );
}
