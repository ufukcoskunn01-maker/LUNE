import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type FileRow = {
  id: string;
  project_code: string;
  work_date: string;
  bucket_id: string | null;
  storage_path: string;
  file_name: string;
  file_kind: string | null;
  revision: string | null;
  ingest_status: string | null;
  parse_error: string | null;
  last_error: string | null;
  uploaded_at: string | null;
  processing_started_at: string | null;
  processing_finished_at: string | null;
  processed_at: string | null;
  last_retry_at: string | null;
  parser_version: string | null;
  warning_count: number | null;
  rows_count: number | null;
  parsed_material_rows: number | null;
  parsed_labor_rows: number | null;
  inserted_material_rows: number | null;
  inserted_labor_rows: number | null;
  distinct_row_dates: unknown;
  updated_at: string | null;
};

type SummaryRow = {
  id: string;
  project_code: string;
  work_date: string;
  source_file_id: string;
  mh_material: number | null;
  mh_direct: number | null;
  mh_indirect: number | null;
  mh_total: number | null;
  efficiency_pct: number | null;
  mh_match_ok: boolean | null;
  attendance_match_ok: boolean | null;
  warnings: unknown;
  updated_at: string | null;
};

type WarningItem = {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
};

type MaterialRow = {
  id: string;
  project_code: string;
  work_date: string;
  source_file_id: string;
  zone: string | null;
  floor: string | null;
  budget_code: string | null;
  activity_code: string | null;
  description: string | null;
  unit: string | null;
  qty: number | null;
  report_date: string | null;
  crew: number | null;
  raw: Record<string, unknown> | null;
};

type LaborRow = {
  hours_indirect: number | null;
  hours_direct: number | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw.replace(/\u00A0/g, "").replace(/\s+/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/,/g, ".");
  }

  normalized = normalized.replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function revisionRank(value: string | null): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function pickLatestFile(files: FileRow[]): FileRow | null {
  if (!files.length) return null;
  return [...files].sort((a, b) => {
    const byRevision = revisionRank(b.revision) - revisionRank(a.revision);
    if (byRevision !== 0) return byRevision;
    return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
  })[0];
}

function isLegacyPeopleMismatchWarning(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized.startsWith("manhour mismatch:") && normalized.includes("people=");
}

