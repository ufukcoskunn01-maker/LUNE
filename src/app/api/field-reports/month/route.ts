import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildMonthRange, listMonthFieldReports } from "@/lib/field-reports/service";
import { getCalendarMonth } from "@/lib/installations/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/),
});

function isMissingFieldReportsSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const lowered = message.toLowerCase();
  return (
    (lowered.includes("field_reports") || lowered.includes("field_report_items")) &&
    (lowered.includes("schema cache") ||
      lowered.includes("could not find the table") ||
      lowered.includes("relation") ||
      lowered.includes("does not exist"))
  );
}

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
    let reports = [] as Awaited<ReturnType<typeof listMonthFieldReports>>;

    try {
      reports = await listMonthFieldReports({
        supabase: admin,
        projectCode,
        monthToken: month,
      });
    } catch (error) {
      if (!isMissingFieldReportsSchemaError(error)) {
        throw error;
      }

      const fallbackDays = await getCalendarMonth({
        supabase: admin,
        projectCode,
        year: range.year,
        month: range.month,
      });

      const fallbackByDate = new Map(fallbackDays.map((row) => [row.work_date, row]));
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
        const row = fallbackByDate.get(date);
        const hasFile = Boolean(row?.has_report);
        const revision = row?.latest_rev === null || row?.latest_rev === undefined ? null : `rev${String(row.latest_rev).padStart(2, "0")}`;
        dates.push({
          date,
          hasFile,
          parseStatus: hasFile ? "OK" : "MISSING",
          fileName: row?.latest_filename || null,
          revision,
          summary: {
            rows_count: row?.rows_count || 0,
            total_manhours: row?.total_manhours || 0,
            total_qty: row?.total_qty || 0,
          },
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
    }

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
