import path from "path";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clampEfficiency, numberFromUnknown, parseInstallationFileMeta } from "@/lib/field-installation/utils";
import {
  DEFAULT_PROCESSING_TIMEOUT_MS,
  FIELD_INSTALLATION_PARSER_VERSION,
  INSTALLATION_INGEST_STATUS,
  buildIngestionAudit,
  distinctIsoDates,
  isProcessingStale,
} from "@/lib/field-installation/ingestion-lifecycle";

type StorageItem = { name?: string | null; metadata?: Record<string, unknown> | null };

type InstallationFileMeta = {
  id: string;
  project_code: string;
  work_date: string;
  bucket_id: string | null;
  storage_path: string;
  file_name: string;
  file_kind: string | null;
  revision: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  ingest_status?: string | null;
  processing_started_at?: string | null;
  processing_finished_at?: string | null;
  processed_at?: string | null;
  parsed_material_rows?: number | null;
  parsed_labor_rows?: number | null;
  inserted_material_rows?: number | null;
  inserted_labor_rows?: number | null;
};

type MaterialParsedRow = {
  rowNo: number | null;
  rowDate: string | null;
  teamNo: string | null;
  installAction: string | null;
  location: string | null;
  zone: string | null;
  floor: string | null;
  elevation: string | null;
  budgetCode: string | null;
  description: string | null;
  unit: string | null;
  qty: number | null;
  manhours: number | null;
  projectName: string | null;
  orientation: string | null;
  comment: string | null;
  raw: Record<string, unknown>;
};

type LaborParsedRow = {
  rowDate: string | null;
  teamNo: string | null;
  employeeId: string | null;
  fullName: string | null;
  title: string | null;
  hoursIndirect: number | null;
  hoursDirect: number | null;
  raw: Record<string, unknown>;
};

export type WarningItem = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type FieldInstallationImportResult = {
  fileId: string;
  parsedMaterialRows: number;
  parsedLaborRows: number;
  insertedMaterialRows: number;
  insertedLaborRows: number;
  mh_material: number;
  mh_direct: number;
  mh_indirect: number;
  warnings: WarningItem[];
  distinctRowDates: string[];
  ingestStatus: string;
};

