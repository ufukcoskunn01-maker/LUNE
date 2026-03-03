import type { SupabaseClient } from "@supabase/supabase-js";
import type { FieldReportItemInput } from "@/lib/field-reports/parse-installation-xlsx";

export type FieldReportRow = {
  id: string;
  project_code: string;
  report_type: string;
  work_date: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  revision: string | null;
  file_hash: string | null;
  file_size: number | null;
  last_modified: string | null;
  imported_at: string;
  parse_status: "PENDING" | "OK" | "FAILED";
  parse_error: string | null;
  summary: Record<string, unknown>;
};

export type FieldReportItemRow = {
  id: string;
  report_id: string;
  row_no: number;
  zone: string | null;
  floor: string | null;
  system: string | null;
  activity_code: string | null;
  material_code: string | null;
  item_name: string | null;
  unit: string | null;
  qty: number | null;
  notes: string | null;
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function buildMonthRange(monthToken: string): { start: string; end: string; year: number; month: number; days: number } {
  const [yearStr, monthStr] = monthToken.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Invalid month token. Expected YYYY-MM.");
  }
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`,
    year,
    month,
    days,
  };
}

export function monthFolderName(workDate: string): string {
  if (!isIsoDate(workDate)) throw new Error("Invalid workDate. Expected YYYY-MM-DD.");
  const [year, month] = workDate.split("-");
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthNumber = Number(month);
  return `${year}/${month}-${names[monthNumber - 1] || "Unknown"}`;
}

export function toYYMMDD(workDate: string): string {
  if (!isIsoDate(workDate)) throw new Error("Invalid workDate. Expected YYYY-MM-DD.");
  const [y, m, d] = workDate.split("-");
  return `${y.slice(2)}${m}${d}`;
}

export async function getFieldReportByDate(args: {
  supabase: SupabaseClient;
  projectCode: string;
  workDate: string;
  reportType?: string;
}): Promise<FieldReportRow | null> {
  const reportType = args.reportType || "INSTALLATION";
  const result = await args.supabase
    .from("field_reports")
    .select("*")
    .eq("project_code", args.projectCode)
    .eq("report_type", reportType)
    .eq("work_date", args.workDate)
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data || null) as FieldReportRow | null;
}

export async function getFieldReportByStoragePath(args: {
  supabase: SupabaseClient;
  storageBucket: string;
  storagePath: string;
}): Promise<FieldReportRow | null> {
  const result = await args.supabase
    .from("field_reports")
    .select("*")
    .eq("storage_bucket", args.storageBucket)
    .eq("storage_path", args.storagePath)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data || null) as FieldReportRow | null;
}

export async function upsertFieldReportRow(args: {
  supabase: SupabaseClient;
  projectCode: string;
  workDate: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  revision: string | null;
  fileHash: string | null;
  fileSize: number | null;
  lastModified: string | null;
}): Promise<FieldReportRow> {
  const payload = {
    project_code: args.projectCode,
    report_type: "INSTALLATION",
    work_date: args.workDate,
    storage_bucket: args.bucket,
    storage_path: args.storagePath,
    file_name: args.fileName,
    revision: args.revision,
    file_hash: args.fileHash,
    file_size: args.fileSize,
    last_modified: args.lastModified,
    parse_status: "PENDING",
    parse_error: null,
  };

  const result = await args.supabase
    .from("field_reports")
    .upsert(payload, { onConflict: "storage_bucket,storage_path" })
    .select("*")
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message || "Failed to upsert field report.");
  }
  return result.data as FieldReportRow;
}

export async function setFieldReportParsePending(args: {
  supabase: SupabaseClient;
  reportId: string;
}): Promise<void> {
  const result = await args.supabase
    .from("field_reports")
    .update({
      parse_status: "PENDING",
      parse_error: null,
    })
    .eq("id", args.reportId);
  if (result.error) throw new Error(result.error.message);
}

export async function setFieldReportParseFailed(args: {
  supabase: SupabaseClient;
  reportId: string;
  message: string;
}): Promise<void> {
  const result = await args.supabase
    .from("field_reports")
    .update({
      parse_status: "FAILED",
      parse_error: args.message,
      imported_at: new Date().toISOString(),
    })
    .eq("id", args.reportId);
  if (result.error) throw new Error(result.error.message);
}

export async function setFieldReportParseOk(args: {
  supabase: SupabaseClient;
  reportId: string;
  summary: Record<string, unknown>;
}): Promise<void> {
  const result = await args.supabase
    .from("field_reports")
    .update({
      parse_status: "OK",
      parse_error: null,
      imported_at: new Date().toISOString(),
      summary: args.summary,
    })
    .eq("id", args.reportId);
  if (result.error) throw new Error(result.error.message);
}

export async function replaceFieldReportItems(args: {
  supabase: SupabaseClient;
  reportId: string;
  items: FieldReportItemInput[];
}): Promise<number> {
  const rpc = await args.supabase.rpc("replace_field_report_items", {
    p_report_id: args.reportId,
    p_items: args.items as unknown as Record<string, unknown>[],
  });
  if (rpc.error) throw new Error(rpc.error.message);
  const count = Number(rpc.data ?? 0);
  return Number.isFinite(count) ? count : 0;
}

export async function listMonthFieldReports(args: {
  supabase: SupabaseClient;
  projectCode: string;
  monthToken: string;
}): Promise<FieldReportRow[]> {
  const range = buildMonthRange(args.monthToken);
  const result = await args.supabase
    .from("field_reports")
    .select("*")
    .eq("project_code", args.projectCode)
    .eq("report_type", "INSTALLATION")
    .gte("work_date", range.start)
    .lte("work_date", range.end)
    .order("work_date", { ascending: true })
    .order("imported_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  const rows = (result.data || []) as FieldReportRow[];
  const latestByDate = new Map<string, FieldReportRow>();
  for (const row of rows) {
    if (!latestByDate.has(row.work_date)) {
      latestByDate.set(row.work_date, row);
    }
  }
  return Array.from(latestByDate.values()).sort((a, b) => a.work_date.localeCompare(b.work_date));
}

export async function listFieldReportItems(args: {
  supabase: SupabaseClient;
  reportId: string;
}): Promise<FieldReportItemRow[]> {
  const result = await args.supabase
    .from("field_report_items")
    .select("*")
    .eq("report_id", args.reportId)
    .order("row_no", { ascending: true });
  if (result.error) throw new Error(result.error.message);
  return (result.data || []) as FieldReportItemRow[];
}

