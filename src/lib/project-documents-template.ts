import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { normalizeProjectDocumentSourceRows, type DocumentWorkflowStatus, type ProjectDocumentSourceRow } from "@/lib/project-documents-follow-up";

export type ProjectDocumentTemplateDownload = {
  bucket: string;
  path: string;
  fileName: string;
  buffer: Buffer;
};

type HeaderDetection = {
  headerRowNumber: number;
  columnToKey: Map<number, keyof ProjectDocumentSourceRow>;
};

const TEMPLATE_FOLDER_CANDIDATES = ["Temples", "Templates"] as const;
const BUCKET_CANDIDATES = ["imports", "project-files", "templates"] as const;
const EMPTY_ROW_BREAK_COUNT = 12;

const EXPORT_FIELD_ORDER: Array<keyof ProjectDocumentSourceRow> = [
  "documentCode",
  "title",
  "type",
  "discipline",
  "project",
  "packageCode",
  "revision",
  "workflowStatus",
  "requiredDate",
  "reviewDueDate",
  "approvedDate",
  "issuedForConstructionDate",
  "supplier",
  "responsible",
  "linkedMaterialCode",
  "blockedByMaterial",
  "packageReadiness",
  "lastUpdate",
  "oneCReferenceId",
  "externalSyncId",
  "syncStatus",
  "externalStatus",
  "lastSyncTime",
  "sourceSystem",
  "syncErrorMessage",
  "notes",
];

const FIELD_LABELS: Record<keyof ProjectDocumentSourceRow, string> = {
  id: "ID",
  documentCode: "Document Code",
  title: "Document Title",
  type: "Document Type",
  discipline: "Discipline",
  project: "Project",
  packageCode: "Package Code",
  revision: "Revision",
  workflowStatus: "Workflow Status",
  requiredDate: "Required Date",
  reviewDueDate: "Review Due Date",
  approvedDate: "Approved Date",
  issuedForConstructionDate: "Issued for Construction Date",
  supplier: "Supplier",
  responsible: "Responsible",
  linkedMaterialCode: "Linked Material Code",
  blockedByMaterial: "Blocked By Material",
  packageReadiness: "Package Readiness",
  lastUpdate: "Last Update",
  notes: "Notes",
  oneCReferenceId: "1C Reference ID",
  externalSyncId: "External Sync ID",
  syncStatus: "Sync Status",
  externalStatus: "External Status",
  lastSyncTime: "Last Sync Time",
  sourceSystem: "Source System",
  syncErrorMessage: "Sync Error Message",
};

const HEADER_ALIASES: Record<keyof ProjectDocumentSourceRow, string[]> = {
  id: ["id", "record id"],
  documentCode: ["document code", "documentcode", "doc code", "document_no", "document no", "documentcodeid"],
  title: ["document title", "title", "document name", "description"],
  type: ["document type", "type", "doc type"],
  discipline: ["discipline", "trade"],
  project: ["project", "project name", "project code"],
  packageCode: ["package code", "package", "package id", "work package"],
  revision: ["revision", "revision no", "rev", "revision number"],
  workflowStatus: ["workflow status", "status", "approval status", "document status"],
  requiredDate: ["required date", "submission date", "date required"],
  reviewDueDate: ["review due date", "expected date", "approval due date", "due date"],
  approvedDate: ["approved date", "approval date"],
  issuedForConstructionDate: ["issued for construction date", "afc date", "approved for construction date"],
  supplier: ["supplier", "vendor"],
  responsible: ["responsible", "responsible person", "owner"],
  linkedMaterialCode: ["linked material code", "material code", "material", "linked material"],
  blockedByMaterial: ["blocked by material", "material blocked", "blocked", "material blocker"],
  packageReadiness: ["package readiness", "readiness", "package ready %", "readiness percent"],
  lastUpdate: ["last update", "last update date", "updated at"],
  notes: ["notes", "remark", "remarks", "comment"],
  oneCReferenceId: ["1c reference id", "1c id", "onec reference id", "one c reference id"],
  externalSyncId: ["external sync id", "sync id"],
  syncStatus: ["sync status", "sync"],
  externalStatus: ["external status", "source status"],
  lastSyncTime: ["last sync time", "sync time"],
  sourceSystem: ["source system", "source"],
  syncErrorMessage: ["sync error message", "sync error", "error message"],
};

