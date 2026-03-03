import { parseInstallationXlsx } from "@/lib/field-reports/parse-installation-xlsx";
import type { FieldReportRow } from "@/lib/field-reports/service";
import {
  setFieldReportParseFailed,
  setFieldReportParseOk,
  setFieldReportParsePending,
  replaceFieldReportItems,
} from "@/lib/field-reports/service";
import type { SupabaseClient } from "@supabase/supabase-js";

export class FieldReportImportError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function normalizeFieldReportError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Field report import failed.";
}

export function detectRevisionFromFileName(fileName: string): string {
  const match = fileName.match(/_rev(\d{2})/i);
  if (!match) return "rev00";
  return `rev${match[1]}`;
}

export async function parseAndPersistFieldReport(args: {
  supabase: SupabaseClient;
  reportId: string;
  buffer: Buffer;
}) {
  let parsed;
  try {
    parsed = parseInstallationXlsx(args.buffer);
  } catch (error) {
    const message = normalizeFieldReportError(error);
    await setFieldReportParseFailed({
      supabase: args.supabase,
      reportId: args.reportId,
      message,
    });
    throw new FieldReportImportError(message, 422);
  }

  try {
    const inserted = await replaceFieldReportItems({
      supabase: args.supabase,
      reportId: args.reportId,
      items: parsed.items,
    });

    await setFieldReportParseOk({
      supabase: args.supabase,
      reportId: args.reportId,
      summary: {
        ...parsed.summary,
        worksheet: parsed.worksheet,
        headerRow: parsed.headerRow,
        parsedItems: inserted,
      },
    });

    return {
      worksheet: parsed.worksheet,
      headerRow: parsed.headerRow,
      parsedItems: parsed.items.length,
      upsertedItems: inserted,
    };
  } catch (error) {
    const message = normalizeFieldReportError(error);
    await setFieldReportParseFailed({
      supabase: args.supabase,
      reportId: args.reportId,
      message,
    });
    throw new FieldReportImportError(message, 500);
  }
}

export async function ingestFieldReportFromStorageRow(args: {
  supabase: SupabaseClient;
  report: FieldReportRow;
}) {
  await setFieldReportParsePending({
    supabase: args.supabase,
    reportId: args.report.id,
  });

  const download = await args.supabase.storage.from(args.report.storage_bucket).download(args.report.storage_path);
  if (download.error || !download.data) {
    const message = `Storage download failed: ${download.error?.message || "unknown error"}`;
    await setFieldReportParseFailed({
      supabase: args.supabase,
      reportId: args.report.id,
      message,
    });
    throw new FieldReportImportError(message, 500);
  }

  const buffer = Buffer.from(await download.data.arrayBuffer());
  const parse = await parseAndPersistFieldReport({
    supabase: args.supabase,
    reportId: args.report.id,
    buffer,
  });

  return {
    reportId: args.report.id,
    workDate: args.report.work_date,
    fileName: args.report.file_name,
    storagePath: args.report.storage_path,
    ...parse,
  };
}