function normalizePersonName(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseDateFromToken(token: string): string | null {
  const digits = token.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${2000 + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    // Excel datetimes in this feed are authored in Moscow time and can shift by UTC when
    // parsed on server runtimes. Normalize to UTC+03 before extracting date parts.
    const shifted = new Date(value.getTime() + 3 * 60 * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const m = shifted.getUTCMonth() + 1;
    const d = shifted.getUTCDate();
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (decoded) {
      return `${String(decoded.y).padStart(4, "0")}-${String(decoded.m).padStart(2, "0")}-${String(decoded.d).padStart(2, "0")}`;
    }
  }

  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const ddMmYyyy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (ddMmYyyy) {
    const dd = Number(ddMmYyyy[1]);
    const mm = Number(ddMmYyyy[2]);
    const rawYear = Number(ddMmYyyy[3]);
    const yyyy = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  const token6 = text.match(/(\d{6})/);
  if (token6) return parseDateFromToken(token6[1]);
  return null;
}

function pickSheet(workbook: XLSX.WorkBook, sheetNames: string[]): XLSX.WorkSheet {
  for (const sheetName of sheetNames) {
    if (workbook.Sheets[sheetName]) return workbook.Sheets[sheetName];
  }

  const normalizedAliases = sheetNames.map((sheetName) => sheetName.trim().toLowerCase());
  const fuzzy = workbook.SheetNames.find((name) => {
    const normalized = name.trim().toLowerCase();
    return normalizedAliases.some((alias) => normalized.includes(alias));
  });

  if (fuzzy && workbook.Sheets[fuzzy]) return workbook.Sheets[fuzzy];
  throw new Error(`Sheet not found. Expected one of: ${sheetNames.join(", ")}`);
}

function parseMaterialSheet(workbook: XLSX.WorkBook): { rows: MaterialParsedRow[]; dates: string[]; mhMaterial: number } {
  const ws = pickSheet(workbook, ["GUNLUK RAPOR", "ЛИНИЯ Материал", "Field Material"]);
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true }) as unknown[][];
  const rows: MaterialParsedRow[] = [];
  const dates: string[] = [];
  let mhMaterial = 0;
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const rowNo = numberFromUnknown(row[0]);
    const rowDate = toIsoDate(row[1]);
    const installAction = normalizeText(row[2]);
    const location = normalizeText(row[3]);
    const zone = normalizeText(row[4]);
    const floor = normalizeText(row[5]);
    const elevation = normalizeText(row[6]);
    const teamNo = normalizeText(row[7]);
    const budgetCode = normalizeText(row[8]);
    const description = normalizeText(row[9]);
    const unit = normalizeText(row[10]);
    const qty = numberFromUnknown(row[11]);
    const manhours = numberFromUnknown(row[12]);
    const projectName = normalizeText(row[13]);
    const orientation = normalizeText(row[14]);
    const comment = normalizeText(row[15]);
    const hasNumericWork = qty !== null || manhours !== null;
    const hasBudgetLikeCode = Boolean(budgetCode && /\d/.test(budgetCode));
    if (!(description && (hasNumericWork || hasBudgetLikeCode))) continue;

    if (rowDate) dates.push(rowDate);
    mhMaterial += manhours ?? 0;
    rows.push({
      rowNo,
      rowDate,
      teamNo,
      installAction,
      location,
      zone,
      floor,
      elevation,
      budgetCode,
      description,
      unit,
      qty,
      manhours,
      projectName,
      orientation,
      comment,
      raw: {
        line_no: row[0] ?? null,
        report_date: row[1] ?? null,
        install_or_remove: installAction,
        location,
        zone,
        floor,
        elevation,
        team_no: row[7] ?? null,
        budget_code: budgetCode,
        description,
        unit,
        source_qty: qty,
        source_manhours: manhours,
        qty,
        manhours,
        project_name: projectName,
        orientation,
        comment,
      },
    });
  }

  return { rows, dates, mhMaterial: Number(mhMaterial.toFixed(3)) };
}

function parseLaborSheet(workbook: XLSX.WorkBook): { rows: LaborParsedRow[]; dates: string[]; mhDirect: number; mhIndirect: number } {
  const ws = pickSheet(workbook, ["ЛИНИЯ Чел.-Час.", "Field Manhour"]);
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true }) as unknown[][];
  const rows: LaborParsedRow[] = [];
  const dates: string[] = [];
  let mhDirect = 0;
  let mhIndirect = 0;

  for (let i = 2; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const rowDate = toIsoDate(row[1]);
    const employeeId = normalizeText(row[3]);
    const fullName = normalizeText(row[4]);
    const hoursIndirect = numberFromUnknown(row[6]);
    const hoursDirect = numberFromUnknown(row[7]);

    if (!((employeeId || fullName) && (hoursIndirect !== null || hoursDirect !== null))) continue;

    if (rowDate) dates.push(rowDate);
    mhDirect += hoursDirect ?? 0;
    mhIndirect += hoursIndirect ?? 0;
    rows.push({
      rowDate,
      teamNo: normalizeText(row[2]),
      employeeId,
      fullName,
      title: normalizeText(row[5]),
      hoursIndirect,
      hoursDirect,
      raw: {
        line_no: row[0] ?? null,
        report_date: row[1] ?? null,
        team_no: row[2] ?? null,
        employee_id: row[3] ?? null,
        full_name: row[4] ?? null,
        title: row[5] ?? null,
        hours_indirect: row[6] ?? null,
        hours_direct: row[7] ?? null,
      },
    });
  }

  return { rows, dates, mhDirect, mhIndirect };
}

