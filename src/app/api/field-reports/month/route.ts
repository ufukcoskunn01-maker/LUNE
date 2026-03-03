import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildMonthRange, listMonthFieldReports } from "@/lib/field-reports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/),
});

export async function GET(req: Request) {
  try {
    const userClient = await supabaseServer();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      projectCode: url.searchParams.get("projectCode") || "A27",
      month: url.searchParams.get("month") || "",
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const { projectCode, month } = parsed.data;
    const admin = supabaseAdmin();
    const range = buildMonthRange(month);
    const reports = await listMonthFieldReports({
      supabase: admin,
      projectCode,
      monthToken: month,
    });

    const byDate = new Map(reports.map((row) => [row.work_date, row]));
    const dates: Array<{
      date: string;
      hasFile: boolean;
      parseStatus: "MISSING" | "PENDING" | "OK" | "FAILED";
      fileName: string | null;
      revision: string | null;
      summary: Record<string, unknown>;
    }> = [];

    for (let day = 1; day <= range.days; day += 1) {
      const date = `${range.year}-${String(range.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const report = byDate.get(date);
      dates.push({
        date,
        hasFile: Boolean(report),
        parseStatus: report?.parse_status || "MISSING",
        fileName: report?.file_name || null,
        revision: report?.revision || null,
        summary: (report?.summary || {}) as Record<string, unknown>,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        month,
        dates,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load month status.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
