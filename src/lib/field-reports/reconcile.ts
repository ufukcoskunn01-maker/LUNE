import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestFieldReportFromStorageRow, normalizeFieldReportError } from "@/lib/field-reports/ingest";
import { discoverInstallationFiles, resolveFieldReportsBucket, upsertFieldReportMetadata } from "@/lib/field-reports/storage-scan";
import type { FieldReportRow } from "@/lib/field-reports/service";

type ExistingRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  parse_status: "PENDING" | "OK" | "FAILED";
};

export type ReconcileDailyInstallationReportsOptions = {
  supabase: SupabaseClient;
  projectCode: string;
  bucket?: string;
  rootPrefix?: string;
  fromDate?: string | null;
  toDate?: string | null;
  missingOnly?: boolean;
  reprocessFailed?: boolean;
  reprocessAll?: boolean;
};

export type ReconcileDailyInstallationReportsResult = {
  projectCode: string;
  bucket: string;
  rootPrefix: string;
  scanned: number;
  considered: number;
  registered: number;
  processed: number;
  ready: number;
  failed: number;
  skippedExisting: number;
  skippedByDate: number;
  skippedAlreadyReady: number;
  errors: string[];
};

function inDateRange(workDate: string, fromDate: string | null | undefined, toDate: string | null | undefined): boolean {
  if (fromDate && workDate < fromDate) return false;
  if (toDate && workDate > toDate) return false;
  return true;
}

async function loadExistingRowsByPath(args: {
  supabase: SupabaseClient;
  bucket: string;
  storagePaths: string[];
}): Promise<Map<string, ExistingRow>> {
  const result = new Map<string, ExistingRow>();
  if (!args.storagePaths.length) return result;

  for (let offset = 0; offset < args.storagePaths.length; offset += 200) {
    const chunk = args.storagePaths.slice(offset, offset + 200);
    const query = await args.supabase
      .from("field_reports")
      .select("id,storage_bucket,storage_path,parse_status")
      .eq("storage_bucket", args.bucket)
      .in("storage_path", chunk);
    if (query.error) throw new Error(query.error.message);
    for (const row of query.data || []) {
      const typed = row as ExistingRow;
      result.set(typed.storage_path, typed);
    }
  }

  return result;
}

async function getFieldReportById(args: { supabase: SupabaseClient; reportId: string }): Promise<FieldReportRow | null> {
  const query = await args.supabase.from("field_reports").select("*").eq("id", args.reportId).maybeSingle();
  if (query.error) throw new Error(query.error.message);
  return (query.data || null) as FieldReportRow | null;
}

export async function reconcileDailyInstallationReportsFromStorage(
  args: ReconcileDailyInstallationReportsOptions
): Promise<ReconcileDailyInstallationReportsResult> {
  const bucket = (args.bucket || resolveFieldReportsBucket()).trim();
  const rootPrefix = (args.rootPrefix || `${args.projectCode}/2-Daily Field Reports`).trim();
  const missingOnly = args.missingOnly ?? true;
  const reprocessFailed = args.reprocessFailed ?? false;
  const reprocessAll = args.reprocessAll ?? false;

  const scan = await discoverInstallationFiles({
    supabase: args.supabase,
    projectCode: args.projectCode,
    bucket,
    rootPrefix,
  });

  const filtered = scan.files.filter((file) => inDateRange(file.workDate, args.fromDate, args.toDate));
  const existingByPath = await loadExistingRowsByPath({
    supabase: args.supabase,
    bucket,
    storagePaths: filtered.map((file) => file.storagePath),
  });

  let registered = 0;
  let processed = 0;
  let ready = 0;
  let failed = 0;
  let skippedExisting = 0;
  let skippedByDate = scan.files.length - filtered.length;
  let skippedAlreadyReady = 0;
  const errors: string[] = [];

  for (const file of filtered) {
    const existing = existingByPath.get(file.storagePath) || null;
    if (missingOnly && existing) {
      skippedExisting += 1;
      continue;
    }

    if (!reprocessAll && existing?.parse_status === "OK" && !missingOnly) {
      skippedAlreadyReady += 1;
      continue;
    }

    if (!reprocessAll && !reprocessFailed && existing?.parse_status === "FAILED" && !missingOnly) {
      skippedAlreadyReady += 1;
      continue;
    }

    try {
      const meta = await upsertFieldReportMetadata({
        supabase: args.supabase,
        file,
      });
      if (meta.created || meta.changed) {
        registered += 1;
      }

      const shouldProcess =
        meta.created ||
        meta.changed ||
        meta.needsParse ||
        reprocessAll ||
        (reprocessFailed && existing?.parse_status === "FAILED");

      if (!shouldProcess) {
        skippedAlreadyReady += 1;
        continue;
      }

      const report = await getFieldReportById({
        supabase: args.supabase,
        reportId: meta.rowId,
      });
      if (!report) {
        errors.push(`${file.storagePath}: field report row not found after metadata upsert.`);
        continue;
      }

      await ingestFieldReportFromStorageRow({
        supabase: args.supabase,
        report,
      });
      processed += 1;
      ready += 1;
    } catch (error) {
      failed += 1;
      errors.push(`${file.storagePath}: ${normalizeFieldReportError(error)}`);
    }
  }

  return {
    projectCode: args.projectCode,
    bucket,
    rootPrefix: scan.rootPrefix,
    scanned: scan.files.length,
    considered: filtered.length,
    registered,
    processed,
    ready,
    failed,
    skippedExisting,
    skippedByDate,
    skippedAlreadyReady,
    errors,
  };
}
