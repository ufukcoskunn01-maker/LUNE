import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type FileRow = {
  id: string;
  work_date: string;
  revision: string | null;
  updated_at: string | null;
};

type RangeRow = {
  id: string;
  row_no: number | null;
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
  manhours: number | null;
  team_no: number | null;
  elevation: string | null;
  install_action: string | null;
  location: string | null;
  project_name: string | null;
  orientation: string | null;
  comment: string | null;
  raw: Record<string, unknown> | null;
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

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
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
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    if (parsed.data.from > parsed.data.to) {
      return NextResponse.json({ ok: false, error: "from must be <= to." }, { status: 400 });
    }

    const admin = createAdminClient();

    const filesRes = await admin
      .from("field_installation_files")
      .select("id,work_date,revision,updated_at")
      .eq("project_code", parsed.data.projectCode)
      .gte("work_date", parsed.data.from)
      .lte("work_date", parsed.data.to)
      .returns<FileRow[]>();

    if (filesRes.error) {
      return NextResponse.json({ ok: false, error: filesRes.error.message }, { status: 500 });
    }

    const latestByDate = pickLatestFileByDate(filesRes.data || []);
    const fileIds = Array.from(latestByDate.values()).map((row) => row.id);

    if (!fileIds.length) {
      return NextResponse.json({ ok: true, data: { rows: [] } });
    }

    const rowsRes = await admin
      .from("field_installation_rows")
      .select(
        "id,row_no,project_code,work_date,source_file_id,zone,floor,budget_code,activity_code,description,unit,qty,manhours,team_no,elevation,install_action,location,project_name,orientation,comment,raw"
      )
      .in("source_file_id", fileIds)
      .order("work_date", { ascending: false })
      .order("row_no", { ascending: true })
      .returns<RangeRow[]>();

    if (rowsRes.error) {
      return NextResponse.json({ ok: false, error: rowsRes.error.message }, { status: 500 });
    }

    const normalizedRows = (rowsRes.data || []).map((row) => {
      const raw = (row.raw || {}) as Record<string, unknown>;
      return {
        ...row,
        row_no: row.row_no ?? toNumber(raw.line_no),
        zone: row.zone ?? toText(raw.zone),
        floor: row.floor ?? toText(raw.floor),
        budget_code: row.budget_code ?? toText(raw.budget_code),
        activity_code: row.activity_code ?? toText(raw.activity_code),
        description: row.description ?? toText(raw.description),
        unit: row.unit ?? toText(raw.unit),
        qty: row.qty ?? toNumber(raw.qty),
        manhours: row.manhours ?? toNumber(raw.manhours),
        team_no: row.team_no ?? toNumber(raw.team_no),
        install_action: row.install_action ?? toText(raw.install_or_remove),
        location: row.location ?? toText(raw.location),
        project_name: row.project_name ?? toText(raw.project_name),
        orientation: row.orientation ?? toText(raw.orientation),
        comment: row.comment ?? toText(raw.comment),
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        rows: normalizedRows,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load range." }, { status: 500 });
  }
}