async function listAll(admin: SupabaseClient, bucket: string, prefix: string): Promise<StorageItem[]> {
  const out: StorageItem[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const res = await admin.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (res.error) throw new Error(`Storage list failed at ${prefix}: ${res.error.message}`);
    const rows = (res.data || []) as StorageItem[];
    out.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return out;
}

function isFolder(item: StorageItem): boolean {
  const name = String(item.name || "").trim();
  if (!name) return false;
  const metadata = item.metadata || {};
  if (typeof metadata.size === "number" || typeof metadata.mimetype === "string") return false;
  return !name.includes(".");
}

function revisionValue(revision: string | null): number {
  const parsed = Number(String(revision || "rev00").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function upsertFileMeta(args: {
  admin: SupabaseClient;
  projectCode: string;
  workDate: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  revision: string | null;
}): Promise<InstallationFileMeta> {
  const nowIso = new Date().toISOString();
  const upsert = await args.admin
    .from("field_installation_files")
    .upsert(
      {
        project_code: args.projectCode,
        work_date: args.workDate,
        bucket_id: args.bucket,
        storage_path: args.storagePath,
        file_name: args.fileName,
        file_kind: "installation",
        revision: args.revision || "rev00",
        source_created_at: nowIso,
        ingest_status: INSTALLATION_INGEST_STATUS.queued,
        uploaded_at: nowIso,
      },
      { onConflict: "bucket_id,storage_path" }
    )
    .select(
      "id,project_code,work_date,bucket_id,storage_path,file_name,file_kind,revision,updated_at,created_at,ingest_status,processing_started_at,processing_finished_at,processed_at,parsed_material_rows,parsed_labor_rows,inserted_material_rows,inserted_labor_rows"
    )
    .single();

  if (upsert.error || !upsert.data) throw new Error(upsert.error?.message || "Failed to upsert field_installation_files.");
  return upsert.data as InstallationFileMeta;
}

async function findFileMeta(args: {
  admin: SupabaseClient;
  projectCode: string;
  workDate: string;
  bucket: string;
}): Promise<InstallationFileMeta | null> {
  const existing = await args.admin
    .from("field_installation_files")
    .select(
      "id,project_code,work_date,bucket_id,storage_path,file_name,file_kind,revision,updated_at,created_at,ingest_status,processing_started_at,processing_finished_at,processed_at,parsed_material_rows,parsed_labor_rows,inserted_material_rows,inserted_labor_rows"
    )
    .eq("project_code", args.projectCode)
    .eq("work_date", args.workDate)
    .order("revision", { ascending: false });

  if (!existing.error && existing.data?.length) {
    const sorted = [...existing.data].sort((a, b) => revisionValue(String(b.revision || "")) - revisionValue(String(a.revision || "")));
    return sorted[0] as InstallationFileMeta;
  }

  const year = args.workDate.slice(0, 4);
  const yearPrefix = `${args.projectCode}/2-Daily Field Reports/${year}`;
  const months = (await listAll(args.admin, args.bucket, yearPrefix)).filter(isFolder);
  const candidates: Array<{ storagePath: string; fileName: string; revision: string | null }> = [];

  for (const monthFolder of months) {
    const monthPath = `${yearPrefix}/${String(monthFolder.name || "").trim()}`;
    const files = await listAll(args.admin, args.bucket, monthPath);
    for (const file of files) {
      if (isFolder(file)) continue;
      const fileName = String(file.name || "").trim();
      if (!fileName) continue;
      const parsed = parseInstallationFileMeta(fileName);
      if (!parsed || parsed.workDate !== args.workDate) continue;
      candidates.push({
        storagePath: `${monthPath}/${fileName}`,
        fileName,
        revision: parsed.revision || null,
      });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => revisionValue(b.revision) - revisionValue(a.revision));
  const best = candidates[0];
  return upsertFileMeta({
    admin: args.admin,
    projectCode: args.projectCode,
    workDate: args.workDate,
    bucket: args.bucket,
    storagePath: best.storagePath,
    fileName: best.fileName,
    revision: best.revision,
  });
}

async function getFileById(admin: SupabaseClient, fileId: string): Promise<InstallationFileMeta> {
  const res = await admin
    .from("field_installation_files")
    .select(
      "id,project_code,work_date,bucket_id,storage_path,file_name,file_kind,revision,updated_at,created_at,ingest_status,processing_started_at,processing_finished_at,processed_at,parsed_material_rows,parsed_labor_rows,inserted_material_rows,inserted_labor_rows"
    )
    .eq("id", fileId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) throw new Error("File metadata not found.");
  return res.data as InstallationFileMeta;
}

async function markFileStatus(
  admin: SupabaseClient,
  fileId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const res = await admin.from("field_installation_files").update(patch).eq("id", fileId);
  if (res.error) throw new Error(res.error.message);
}

async function hasCompleteSourceIngest(admin: SupabaseClient, file: InstallationFileMeta): Promise<boolean> {
  const [summaryRes, rowsRes] = await Promise.all([
    admin
      .from("field_installation_day_summary")
      .select("source_file_id,work_date")
      .eq("source_file_id", file.id)
      .maybeSingle<{ source_file_id: string; work_date: string }>(),
    admin
      .from("field_installation_rows")
      .select("source_file_id,work_date")
      .eq("source_file_id", file.id)
      .limit(1)
      .maybeSingle<{ source_file_id: string; work_date: string }>(),
  ]);
  if (summaryRes.error) throw new Error(summaryRes.error.message);
  if (rowsRes.error && rowsRes.error.code !== "PGRST116") throw new Error(rowsRes.error.message);

  const summaryMatches = summaryRes.data?.work_date === file.work_date;
  if (!summaryMatches) return false;

  const rowMatches = rowsRes.data?.work_date === file.work_date;
  if (rowMatches) return true;

  const status = file.ingest_status || INSTALLATION_INGEST_STATUS.uploaded;
  return status === INSTALLATION_INGEST_STATUS.ready && Boolean(file.processing_finished_at || file.processed_at);
}

function buildWarnings(args: {
  file: InstallationFileMeta;
  workDate: string;
  materialDates: string[];
  laborDates: string[];
  mhMaterial: number;
  mhDirect: number;
  attendanceMatchOk: boolean;
  installationDirectNames: string[];
  attendanceDirectElectricalNames: string[];
}): WarningItem[] {
  const warnings: WarningItem[] = [];
  const fromNameDate = parseInstallationFileMeta(path.basename(args.file.file_name || args.file.storage_path || ""))?.workDate || null;
  if (fromNameDate && fromNameDate !== args.workDate) {
    warnings.push({
      code: "filename_date_mismatch",
      message: "Filename date does not match requested work date.",
      details: { expected: args.workDate, filenameDate: fromNameDate },
    });
  }

  const allSheetDates = [...args.materialDates, ...args.laborDates].filter(Boolean);
  const mismatchedDates = allSheetDates.filter((date) => date !== args.workDate);
  if (mismatchedDates.length) {
    warnings.push({
      code: "sheet_date_mismatch",
      message: "Some row dates differ from the selected work date.",
      details: {
        expected: args.workDate,
        mismatchedCount: mismatchedDates.length,
        distinctDates: distinctIsoDates(mismatchedDates),
      },
    });
  }

  const mhMatchOk = Math.abs(args.mhMaterial - args.mhDirect) <= 0.5;
  if (!mhMatchOk) {
    warnings.push({
      code: "manhour_mismatch",
      message: "Material manhours and direct personnel hours are not aligned.",
      details: { mh_material: args.mhMaterial, mh_direct: args.mhDirect, tolerance: 0.5 },
    });
  }

  if (!args.attendanceMatchOk) {
    const instSet = new Set(args.installationDirectNames);
    const attSet = new Set(args.attendanceDirectElectricalNames);
    warnings.push({
      code: "direct_personnel_mismatch",
      message: "Direct personnel list mismatch between Installation report and Daily Personal Reports (Electrical-Direct).",
      details: {
        installation_direct_count: args.installationDirectNames.length,
        personal_electrical_direct_count: args.attendanceDirectElectricalNames.length,
        installation_direct_names: Array.from(instSet).sort((a, b) => a.localeCompare(b)),
        personal_electrical_direct_names: Array.from(attSet).sort((a, b) => a.localeCompare(b)),
        missing_in_personal: Array.from(instSet).filter((name) => !attSet.has(name)),
        missing_in_installation: Array.from(attSet).filter((name) => !instSet.has(name)),
      },
    });
  }

  return warnings;
}

async function parseAttendanceNames(args: {
  admin: SupabaseClient;
  projectCode: string;
  workDate: string;
}): Promise<string[]> {
  const { data: projectRow, error: projectErr } = await args.admin
    .from("projects")
    .select("id")
    .eq("code", args.projectCode)
    .maybeSingle();
  if (projectErr) throw new Error(projectErr.message);
  if (!projectRow?.id) return [];

  const attendanceRes = await args.admin
    .from("attendance_records")
    .select("full_name")
    .eq("project_id", projectRow.id)
    .eq("work_date", args.workDate)
    .eq("segment", "Direct")
    .eq("discipline", "Electrical")
    .eq("status", "Present");
  if (attendanceRes.error) throw new Error(attendanceRes.error.message);

  return (attendanceRes.data || [])
    .map((row) => normalizePersonName((row as { full_name?: string | null }).full_name))
    .filter(Boolean);
}

async function processFile(args: {
  admin: SupabaseClient;
  file: InstallationFileMeta;
  force?: boolean;
}): Promise<FieldInstallationImportResult> {
  const nowIso = new Date().toISOString();
  const timeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS;
  const stale = isProcessingStale(args.file, Date.now(), timeoutMs);

  if (args.file.ingest_status === INSTALLATION_INGEST_STATUS.processing && !stale && !args.force) {
    throw new Error(`File ${args.file.id} is already processing.`);
  }

  if (stale) {
    await markFileStatus(args.admin, args.file.id, {
      ingest_status: INSTALLATION_INGEST_STATUS.failed_timeout,
      last_error: `Processing timeout after ${Math.round(timeoutMs / 1000)}s.`,
      parse_error: `Processing timeout after ${Math.round(timeoutMs / 1000)}s.`,
      processing_finished_at: nowIso,
      last_retry_at: nowIso,
    });
    args.file.ingest_status = INSTALLATION_INGEST_STATUS.failed_timeout;
  }

  const complete = await hasCompleteSourceIngest(args.admin, args.file);
  if (complete && !args.force && args.file.ingest_status === INSTALLATION_INGEST_STATUS.ready) {
    return {
      fileId: args.file.id,
      parsedMaterialRows: Number(args.file.parsed_material_rows || 0),
      parsedLaborRows: Number(args.file.parsed_labor_rows || 0),
      insertedMaterialRows: Number(args.file.inserted_material_rows || 0),
      insertedLaborRows: Number(args.file.inserted_labor_rows || 0),
      mh_material: 0,
      mh_direct: 0,
      mh_indirect: 0,
      warnings: [],
      distinctRowDates: [],
      ingestStatus: INSTALLATION_INGEST_STATUS.ready,
    };
  }

  await markFileStatus(args.admin, args.file.id, {
    ingest_status: INSTALLATION_INGEST_STATUS.processing,
    processing_started_at: nowIso,
    processing_finished_at: null,
    last_retry_at: args.force ? nowIso : null,
    parse_error: null,
    last_error: null,
  });

  try {
    const bucket = String(args.file.bucket_id || process.env.SUPABASE_STORAGE_BUCKET || "imports").trim();
    const download = await args.admin.storage.from(bucket).download(args.file.storage_path);
    if (download.error || !download.data) {
      throw new Error(`Storage download failed: ${download.error?.message || "unknown"}`);
    }

    const workbook = XLSX.read(Buffer.from(await download.data.arrayBuffer()), {
      type: "buffer",
      raw: true,
      cellDates: true,
    });

    const materialParsed = parseMaterialSheet(workbook);
    const laborParsed = parseLaborSheet(workbook);
    const mhTotal = laborParsed.mhDirect + laborParsed.mhIndirect;
    const efficiencyPct = laborParsed.mhDirect > 0 ? clampEfficiency((materialParsed.mhMaterial / laborParsed.mhDirect) * 100) : 0;

    const installationDirectNames = laborParsed.rows
      .filter((row) => (row.hoursDirect || 0) > 0)
      .map((row) => normalizePersonName(row.fullName))
      .filter(Boolean);
    const attendanceDirectElectricalNames = await parseAttendanceNames({
      admin: args.admin,
      projectCode: args.file.project_code,
      workDate: args.file.work_date,
    });

    const instSet = new Set(installationDirectNames);
    const attSet = new Set(attendanceDirectElectricalNames);
    const attendanceMatchOk =
      installationDirectNames.length === attendanceDirectElectricalNames.length &&
      Array.from(instSet).every((name) => attSet.has(name)) &&
      Array.from(attSet).every((name) => instSet.has(name));

    const warnings = buildWarnings({
      file: args.file,
      workDate: args.file.work_date,
      materialDates: materialParsed.dates,
      laborDates: laborParsed.dates,
      mhMaterial: materialParsed.mhMaterial,
      mhDirect: laborParsed.mhDirect,
      attendanceMatchOk,
      installationDirectNames,
      attendanceDirectElectricalNames,
    });

    const distinctRowDates = distinctIsoDates([...materialParsed.dates, ...laborParsed.dates]);
    const mhMatchOk = Math.abs(materialParsed.mhMaterial - laborParsed.mhDirect) <= 0.5;
    const dateOk = distinctRowDates.length === 0 || distinctRowDates.every((d) => d === args.file.work_date);

    const delMaterial = await args.admin.from("field_installation_rows").delete().eq("source_file_id", args.file.id);
    if (delMaterial.error) throw new Error(delMaterial.error.message);
    const delLabor = await args.admin.from("field_installation_labor_rows").delete().eq("source_file_id", args.file.id);
    if (delLabor.error) throw new Error(delLabor.error.message);

    const materialPayload = materialParsed.rows.map((row) => ({
      project_code: args.file.project_code,
      work_date: args.file.work_date,
      report_date: args.file.work_date,
      source_file_id: args.file.id,
      row_no: row.rowNo,
      zone: row.zone,
      floor: row.floor,
      budget_code: row.budgetCode,
      activity_code: null,
      description: row.description,
      unit: row.unit,
      qty: row.qty,
      manhours: row.manhours,
      team_no: numberFromUnknown(row.teamNo),
      elevation: row.elevation,
      install_action: row.installAction,
      location: row.location,
      project_name: row.projectName,
      orientation: row.orientation,
      comment: row.comment,
      crew: numberFromUnknown(row.teamNo),
      raw: row.raw,
    }));

    let insertedMaterialRows = 0;
    for (let i = 0; i < materialPayload.length; i += 500) {
      const chunk = materialPayload.slice(i, i + 500);
      if (!chunk.length) continue;
      const ins = await args.admin.from("field_installation_rows").insert(chunk);
      if (ins.error) throw new Error(ins.error.message);
      insertedMaterialRows += chunk.length;
    }

    const laborPayload = laborParsed.rows.map((row) => ({
      project_code: args.file.project_code,
      work_date: args.file.work_date,
      source_file_id: args.file.id,
      team_no: row.teamNo,
      employee_id: row.employeeId,
      full_name: row.fullName,
      title: row.title,
      hours_indirect: row.hoursIndirect,
      hours_direct: row.hoursDirect,
      raw: row.raw,
    }));

    let insertedLaborRows = 0;
    for (let i = 0; i < laborPayload.length; i += 500) {
      const chunk = laborPayload.slice(i, i + 500);
      if (!chunk.length) continue;
      const ins = await args.admin.from("field_installation_labor_rows").insert(chunk);
      if (ins.error) throw new Error(ins.error.message);
      insertedLaborRows += chunk.length;
    }

    const summary = await args.admin.from("field_installation_day_summary").upsert(
      {
        project_code: args.file.project_code,
        work_date: args.file.work_date,
        source_file_id: args.file.id,
        mh_material: materialParsed.mhMaterial,
        mh_direct: laborParsed.mhDirect,
        mh_indirect: laborParsed.mhIndirect,
        mh_total: mhTotal,
        date_ok: dateOk,
        mh_match_ok: mhMatchOk,
        attendance_match_ok: attendanceMatchOk,
        efficiency_pct: efficiencyPct,
        warnings,
      },
      { onConflict: "project_code,work_date" }
    );
    if (summary.error) throw new Error(summary.error.message);

    const finishedIso = new Date().toISOString();
    const audit = buildIngestionAudit({
      warnings,
      distinctRowDates,
      parsedMaterialRows: materialParsed.rows.length,
      parsedLaborRows: laborParsed.rows.length,
      insertedMaterialRows,
      insertedLaborRows,
    });
    await markFileStatus(args.admin, args.file.id, {
      ingest_status: audit.ingestStatus,
      parse_error: audit.parseError,
      last_error: null,
      processing_finished_at: finishedIso,
      processed_at: finishedIso,
      parser_version: FIELD_INSTALLATION_PARSER_VERSION,
      warning_count: audit.warningCount,
      parsed_material_rows: audit.parsedMaterialRows,
      parsed_labor_rows: audit.parsedLaborRows,
      inserted_material_rows: audit.insertedMaterialRows,
      inserted_labor_rows: audit.insertedLaborRows,
      rows_count: insertedMaterialRows,
      distinct_row_dates: audit.distinctRowDates,
    });

    return {
      fileId: args.file.id,
      parsedMaterialRows: materialParsed.rows.length,
      parsedLaborRows: laborParsed.rows.length,
      insertedMaterialRows,
      insertedLaborRows,
      mh_material: materialParsed.mhMaterial,
      mh_direct: laborParsed.mhDirect,
      mh_indirect: laborParsed.mhIndirect,
      warnings,
      distinctRowDates,
      ingestStatus: INSTALLATION_INGEST_STATUS.ready,
    };
  } catch (error) {
    const failedIso = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Ingestion failed.";
    const audit = buildIngestionAudit({ error: message });
    await markFileStatus(args.admin, args.file.id, {
      ingest_status: audit.ingestStatus,
      parse_error: audit.parseError,
      last_error: audit.parseError,
      processing_finished_at: failedIso,
      processed_at: failedIso,
      parser_version: FIELD_INSTALLATION_PARSER_VERSION,
    });
    throw error;
  }
}

export async function importFieldInstallationSourceFile(args: {
  admin: SupabaseClient;
  fileId: string;
  force?: boolean;
}): Promise<FieldInstallationImportResult> {
  const file = await getFileById(args.admin, args.fileId);
  return processFile({ admin: args.admin, file, force: args.force ?? false });
}

export async function importFieldInstallationDay(args: {
  admin: SupabaseClient;
  projectCode: string;
  workDate: string;
  force?: boolean;
}): Promise<FieldInstallationImportResult> {
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || "imports").trim();
  const file = await findFileMeta({
    admin: args.admin,
    projectCode: args.projectCode,
    workDate: args.workDate,
    bucket,
  });

  if (!file) {
    throw new Error(`No installation file found for ${args.projectCode} ${args.workDate}.`);
  }

  return processFile({ admin: args.admin, file, force: args.force ?? false });
}
