import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDailyInstallationWorkbook } from "@/lib/daily-installation-reports/parser";
import { DAILY_INSTALLATION_STATUS, type DailyInstallationFileRow } from "@/lib/daily-installation-reports/types";

const PARSER_VERSION = "daily-installation-parser@1";

function safeFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "report.xlsx";
  return trimmed
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferMimeType(fileName: string): string {
  if (/\.xlsm$/i.test(fileName)) return "application/vnd.ms-excel.sheet.macroEnabled.12";
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function nowPathToken(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${hh}${mm}${ss}`;
}

export function buildStoragePath(projectId: string, originalFileName: string): string {
  const date = new Date();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const safe = safeFileName(originalFileName);
  return `daily-installation-reports/${projectId}/${year}/${month}/${nowPathToken()}_${safe}`;
}

export async function createFileRow(args: {
  admin: SupabaseClient;
  projectId: string;
  storageBucket: string;
  storagePath: string;
  originalFileName: string;
  fileSize: number;
  fileHash: string;
  mimeType: string;
  uploadedBy: string | null;
}): Promise<DailyInstallationFileRow> {
  const ins = await args.admin
    .from("daily_installation_report_files")
    .insert({
      project_id: args.projectId,
      storage_bucket: args.storageBucket,
      storage_path: args.storagePath,
      original_filename: args.originalFileName,
      mime_type: args.mimeType,
      file_size: args.fileSize,
      file_hash: args.fileHash,
      uploaded_by: args.uploadedBy,
      status: DAILY_INSTALLATION_STATUS.UPLOADED,
      parser_version: PARSER_VERSION,
    })
    .select("*")
    .single();

  if (ins.error || !ins.data) {
    throw new Error(ins.error?.message || "Failed to create uploaded file record.");
  }
  return ins.data as DailyInstallationFileRow;
}

export async function setFileStatus(args: {
  admin: SupabaseClient;
  fileId: string;
  status: DailyInstallationFileRow["status"];
  parseError?: string | null;
  reportDate?: string | null;
}) {
  const update = await args.admin
    .from("daily_installation_report_files")
    .update({
      status: args.status,
      parse_error: args.parseError ?? null,
      report_date: args.reportDate ?? null,
      parser_version: PARSER_VERSION,
    })
    .eq("id", args.fileId);
  if (update.error) throw new Error(update.error.message);
}

export async function processUploadedFile(args: {
  admin: SupabaseClient;
  fileRow: DailyInstallationFileRow;
  binary: Buffer;
}) {
  await setFileStatus({
    admin: args.admin,
    fileId: args.fileRow.id,
    status: DAILY_INSTALLATION_STATUS.PROCESSING,
  });

  try {
    const parsed = parseDailyInstallationWorkbook(args.binary);
    const reportDate = parsed.report_date || args.fileRow.report_date || null;

    const reportUpsert = await args.admin
      .from("daily_installation_reports")
      .upsert(
        {
          file_id: args.fileRow.id,
          project_id: args.fileRow.project_id,
          report_date: reportDate,
          report_title: parsed.report_title,
          contractor_name: parsed.contractor_name,
          zone: parsed.zone,
          floor: parsed.floor,
          summary_json: parsed.summary_json,
        },
        { onConflict: "file_id" }
      )
      .select("*")
      .single();

    if (reportUpsert.error || !reportUpsert.data) {
      throw new Error(reportUpsert.error?.message || "Failed to upsert parsed report summary.");
    }

    const reportId = String((reportUpsert.data as { id?: string }).id || "");
    if (!reportId) {
      throw new Error("Parsed report summary did not return report id.");
    }

    const delItems = await args.admin.from("daily_installation_report_items").delete().eq("report_id", reportId);
    if (delItems.error) throw new Error(delItems.error.message);

    if (parsed.items.length) {
      for (let i = 0; i < parsed.items.length; i += 500) {
        const chunk = parsed.items.slice(i, i + 500).map((item) => ({
          report_id: reportId,
          sort_order: item.sort_order,
          category: item.category,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          planned_qty: item.planned_qty,
          actual_qty: item.actual_qty,
          cumulative_qty: item.cumulative_qty,
          remarks: item.remarks,
          raw_json: item.raw_json,
        }));
        const insItems = await args.admin.from("daily_installation_report_items").insert(chunk);
        if (insItems.error) throw new Error(insItems.error.message);
      }
    }

    await setFileStatus({
      admin: args.admin,
      fileId: args.fileRow.id,
      status: DAILY_INSTALLATION_STATUS.READY,
      reportDate,
      parseError: null,
    });

    return {
      fileId: args.fileRow.id,
      reportId,
      status: DAILY_INSTALLATION_STATUS.READY,
      reportDate,
      itemCount: parsed.items.length,
      summary: parsed.summary_json,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parsing failed.";
    await setFileStatus({
      admin: args.admin,
      fileId: args.fileRow.id,
      status: DAILY_INSTALLATION_STATUS.FAILED,
      parseError: message,
      reportDate: args.fileRow.report_date || null,
    });
    throw new Error(message);
  }
}

export function validateUploadFile(file: File) {
  const extOk = /\.(xlsx|xlsm)$/i.test(file.name);
  if (!extOk) throw new Error("Only .xlsx or .xlsm files are supported.");
  if (file.size <= 0) throw new Error("Uploaded file is empty.");
  const maxBytes = 20 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("File size exceeds 20MB.");
}

export async function uploadToStorage(args: {
  admin: SupabaseClient;
  bucket: string;
  path: string;
  fileName: string;
  binary: Buffer;
}) {
  const contentType = inferMimeType(args.fileName);
  const up = await args.admin.storage.from(args.bucket).upload(args.path, args.binary, {
    contentType,
    upsert: false,
  });
  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);
  return { contentType };
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
