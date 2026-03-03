import { NextResponse } from "next/server";
import { runAttendanceHourlySync } from "@/lib/attendance-sync";

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAttendanceHourlySync();
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Cron attendance sync failed" },
      { status: 500 }
    );
  }
}
