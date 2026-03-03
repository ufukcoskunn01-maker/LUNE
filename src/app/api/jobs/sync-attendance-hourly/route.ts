import { NextResponse } from "next/server";
import { runAttendanceHourlySync } from "@/lib/attendance-sync";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectCode?: string;
    lookbackDays?: number;
  };

  try {
    const result = await runAttendanceHourlySync({
      projectCode: body?.projectCode,
      lookbackDays: body?.lookbackDays,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Hourly attendance sync failed" },
      { status: 500 }
    );
  }
}