const WORKFLOW_STATUS_VALUES: DocumentWorkflowStatus[] = ["Draft", "Submitted", "In Review", "Approved", "Rejected"];

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function headerKeyFromText(value: string): keyof ProjectDocumentSourceRow | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;

  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[keyof ProjectDocumentSourceRow, string[]]>) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
      return key;
    }
  }

  return null;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  if (typeof value === "object" && "result" in value && typeof value.result !== "undefined") return String(value.result ?? "").trim();
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((piece) => piece?.text || "").join("").trim();
  }
  return String(value).trim();
}

function toIsoDateOrRaw(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

function toWorkflowStatus(value: string): DocumentWorkflowStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("reject")) return "Rejected";
  if (normalized.includes("approve")) return "Approved";
  if (normalized.includes("review")) return "In Review";
  if (normalized.includes("submit")) return "Submitted";
  return "Draft";
}

function coerceValue(key: keyof ProjectDocumentSourceRow, value: string): unknown {
  if (!value) return key === "revision" || key === "packageReadiness" ? 0 : key === "blockedByMaterial" ? false : "";

  if (key === "revision") {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
  }

  if (key === "packageReadiness") {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (key === "blockedByMaterial") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1" || normalized === "blocked";
  }

  if (
    key === "requiredDate" ||
    key === "reviewDueDate" ||
    key === "approvedDate" ||
    key === "issuedForConstructionDate" ||
    key === "lastUpdate"
  ) {
    return toIsoDateOrRaw(value);
  }

  if (key === "workflowStatus") {
    return toWorkflowStatus(value);
  }

  return value.trim();
}

function findHeader(sheet: ExcelJS.Worksheet): HeaderDetection | null {
  let best: HeaderDetection | null = null;

  const maxRow = Math.min(sheet.rowCount, 30);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const columnToKey = new Map<number, keyof ProjectDocumentSourceRow>();

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = headerKeyFromText(cellToString(cell.value));
      if (key) columnToKey.set(colNumber, key);
    });

    if (columnToKey.size >= 4) {
      if (!best || columnToKey.size > best.columnToKey.size) {
        best = { headerRowNumber: rowNumber, columnToKey };
      }
    }
  }

  return best;
}

function fallbackHeader(sheet: ExcelJS.Worksheet): HeaderDetection {
  const headerRow = sheet.getRow(1);
  const columnToKey = new Map<number, keyof ProjectDocumentSourceRow>();
  sheet.spliceRows(1, sheet.rowCount);

  const labels = EXPORT_FIELD_ORDER.map((key) => FIELD_LABELS[key]);
  headerRow.values = [null, ...labels];
  headerRow.font = { bold: true };
  headerRow.commit();

  EXPORT_FIELD_ORDER.forEach((key, index) => {
    columnToKey.set(index + 1, key);
  });

  return { headerRowNumber: 1, columnToKey };
}

function toExportCellValue(key: keyof ProjectDocumentSourceRow, row: ProjectDocumentSourceRow): string | number | boolean {
  if (key === "revision") return Number(row.revision || 0);
  if (key === "packageReadiness") return Number(row.packageReadiness || 0);
  if (key === "blockedByMaterial") return Boolean(row.blockedByMaterial);
  if (key === "workflowStatus") return row.workflowStatus;
  return String(row[key] ?? "");
}

function candidateBuckets(): string[] {
  const configured = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  const values = [configured || "", ...BUCKET_CANDIDATES].filter((value) => value.length > 0);
  return Array.from(new Set(values));
}

function candidatePaths(projectCode: string): string[] {
  const code = projectCode.trim() || "A27";
  const fileName = `${code}-E-PBIM_rev00.xlsx`;
  const paths = TEMPLATE_FOLDER_CANDIDATES.map((folder) => `${folder}/${code}/Pilot-BIM/${fileName}`);
  return Array.from(new Set(paths));
}

