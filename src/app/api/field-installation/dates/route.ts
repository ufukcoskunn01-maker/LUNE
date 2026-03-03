import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
});

type FileDateRow = {
  work_date?: string | null;
  file_name?: string | null;
};

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseInsYymmddFileDate(fileName: string): string | null {
  const match = fileName.match(/^[A-Z0-9]+-E-INS-(\d{6})_rev\d{1,3}\.xls[xm]?$/i);
  if (!match?.[1]) return null;

  const token = match[1];
  const year = 2000 + Number(token.slice(0, 2));
  const month = Number(token.slice(2, 4));
  const day = Number(token.slice(4, 6));
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

function buildDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return out;

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function dayDiffIso(left: string, right: string): number {
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(rightTime - leftTime) / 86_400_000);
}

function tailDateCluster(sortedAscDates: string[], gapDays: number): string[] {
  if (!sortedAscDates.length) return [];
  let startIdx = 0;
  for (let i = 1; i < sortedAscDates.length; i += 1) {
    if (dayDiffIso(sortedAscDates[i - 1], sortedAscDates[i]) > gapDays) {
      startIdx = i;
    }
  }
  return sortedAscDates.slice(startIdx);
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
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const admin = createAdminClient();
    const currentYear = new Date().getUTCFullYear();
    // Keep current + next year visible (handles clock drift), while excluding far-future bad dates.
    const maxReasonableDate = `${currentYear + 1}-12-31`;
    const [projectsRes, filesRes] = await Promise.all([
      admin.from("projects").select("code").order("code", { ascending: true }),
      admin
        .from("field_installation_files")
        .select("work_date,file_name")
        .eq("project_code", parsed.data.projectCode)
        .lte("work_date", maxReasonableDate)
        .order("work_date", { ascending: false })
        .returns<FileDateRow[]>(),
    ]);

    if (filesRes.error) {
      return NextResponse.json({ ok: false, error: filesRes.error.message }, { status: 500 });
    }

    const projectCodes = (projectsRes.data || [])
      .map((row) => String((row as { code?: string }).code || "").trim())
      .filter(Boolean);

    const rows = filesRes.data || [];

    const canonicalDatesDesc = Array.from(
      new Set(
        rows
          .map((row) => {
            const workDate = String(row.work_date || "").trim();
            const fileName = String(row.file_name || "").trim();
            const parsedFromName = parseInsYymmddFileDate(fileName);
            if (!workDate || !parsedFromName || parsedFromName !== workDate) return "";
            return workDate;
          })
          .filter(Boolean)
      )
    )
      .filter((date) => date <= maxReasonableDate)
      .sort((a, b) => b.localeCompare(a));

    const effectiveUpperDate = canonicalDatesDesc[0] || maxReasonableDate;
    const allValidDatesDesc = Array.from(
      new Set(rows.map((row) => String(row.work_date || "").trim()).filter((date) => isValidIsoDate(date)))
    )
      .filter((date) => date <= effectiveUpperDate)
      .sort((a, b) => b.localeCompare(a));

    const clusteredAsc = tailDateCluster([...allValidDatesDesc].sort((a, b) => a.localeCompare(b)), 120);
    const importedDates = clusteredAsc.sort((a, b) => b.localeCompare(a));
    const latestDate = importedDates[0] || null;
    const firstDate = importedDates[importedDates.length - 1] || null;
    const dates =
      firstDate && latestDate
        ? buildDateRange(firstDate, latestDate).sort((a, b) => b.localeCompare(a))
        : importedDates;

    return NextResponse.json({
      ok: true,
      data: {
        projectCode: parsed.data.projectCode,
        projectCodes,
        dates,
        latestImportedDate: latestDate,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load dates." }, { status: 500 });
  }
}
