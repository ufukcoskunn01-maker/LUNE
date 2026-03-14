/**
 * Usage:
 *   npm run import:installation -- <source_file_id> <local_excel_file_path>
 *
 * Example:
 *   npm run import:installation -- 11111111-2222-3333-4444-555555555555 "C:\Users\ufukc\Downloads\A27-E-INS-260311_rev00.xlsx"
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MATERIAL_SHEET = "\u041b\u0418\u041d\u0418\u042f \u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b";
const CONTROL_SHEET = "\u041b\u0418\u041d\u0418\u042f \u0427\u0435\u043b.-\u0427\u0430\u0441.";
const BATCH_SIZE = 500;

type SourceFileRow = {
  id: string;
  project_code: string;
  report_date: string;
  storage_path: string;
  file_name: string;
  revision_no: number | null;
  retry_count: number;
  content_hash: string | null;
  status: string;
};

type InstallationMaterialInsert = {
  source_file_id: string;
  source_sheet: string;
  source_row_no: number;
  display_no: number | null;
  work_date: string | null;
  date_matches_report: boolean;
  mode: string | null;
  location: string | null;
  zone: string | null;
  floor: string | null;
  elevation: string | null;
  team_number: string | null;
  budget_code: string | null;
  description: string | null;
  unit: string | null;
  qty: number;
  manhours: number;
  project_name: string | null;
  orientation: string | null;
  comments: string | null;
  system_label: string;
  activity_label: string;
  material_label: string;
  item_label: string;
};

type InstallationControlInsert = {
  source_file_id: string;
  source_sheet: string;
  source_row_no: number;
  display_no: number | null;
  work_date: string | null;
  date_matches_report: boolean;
  team_number: string | null;
  employee_id: string | null;
  full_name: string | null;
  profession: string | null;
  indirect_manhours: number;
  direct_manhours: number;
  control_value: string | null;
  control_status: "Present" | "Absent" | "Unknown";
  comments: string | null;
};

type MaterialSheetRow = InstallationMaterialInsert & {
  dateMismatch: boolean;
  missingBudget: boolean;
};

type ControlSheetRow = InstallationControlInsert & {
  dateMismatch: boolean;
  unknownControl: boolean;
};

type HeaderMatchConfig = Record<string, readonly string[]>;

type PersonalReportComparison = {
  present: number;
  absent: number;
} | null;

const MATERIAL_ALIASES = {
  number: ["\u2116 \u041f/\u041f", "n"],
  date: ["\u0414\u0430\u0442\u0430"],
  mode: ["\u041c\u043e\u043d\u0442\u0430\u0436 / \u0414\u0435\u043c\u043e\u043d\u0442\u0430\u0436", "\u041c\u043e\u043d\u0442\u0430\u0436/\u0414\u0435\u043c\u043e\u043d\u0442\u0430\u0436"],
  location: ["\u041b\u043e\u043a\u0430\u0446\u0438\u044f"],
  zone: ["\u0417\u0430\u0445\u0432\u0430\u0442\u043a\u0430"],
  floor: ["\u042d\u0442\u0430\u0436"],
  elevation: ["\u0412\u044b\u0441\u043e\u0442\u043d\u0430\u044f \u043e\u0442\u043c\u0435\u0442\u043a\u0430"],
  teamNumber: ["\u2116 \u0411\u0440\u0438\u0433\u0430\u0434\u044b"],
  budgetCode: ["\u041a\u043e\u0434 \u0434\u043b\u044f \u0411\u044e\u0434\u0436\u0435\u0442\u0430"],
  description: [
    "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b",
    "\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435 \u0440\u0430\u0431\u043e\u0442\u044b",
  ],
  unit: ["\u0415\u0434. \u0438\u0437\u043c", "\u0415\u0434.\u0438\u0437\u043c"],
  qty: ["\u041a\u043e\u043b-\u0432\u043e", "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e"],
  mh: ["\u0427\u0435\u043b.-\u0427\u0430\u0441.", "\u0427\u0435\u043b.-\u0447\u0430\u0441."],
  projectCode: ["\u0428\u0438\u0444\u0440 \u043f\u0440\u043e\u0435\u043a\u0442\u0430"],
  orientation: ["\u0413\u043e\u0440\u0438\u0437\u043e\u043d\u0442/\u0412\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c", "\u0413\u043e\u0440\u0438\u0437\u043e\u043d\u0442 / \u0412\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c"],
  comments: ["\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438", "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"],
} as const satisfies HeaderMatchConfig;

const CONTROL_ALIASES = {
  number: ["\u2116 \u041f/\u041f", "n"],
  date: ["\u0414\u0430\u0442\u0430"],
  teamNumber: ["\u2116 \u0411\u0440\u0438\u0433\u0430\u0434\u044b"],
  employeeId: ["\u0422\u0430\u0431\u0435\u043b\u044c\u043d\u044b\u0439 \u2116", "\u0422\u0430\u0431\u0435\u043b\u044c\u043d\u044b\u0439 N"],
  name: ["\u0424.\u0418.\u041e", "\u0424\u0418\u041e"],
  profession: ["\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c"],
  indirectMh: [
    "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u043e\u0442\u0440\u0430\u0431\u043e\u0442\u0430\u043d\u043d\u044b\u0445 \u0447\u0430\u0441\u043e\u0432 \u0432 \u0441\u043c\u0435\u043d\u0443-\u0418\u0422\u0420",
  ],
  directMh: [
    "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u043e\u0442\u0440\u0430\u0431\u043e\u0442\u0430\u043d\u043d\u044b\u0445 \u0447\u0430\u0441\u043e\u0432 \u0432 \u0441\u043c\u0435\u043d\u0443-\u0420\u0430\u0431\u043e\u0447\u0438\u0435",
  ],
  control: ["\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c"],
  comments: ["\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438", "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"],
} as const satisfies HeaderMatchConfig;

const ABSENT_KEYWORDS = [
  "\u043e\u0442\u0441\u0443\u0442",
  "\u0431\u043e\u043b",
  "\u0431\u043e\u043b\u044c\u043d\u0438\u0447",
  "\u043e\u0442\u043f\u0443\u0441\u043a",
  "\u043a\u043e\u043c\u0430\u043d\u0434\u0438\u0440",
  "\u043f\u0440\u043e\u0433\u0443\u043b",
  "\u043d\u0435\u044f\u0432",
  "absent",
] as const;

const PRESENT_KEYWORDS = [
  "\u044f\u0432\u043a\u0430",
  "present",
  "\u0440\u0430\u0431\u043e\u0442\u0430",
  "\u0432 \u0440\u0430\u0431\u043e\u0442\u0435",
  "\u043d\u0430 \u0440\u0430\u0431\u043e\u0442\u0435",
] as const;

function getCellString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function getCellNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCellText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[._,:;()[\]{}"'`/\\|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dateFromExcelValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const text = getCellString(value);
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return text;

  const localMatch = text.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (localMatch) return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;

  return null;
}

function detectHeaderRow(
  rows: unknown[][],
  aliases: HeaderMatchConfig
): { index: number; columns: Record<string, number> } {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 25); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const headers = row.map((value) => normalizeCellText(value));
    const columns: Record<string, number> = {};

    for (const [field, fieldAliases] of Object.entries(aliases)) {
      const foundIndex = headers.findIndex((header) =>
        fieldAliases.some((alias) => header.includes(normalizeCellText(alias)))
      );
      if (foundIndex >= 0) columns[field] = foundIndex;
    }

    if (Object.keys(columns).length >= Math.ceil(Object.keys(aliases).length * 0.65)) {
      return { index: rowIndex, columns };
    }
  }

  throw new Error("Could not detect installation report headers in workbook.");
}

function isProbablyDataRow(row: unknown[]): boolean {
  return row.some((cell) => getCellString(cell) !== null);
}

function parseDisplayNo(value: unknown): number | null {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function normalizeAttendanceStatus(control: string | null, directMh: number): "Present" | "Absent" | "Unknown" {
  const normalized = (control ?? "").trim().toLowerCase();
  if (normalized) {
    if (PRESENT_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "Present";
    if (ABSENT_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "Absent";
  }
  if (directMh > 0) return "Present";
  if (normalized) return "Absent";
  return "Unknown";
}

function inferSystem(budgetCode: string | null, description: string | null): string {
  const source = `${budgetCode ?? ""} ${description ?? ""}`.toLowerCase();
  if (source.includes("el-") || source.includes("elect") || source.includes("cable")) return "Electrical";
  if (source.includes("hvac") || source.includes("duct")) return "Mechanical";
  if (source.includes("fa-") || source.includes("detector")) return "Fire Alarm";
  if (source.includes("pl-") || source.includes("pipe") || source.includes("drain")) return "Plumbing";
  if (source.includes("low") || source.includes("security")) return "Low Current";
  return "General";
}

function inferActivity(mode: string | null, description: string | null): string {
  const normalizedMode = (mode ?? "").toLowerCase();
  if (normalizedMode.includes("\u0434\u0435\u043c\u043e\u043d")) return "Dismantling";
  if (normalizedMode.includes("\u043c\u043e\u043d\u0442\u0430\u0436") || normalizedMode === "\u043c") return "Installation";

  const source = (description ?? "").toLowerCase();
  if (source.includes("tray")) return "Tray";
  if (source.includes("duct")) return "Duct";
  if (source.includes("termin")) return "Termination";
  if (source.includes("pipe") || source.includes("drain")) return "Piping";
  return "Installation";
}

function inferMaterial(description: string | null): string {
  const source = (description ?? "").toLowerCase();
  if (source.includes("tray")) return "Tray";
  if (source.includes("duct")) return "Duct";
  if (source.includes("cable")) return "Cable";
  if (source.includes("pipe") || source.includes("drain")) return "Pipe";
  if (source.includes("detect")) return "Device";
  return "Material";
}

function inferItem(description: string | null): string {
  return description || "Installation item";
}

function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function parseMaterialRows(workbook: XLSX.WorkBook, reportDate: string, sourceFileId: string): MaterialSheetRow[] {
  const sheet = workbook.Sheets[MATERIAL_SHEET];
  if (!sheet) throw new Error(`Sheet "${MATERIAL_SHEET}" not found.`);
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][];
  const header = detectHeaderRow(rawRows, MATERIAL_ALIASES);

  return rawRows
    .slice(header.index + 1)
    .map((row, index) => {
      if (!isProbablyDataRow(row)) return null;

      const description = getCellString(row[header.columns.description]);
      const qty = getCellNumber(row[header.columns.qty]);
      const mh = getCellNumber(row[header.columns.mh]);
      const budgetCode = getCellString(row[header.columns.budgetCode]);
      const workDate = dateFromExcelValue(row[header.columns.date]);

      if (!description && qty === 0 && mh === 0) return null;

      return {
        source_file_id: sourceFileId,
        source_sheet: MATERIAL_SHEET,
        source_row_no: header.index + index + 2,
        display_no: parseDisplayNo(row[header.columns.number]),
        work_date: workDate,
        date_matches_report: workDate === null || workDate === reportDate,
        mode: getCellString(row[header.columns.mode]),
        location: getCellString(row[header.columns.location]),
        zone: getCellString(row[header.columns.zone]),
        floor: getCellString(row[header.columns.floor]),
        elevation: getCellString(row[header.columns.elevation]),
        team_number: getCellString(row[header.columns.teamNumber]),
        budget_code: budgetCode,
        description,
        unit: getCellString(row[header.columns.unit]),
        qty,
        manhours: mh,
        project_name: getCellString(row[header.columns.projectCode]),
        orientation: getCellString(row[header.columns.orientation]),
        comments: getCellString(row[header.columns.comments]),
        system_label: inferSystem(budgetCode, description),
        activity_label: inferActivity(getCellString(row[header.columns.mode]), description),
        material_label: inferMaterial(description),
        item_label: inferItem(description),
        dateMismatch: workDate !== null && workDate !== reportDate,
        missingBudget: !budgetCode,
      };
    })
    .filter((row): row is MaterialSheetRow => row !== null);
}

function parseControlRows(workbook: XLSX.WorkBook, reportDate: string, sourceFileId: string): ControlSheetRow[] {
  const sheet = workbook.Sheets[CONTROL_SHEET];
  if (!sheet) throw new Error(`Sheet "${CONTROL_SHEET}" not found.`);
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][];
  const header = detectHeaderRow(rawRows, CONTROL_ALIASES);

  return rawRows
    .slice(header.index + 1)
    .map((row, index) => {
      if (!isProbablyDataRow(row)) return null;

      const name = getCellString(row[header.columns.name]);
      const employeeId = getCellString(row[header.columns.employeeId]);
      const directMh = getCellNumber(row[header.columns.directMh]);
      const indirectMh = getCellNumber(row[header.columns.indirectMh]);
      const controlValue = getCellString(row[header.columns.control]);
      const workDate = dateFromExcelValue(row[header.columns.date]);

      if (!name && !employeeId && directMh === 0 && indirectMh === 0) return null;

      const status = normalizeAttendanceStatus(controlValue, directMh);
      return {
        source_file_id: sourceFileId,
        source_sheet: CONTROL_SHEET,
        source_row_no: header.index + index + 2,
        display_no: parseDisplayNo(row[header.columns.number]),
        work_date: workDate,
        date_matches_report: workDate === null || workDate === reportDate,
        team_number: getCellString(row[header.columns.teamNumber]),
        employee_id: employeeId,
        full_name: name,
        profession: getCellString(row[header.columns.profession]),
        indirect_manhours: indirectMh,
        direct_manhours: directMh,
        control_value: controlValue,
        control_status: status,
        comments: getCellString(row[header.columns.comments]),
        dateMismatch: workDate !== null && workDate !== reportDate,
        unknownControl: status === "Unknown",
      };
    })
    .filter((row): row is ControlSheetRow => row !== null);
}

async function fetchPersonalReportComparison(projectCode: string, reportDate: string): Promise<PersonalReportComparison> {
  try {
    const { data, error } = await supabase
      .from("attendance_active_classified_rows")
      .select("status")
      .eq("project_code", projectCode)
      .eq("report_date", reportDate)
      .eq("segment", "Direct")
      .eq("discipline", "Electrical");

    if (error) return null;

    const present = (data ?? []).filter((row) => row.status === "Present").length;
    const absent = (data ?? []).filter((row) => row.status === "Absent").length;
    return { present, absent };
  } catch {
    return null;
  }
}

function buildQuality(
  materialRows: MaterialSheetRow[],
  controlRows: ControlSheetRow[],
  personalComparison: PersonalReportComparison
) {
  const materialDateMismatchCount = materialRows.filter((row) => row.dateMismatch).length;
  const controlDateMismatchCount = controlRows.filter((row) => row.dateMismatch).length;
  const missingBudgetCount = materialRows.filter((row) => row.missingBudget).length;
  const unknownControlCount = controlRows.filter((row) => row.unknownControl).length;
  const materialMh = materialRows.reduce((sum, row) => sum + row.manhours, 0);
  const directMh = controlRows.reduce((sum, row) => sum + row.direct_manhours, 0);
  const mhDelta = Math.round((materialMh - directMh) * 100) / 100;
  const controlPresent = controlRows.filter((row) => row.control_status === "Present").length;
  const controlAbsent = controlRows.filter((row) => row.control_status === "Absent").length;

  const warnings: string[] = [];
  const flags: string[] = [];

  if (materialDateMismatchCount > 0) {
    warnings.push(`${materialDateMismatchCount} material rows have a date different from the source file report date.`);
    flags.push("material_date_mismatch");
  }
  if (controlDateMismatchCount > 0) {
    warnings.push(`${controlDateMismatchCount} control rows have a date different from the source file report date.`);
    flags.push("control_date_mismatch");
  }
  if (missingBudgetCount > 0) {
    warnings.push(`${missingBudgetCount} material rows are missing budget codes.`);
    flags.push("missing_budget_code");
  }
  if (unknownControlCount > 0) {
    warnings.push(`${unknownControlCount} control rows could not be classified as present or absent.`);
    flags.push("unknown_control_state");
  }
  if (Math.abs(mhDelta) > 0.01) {
    warnings.push(`Material MH and direct personnel MH differ by ${mhDelta.toFixed(2)}.`);
    flags.push("mh_delta");
  }
  if (personalComparison && (controlPresent !== personalComparison.present || controlAbsent !== personalComparison.absent)) {
    warnings.push(
      `Control sheet direct personnel differs from Daily Personal Reports (${controlPresent}/${controlAbsent} vs ${personalComparison.present}/${personalComparison.absent}).`
    );
    flags.push("personal_report_mismatch");
  }

  let qualityScore = 100;
  qualityScore -= Math.min(materialDateMismatchCount * 4, 24);
  qualityScore -= Math.min(controlDateMismatchCount * 4, 24);
  qualityScore -= Math.min(missingBudgetCount * 3, 18);
  qualityScore -= Math.min(unknownControlCount * 5, 20);
  if (Math.abs(mhDelta) > 0.01) qualityScore -= 12;
  if (flags.includes("personal_report_mismatch")) qualityScore -= 10;

  return {
    warnings,
    flags,
    qualityScore: Math.max(0, qualityScore),
    materialDateMismatchCount,
    controlDateMismatchCount,
    missingBudgetCount,
    unknownControlCount,
    materialMh,
    directMh,
    mhDelta,
    controlPresent,
    controlAbsent,
    personalComparison,
  };
}

async function insertInBatches<T extends Record<string, unknown>>(table: string, rows: T[]) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const chunk = rows.slice(start, start + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
}

function stripMaterialMeta(row: MaterialSheetRow): InstallationMaterialInsert {
  const { dateMismatch: _dateMismatch, missingBudget: _missingBudget, ...insertRow } = row;
  return insertRow;
}

function stripControlMeta(row: ControlSheetRow): InstallationControlInsert {
  const { dateMismatch: _dateMismatch, unknownControl: _unknownControl, ...insertRow } = row;
  return insertRow;
}

async function main() {
  const sourceFileId = process.argv[2];
  const localFilePath = process.argv[3];

  if (!sourceFileId || !localFilePath) {
    throw new Error("Usage: npm run import:installation -- <source_file_id> <local_excel_file_path>");
  }

  const resolvedPath = path.resolve(localFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Local file not found: ${resolvedPath}`);
  }

  const { data: sourceFile, error: sourceFileError } = await supabase
    .from("installation_source_files")
    .select("id, project_code, report_date, storage_path, file_name, revision_no, retry_count, content_hash, status")
    .eq("id", sourceFileId)
    .single<SourceFileRow>();

  if (sourceFileError || !sourceFile) {
    throw new Error(`Installation source file not found: ${sourceFileError?.message ?? sourceFileId}`);
  }

  const processingStartedAt = new Date().toISOString();
  const { error: processingError } = await supabase
    .from("installation_source_files")
    .update({
      status: "processing",
      error_message: null,
      updated_at: processingStartedAt,
      removed_from_storage_at: null,
      storage_last_seen_at: processingStartedAt,
    })
    .eq("id", sourceFileId);

  if (processingError) {
    throw new Error(`Failed to mark installation source file as processing: ${processingError.message}`);
  }

  try {
    const fileBuffer = fs.readFileSync(resolvedPath);
    const fileHash = sha256Hex(fileBuffer);
    const fileSize = fileBuffer.byteLength;
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });

    const materialRows = parseMaterialRows(workbook, sourceFile.report_date, sourceFileId);
    const controlRows = parseControlRows(workbook, sourceFile.report_date, sourceFileId);

    if (materialRows.length === 0) {
      throw new Error(`No installation material rows found in sheet "${MATERIAL_SHEET}".`);
    }

    const personalComparison = await fetchPersonalReportComparison(sourceFile.project_code, sourceFile.report_date);
    const quality = buildQuality(materialRows, controlRows, personalComparison);

    const { error: deleteMaterialError } = await supabase
      .from("installation_material_rows")
      .delete()
      .eq("source_file_id", sourceFileId);
    if (deleteMaterialError) {
      throw new Error(`Failed to clear installation material rows: ${deleteMaterialError.message}`);
    }

    const { error: deleteControlError } = await supabase
      .from("installation_control_rows")
      .delete()
      .eq("source_file_id", sourceFileId);
    if (deleteControlError) {
      throw new Error(`Failed to clear installation control rows: ${deleteControlError.message}`);
    }

    await insertInBatches(
      "installation_material_rows",
      materialRows.map(stripMaterialMeta)
    );

    if (controlRows.length > 0) {
      await insertInBatches(
        "installation_control_rows",
        controlRows.map(stripControlMeta)
      );
    }

    const processedAt = new Date().toISOString();
    const parseDebug = {
      workbookSheets: workbook.SheetNames,
      reportDate: sourceFile.report_date,
      materialRows: materialRows.length,
      controlRows: controlRows.length,
      materialDateMismatchCount: quality.materialDateMismatchCount,
      controlDateMismatchCount: quality.controlDateMismatchCount,
      missingBudgetCount: quality.missingBudgetCount,
      unknownControlCount: quality.unknownControlCount,
      materialMh: quality.materialMh,
      directMh: quality.directMh,
      mhDelta: quality.mhDelta,
      controlPresent: quality.controlPresent,
      controlAbsent: quality.controlAbsent,
      personalComparison,
      warnings: quality.warnings,
    };

    const { error: doneError } = await supabase
      .from("installation_source_files")
      .update({
        status: "done",
        row_count_material: materialRows.length,
        row_count_control: controlRows.length,
        warning_count: quality.warnings.length,
        quality_score: quality.qualityScore,
        quality_flags: quality.flags,
        parse_debug: parseDebug,
        file_size: fileSize,
        content_hash: fileHash,
        processed_at: processedAt,
        updated_at: processedAt,
        error_message: null,
        storage_last_seen_at: processedAt,
        removed_from_storage_at: null,
      })
      .eq("id", sourceFileId);

    if (doneError) {
      throw new Error(`Failed to update installation source file as done: ${doneError.message}`);
    }

    const { error: promoteError } = await supabase.rpc("promote_installation_report", {
      p_project_code: sourceFile.project_code,
      p_report_date: sourceFile.report_date,
      p_active_file_id: sourceFileId,
    });

    if (promoteError) {
      throw new Error(`Failed to promote installation report: ${promoteError.message}`);
    }

    console.log("Installation import completed successfully.");
    console.log({
      source_file_id: sourceFileId,
      project_code: sourceFile.project_code,
      report_date: sourceFile.report_date,
      material_rows: materialRows.length,
      control_rows: controlRows.length,
      warning_count: quality.warnings.length,
      quality_score: quality.qualityScore,
      local_file: resolvedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("installation_source_files")
      .update({
        status: "failed",
        error_message: message,
        retry_count: (sourceFile.retry_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceFileId);

    throw error;
  }
}

main().catch((error) => {
  console.error("Installation import failed.");
  console.error(error);
  process.exit(1);
});
