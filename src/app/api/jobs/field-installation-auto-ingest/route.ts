import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importFieldInstallationDay } from "@/lib/field-installation/import-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

type FileRow = {
  id: string;
  project_code: string;
  work_date: string;
  revision: string | null;
  updated_at: string | null;
};

function monthRange(token: string): { start: string; end: string } {
  const [year, month] = token.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`,
  };
}

function revisionRank(value: string | null): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function keepLatestPerDate(files: FileRow[]): FileRow[] {
  const map = new Map<string, FileRow>();
  for (const file of files) {
    const prev = map.get(file.work_date);
    if (!prev) {
      map.set(file.work_date, file);
      continue;
    }

    const revDiff = revisionRank(file.revision) - revisionRank(prev.revision);
    if (revDiff > 0) {
      map.set(file.work_date, file);
      continue;
    }

    if (revDiff === 0 && String(file.updated_at || "") > String(prev.updated_at || "")) {
      map.set(file.work_date, file);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.work_date.localeCompare(b.work_date));
}

export async function POST(req: Request) {
  try {
    const sb = await createServerSupabaseClient();
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    const {
      data: { user },
    } = await sb.auth.getUser();

    const hasCronAuth = Boolean(secret && authHeader === `Bearer ${secret}`);
    if (!user && !hasCronAuth) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const bodyRaw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(bodyRaw || {});
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid payload." }, { status: 400 });
    }

    const { projectCode, month, limit } = parsed.data;
    const admin = createAdminClient();

    const allFiles: FileRow[] = [];
    const pageSize = 1000;
    let from = 0;

    for (;;) {
      let pageQuery = admin
        .from("field_installation_files")
        .select("id,project_code,work_date,revision,updated_at")
        .eq("project_code", projectCode);

      if (month) {
        const range = monthRange(month);
        pageQuery = pageQuery.gte("work_date", range.start).lte("work_date", range.end);
      }

      const pageRes = await pageQuery.order("work_date", { ascending: true }).range(from, from + pageSize - 1);
      if (pageRes.error) {
        return NextResponse.json({ ok: false, error: pageRes.error.message }, { status: 500 });
      }

      const batch = (pageRes.data || []) as FileRow[];
      if (!batch.length) break;
      allFiles.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    const latestFiles = keepLatestPerDate(allFiles);
    const fileIds = latestFiles.map((row) => row.id);

    if (!fileIds.length) {
      return NextResponse.json({ ok: true, data: { scanned: 0, skipped: 0, ingested: 0, failed: 0, details: [] } });
    }

    const [summaryRes, rowsRes] = await Promise.all([
      admin
        .from("field_installation_day_summary")
        .select("source_file_id,work_date")
        .in("source_file_id", fileIds),
      admin
        .from("field_installation_rows")
        .select("source_file_id,work_date")
        .in("source_file_id", fileIds),
    ]);

    if (summaryRes.error) {
      return NextResponse.json({ ok: false, error: summaryRes.error.message }, { status: 500 });
    }
    if (rowsRes.error) {
      return NextResponse.json({ ok: false, error: rowsRes.error.message }, { status: 500 });
    }

    const summaryBySource = new Map<string, string>();
    for (const row of summaryRes.data || []) {
      const sourceFileId = String((row as { source_file_id?: string }).source_file_id || "");
      const workDate = String((row as { work_date?: string }).work_date || "");
      if (sourceFileId && workDate) summaryBySource.set(sourceFileId, workDate);
    }
    const rowBySource = new Map<string, string>();
    for (const row of rowsRes.data || []) {
      const sourceFileId = String((row as { source_file_id?: string }).source_file_id || "");
      const workDate = String((row as { work_date?: string }).work_date || "");
      if (sourceFileId && workDate) rowBySource.set(sourceFileId, workDate);
    }
    const summaryDateSet = new Set((summaryRes.data || []).map((row) => String((row as { work_date?: string }).work_date || "")));
    const rowsDateSet = new Set((rowsRes.data || []).map((row) => String((row as { work_date?: string }).work_date || "")));

    let skipped = 0;
    let ingested = 0;
    const details: Array<{ fileId: string; workDate: string; status: "skipped" | "ingested" | "failed"; message?: string }> = [];

    const missingFiles = latestFiles.filter((file) => {
      const sourceSummaryDate = summaryBySource.get(file.id);
      const sourceRowsDate = rowBySource.get(file.id);
      const hasSourceData = sourceSummaryDate === file.work_date && sourceRowsDate === file.work_date;
      const hasDateData = summaryDateSet.has(file.work_date) && rowsDateSet.has(file.work_date);
      return !(hasSourceData || hasDateData);
    });
    const ingestQueue = typeof limit === "number" ? missingFiles.slice(0, limit) : missingFiles;

    for (const file of latestFiles) {
      const alreadyIngested =
        summaryBySource.get(file.id) === file.work_date &&
        rowBySource.get(file.id) === file.work_date;
      if (alreadyIngested) {
        skipped += 1;
        details.push({ fileId: file.id, workDate: file.work_date, status: "skipped" });
      }
    }

    for (const file of ingestQueue) {
      try {
        await importFieldInstallationDay({
          admin,
          projectCode,
          workDate: file.work_date,
        });
        ingested += 1;
        details.push({ fileId: file.id, workDate: file.work_date, status: "ingested" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ingestion failed.";
        details.push({ fileId: file.id, workDate: file.work_date, status: "failed", message });
      }
    }

    const failed = details.filter((row) => row.status === "failed").length;

    return NextResponse.json({
      ok: true,
      data: {
        scanned: latestFiles.length,
        skipped,
        ingested,
        failed,
        details,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Auto-ingest failed." }, { status: 500 });
  }
}