function normalizeWarningItems(value: unknown): WarningItem[] {
  if (!Array.isArray(value)) return [];
  const normalized: WarningItem[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const message = item.trim();
      if (!message) continue;
      if (isLegacyPeopleMismatchWarning(message)) continue;
      normalized.push({ code: "warning", message, details: null });
      continue;
    }

    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const code = typeof record.code === "string" && record.code.trim() ? record.code.trim() : "warning";
    const message =
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : `Warning (${code}).`;
    if (isLegacyPeopleMismatchWarning(message)) continue;
    const details =
      record.details && typeof record.details === "object" && !Array.isArray(record.details)
        ? (record.details as Record<string, unknown>)
        : null;
    normalized.push({ code, message, details });
  }
  return normalized;
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
      date: url.searchParams.get("date") || "",
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { projectCode, date } = parsed.data;

    const filesRes = await admin
      .from("field_installation_files")
      .select("id,project_code,work_date,bucket_id,storage_path,file_name,file_kind,revision,ingest_status,parse_error,last_error,uploaded_at,processing_started_at,processing_finished_at,processed_at,last_retry_at,parser_version,warning_count,rows_count,parsed_material_rows,parsed_labor_rows,inserted_material_rows,inserted_labor_rows,distinct_row_dates,updated_at")
      .eq("project_code", projectCode)
      .eq("work_date", date)
      .returns<FileRow[]>();

    if (filesRes.error) {
      return NextResponse.json({ ok: false, error: filesRes.error.message }, { status: 500 });
    }

    const latestFile = pickLatestFile(filesRes.data || []);
    if (!latestFile) {
      return NextResponse.json({
        ok: true,
        data: {
          file: null,
          summary: null,
          rows: [],
        },
      });
    }

    const [summaryRes, rowsRes, laborRes] = await Promise.all([
      admin
        .from("field_installation_day_summary")
        .select(
          "id,project_code,work_date,source_file_id,mh_material,mh_direct,mh_indirect,mh_total,efficiency_pct,mh_match_ok,attendance_match_ok,warnings,updated_at"
        )
        .eq("project_code", projectCode)
        .eq("work_date", date)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<SummaryRow>(),
      admin
        .from("field_installation_rows")
        .select("id,project_code,work_date,source_file_id,zone,floor,budget_code,activity_code,description,unit,qty,report_date,crew,raw")
        .eq("source_file_id", latestFile.id)
        .order("zone", { ascending: true })
        .order("floor", { ascending: true })
        .order("budget_code", { ascending: true })
        .order("activity_code", { ascending: true })
        .order("description", { ascending: true })
        .returns<MaterialRow[]>(),
      admin
        .from("field_installation_labor_rows")
        .select("hours_indirect,hours_direct")
        .eq("project_code", projectCode)
        .eq("work_date", date)
        .returns<LaborRow[]>(),
    ]);

    if (summaryRes.error) {
      return NextResponse.json({ ok: false, error: summaryRes.error.message }, { status: 500 });
    }
    if (rowsRes.error) {
      return NextResponse.json({ ok: false, error: rowsRes.error.message }, { status: 500 });
    }
    if (laborRes.error) {
      return NextResponse.json({ ok: false, error: laborRes.error.message }, { status: 500 });
    }

    const laborRows = laborRes.data || [];
    const fallbackDirect = laborRows.reduce((sum, row) => sum + Number(row.hours_direct || 0), 0);
    const fallbackIndirect = laborRows.reduce((sum, row) => sum + Number(row.hours_indirect || 0), 0);
    const fallbackPeople = fallbackDirect;

    const summary = summaryRes.data
      ? (() => {
          const mhMatchOk = summaryRes.data.mh_match_ok ?? null;
          const attendanceMatchOk = summaryRes.data.attendance_match_ok ?? null;
          const mismatchReasons = buildMismatchReasons(mhMatchOk, attendanceMatchOk);
          return {
            ...summaryRes.data,
            material_total_mh: summaryRes.data.mh_material,
            people_total_mh: summaryRes.data.mh_direct ?? fallbackPeople,
            indirect_total_mh: summaryRes.data.mh_indirect ?? fallbackIndirect,
            direct_total_mh: summaryRes.data.mh_direct ?? fallbackDirect,
            delta_mh:
              summaryRes.data.mh_material === null || (summaryRes.data.mh_direct ?? fallbackPeople) === null
                ? null
                : Number(summaryRes.data.mh_material) - Number(summaryRes.data.mh_direct ?? fallbackPeople),
            efficiency_score: summaryRes.data.efficiency_pct,
            mh_match_ok: mhMatchOk,
            attendance_match_ok: attendanceMatchOk,
            mismatch_reasons: mismatchReasons,
            warnings: normalizeWarningItems(summaryRes.data.warnings),
            is_mismatch: mismatchReasons.length > 0,
          };
        })()
      : null;

    const rows = (rowsRes.data || []).map((row, idx) => {
      const raw = (row.raw || {}) as Record<string, unknown>;
      return {
        id: row.id,
        row_no: toNumber(raw.line_no) ?? idx + 1,
        project_code: row.project_code,
        work_date: row.work_date,
        source_file_id: row.source_file_id,
        zone: row.zone,
        floor: row.floor,
        budget_code: row.budget_code,
        activity_code: row.activity_code,
        description: row.description,
        unit: row.unit,
        qty: row.qty,
        report_date: row.report_date,
        manhours: toNumber(raw.manhours),
        team_no: row.crew,
        elevation: raw.elevation ? String(raw.elevation) : null,
        install_action: raw.install_or_remove ? String(raw.install_or_remove) : null,
        location: raw.location ? String(raw.location) : null,
        project_name: raw.project_name ? String(raw.project_name) : null,
        orientation: raw.orientation ? String(raw.orientation) : null,
        comment: raw.comment ? String(raw.comment) : null,
      };
    });

    const materialTotalFromRows = rows.reduce((sum, row) => sum + Number(row.manhours || 0), 0);
    const fallbackMhMatchOk = Math.abs(materialTotalFromRows - fallbackDirect) <= 0.5;
    const fallbackMismatchReasons = buildMismatchReasons(fallbackMhMatchOk, null);
    const normalizedSummary =
      summary ||
      ({
        id: `derived-${projectCode}-${date}`,
        project_code: projectCode,
        work_date: date,
        source_file_id: latestFile.id,
        material_total_mh: materialTotalFromRows,
        people_total_mh: fallbackPeople,
        indirect_total_mh: fallbackIndirect,
        direct_total_mh: fallbackDirect,
        delta_mh: materialTotalFromRows - fallbackPeople,
        efficiency_score: fallbackDirect > 0 ? (materialTotalFromRows / fallbackDirect) * 100 : null,
        is_mismatch: fallbackMismatchReasons.length > 0,
        mh_match_ok: fallbackMhMatchOk,
        attendance_match_ok: null,
        mismatch_reasons: fallbackMismatchReasons,
        warnings: [] as WarningItem[],
        updated_at: latestFile.updated_at,
      } as const);

    const distinctReportDates = Array.from(new Set(rows.map((row) => row.report_date).filter(Boolean))).sort();

    return NextResponse.json({
      ok: true,
      data: {
        file: latestFile,
        summary: normalizedSummary,
        rows,
        ingest: {
          status: latestFile.ingest_status || "uploaded",
          parse_error: latestFile.parse_error || latestFile.last_error || null,
          uploaded_at: latestFile.uploaded_at || null,
          processing_started_at: latestFile.processing_started_at || null,
          processing_finished_at: latestFile.processing_finished_at || null,
          processed_at: latestFile.processed_at || null,
          last_retry_at: latestFile.last_retry_at || null,
          parser_version: latestFile.parser_version || null,
          warning_count: latestFile.warning_count ?? 0,
          parsed_material_rows: latestFile.parsed_material_rows ?? 0,
          parsed_labor_rows: latestFile.parsed_labor_rows ?? 0,
          inserted_material_rows: latestFile.inserted_material_rows ?? rows.length,
          inserted_labor_rows: latestFile.inserted_labor_rows ?? 0,
          distinct_row_dates:
            Array.isArray(latestFile.distinct_row_dates) && latestFile.distinct_row_dates.length
              ? latestFile.distinct_row_dates
              : distinctReportDates,
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load day." }, { status: 500 });
  }
}