export async function downloadProjectDocumentsTemplate(
  admin: SupabaseClient<Database>,
  projectCode: string
): Promise<ProjectDocumentTemplateDownload | null> {
  const buckets = candidateBuckets();
  const paths = candidatePaths(projectCode);

  for (const bucket of buckets) {
    for (const path of paths) {
      const downloaded = await admin.storage.from(bucket).download(path);
      if (downloaded.error || !downloaded.data) continue;

      const arrayBuffer = await downloaded.data.arrayBuffer();
      return {
        bucket,
        path,
        fileName: path.split("/").at(-1) || `${projectCode}-E-PBIM_rev00.xlsx`,
        buffer: Buffer.from(arrayBuffer),
      };
    }
  }

  return null;
}

export async function parseProjectDocumentsTemplateBuffer(buffer: Buffer): Promise<{
  sheetName: string;
  headerRowNumber: number | null;
  matchedColumns: number;
  rows: ProjectDocumentSourceRow[];
}> {
  const workbook = new ExcelJS.Workbook();
  type WorkbookLoadInput = Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(buffer as unknown as WorkbookLoadInput);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { sheetName: "", headerRowNumber: null, matchedColumns: 0, rows: [] };
  }

  const detection = findHeader(sheet);
  if (!detection) {
    return { sheetName: sheet.name, headerRowNumber: null, matchedColumns: 0, rows: [] };
  }

  const parsed: Array<Partial<ProjectDocumentSourceRow>> = [];
  let emptyStreak = 0;

  for (let rowNumber = detection.headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const partial: Partial<ProjectDocumentSourceRow> = {};
    let hasValue = false;

    detection.columnToKey.forEach((key, columnNumber) => {
      const raw = cellToString(row.getCell(columnNumber).value);
      if (!raw) return;
      hasValue = true;
      partial[key] = coerceValue(key, raw) as never;
    });

    if (!hasValue) {
      emptyStreak += 1;
      if (emptyStreak >= EMPTY_ROW_BREAK_COUNT) break;
      continue;
    }

    emptyStreak = 0;
    parsed.push(partial);
  }

  return {
    sheetName: sheet.name,
    headerRowNumber: detection.headerRowNumber,
    matchedColumns: detection.columnToKey.size,
    rows: normalizeProjectDocumentSourceRows(parsed),
  };
}

export async function buildProjectDocumentsTemplateExport(args: {
  templateBuffer: Buffer | null;
  rows: Array<Partial<ProjectDocumentSourceRow>>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const normalizedRows = normalizeProjectDocumentSourceRows(args.rows);

  if (args.templateBuffer) {
    type WorkbookLoadInput = Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(args.templateBuffer as unknown as WorkbookLoadInput);
  }

  const sheet = workbook.worksheets[0] || workbook.addWorksheet("Project Documents");

  let detection = findHeader(sheet);
  if (!detection) {
    detection = fallbackHeader(sheet);
  }

  if (sheet.rowCount > detection.headerRowNumber) {
    sheet.spliceRows(detection.headerRowNumber + 1, sheet.rowCount - detection.headerRowNumber);
  }

  const orderedColumns = Array.from(detection.columnToKey.entries()).sort((left, right) => left[0] - right[0]);
  normalizedRows.forEach((row, index) => {
    const rowNumber = detection!.headerRowNumber + 1 + index;
    const targetRow = sheet.getRow(rowNumber);
    orderedColumns.forEach(([columnNumber, key]) => {
      targetRow.getCell(columnNumber).value = toExportCellValue(key, row);
    });
    targetRow.commit();
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as ArrayBuffer);
}

export function normalizeWorkflowStatus(input: string): DocumentWorkflowStatus {
  const normalized = input.trim();
  const match = WORKFLOW_STATUS_VALUES.find((status) => status.toLowerCase() === normalized.toLowerCase());
  return match || toWorkflowStatus(normalized);
}

