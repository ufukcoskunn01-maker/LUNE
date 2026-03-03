import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

type FileRow = {
  id: string;
  work_date: string;
  revision: string | null;
  updated_at: string | null;
};

type SummaryRow = {
  source_file_id: string;
  work_date: string;
  efficiency_pct: number | null;
  mh_match_ok: boolean | null;
  attendance_match_ok: boolean | null;
};

function monthRange(token: string): { year: number; month: number; start: string; end: string; days: number } {
  const [year, month] = token.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`,
    days,
  };
}

function revisionRank(value: string | null): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function pickLatestFileByDate(rows: FileRow[]): Map<string, FileRow> {
  const map = new Map<string, FileRow>();
  for (const row of rows) {
    const prev = map.get(row.work_date);
    if (!prev) {
      map.set(row.work_date, row);
      continue;
    }

    const revDiff = revisionRank(row.revision) - revisionRank(prev.revision);
    if (revDiff > 0) {
      map.set(row.work_date, row);
      continue;
    }

    if (revDiff === 0 && String(row.updated_at || "") > String(prev.updated_at || "")) {
      map.set(row.work_date, row);
    }
  }
  return map;
}

function buildMismatchReasons(mhMatchOk: boolean | null, attendanceMatchOk: boolean | null): string[] {
  const reasons: string[] = [];
  if (mhMatchOk === false) {
    reasons.push("MH material/direct mismatch (>0.5h).");
  }
  if (attendanceMatchOk === false) {
    reasons.push("Direct personnel mismatch vs Daily Personal Reports.");
  }
  return reasons;
}

export async function GET(req: Request) {
  try {
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

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

    const admin = createAdminClient();
    const { projectCode, month } = parsed.data;
    const range = monthRange(month);

    const [filesRes, summariesRes] = await Promise.all([
      admin
        .from("field_installation_files")
        .select("id,work_date,revision,updated_at")
        .eq("project_code", projectCode)
        .gte("work_date", range.start)
        .lte("work_date", range.end)
        .returns<FileRow[]>(),
      admin
        .from("field_installation_day_summary")
        .select("source_file_id,work_date,efficiency_pct,mh_match_ok,attendance_match_ok")
        .eq("project_code", projectCode)
        .gte("work_date", range.start)
        .lte("work_date", range.end)
        .returns<SummaryRow[]>(),
    ]);

    if (filesRes.error) {
      return NextResponse.json({ ok: false, error: filesRes.error.message }, { status: 500 });
    }
    if (summariesRes.error) {
      return NextResponse.json({ ok: false, error: summariesRes.error.message }, { status: 500 });
    }

    const latestByDate = pickLatestFileByDate(filesRes.data || []);
    const summaryByFileId = new Map((summariesRes.data || []).map((row) => [row.source_file_id, row]));

    const days = Array.from({ length: range.days }, (_, idx) => {
      const date = `${range.year}-${String(range.month).padStart(2, "0")}-${String(idx + 1).padStart(2, "0")}`;
      const latest = latestByDate.get(date);
      const summary = latest ? summaryByFileId.get(latest.id) : undefined;
      const mhMatchOk = summary?.mh_match_ok ?? null;
      const attendanceMatchOk = summary?.attendance_match_ok ?? null;
      const mismatchReasons = buildMismatchReasons(mhMatchOk, attendanceMatchOk);
      return {
        date,
        hasFile: Boolean(latest),
        efficiency_score: summary?.efficiency_pct ?? null,
        is_mismatch: mismatchReasons.length > 0,
        mh_match_ok: mhMatchOk,
        attendance_match_ok: attendanceMatchOk,
        mismatch_reasons: mismatchReasons,
        revision: latest?.revision ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        month,
        days,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load month." }, { status: 500 });
  }
}
