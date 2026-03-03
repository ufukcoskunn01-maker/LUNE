import path from "path";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clampEfficiency, numberFromUnknown, parseInstallationFileMeta } from "@/lib/field-installation/utils";

type StorageItem = { name?: string | null; metadata?: Record<string, unknown> | null };

type InstallationFileMeta = {
  id: string;
  project_code: string;
  work_date: string;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  file_kind: string | null;
  revision: string | null;
  updated_at?: string | null;
};

type MaterialParsedRow = {
  rowDate: string | null;
  teamNo: string | null;
  zone: string | null;
  floor: string | null;
  budgetCode: string | null;
  description: string | null;
  unit: string | null;
  qty: number | null;
  manhours: number | null;
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

type WarningItem = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
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
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
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

function findMaterialDataStart(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 12); i += 1) {
    const row = matrix[i] || [];
    const a = String(row[0] ?? "").toLowerCase();
    const b = String(row[1] ?? "").toLowerCase();
    const j = String(row[9] ?? "").toLowerCase();
    const m = String(row[12] ?? "").toLowerCase();
    const looksLikeHeader =
      (a.includes("№") || a.includes("п/п")) &&
      b.includes("дата") &&
      (j.includes("наименование") || j.includes("материал")) &&
      (m.includes("чел") || m.includes("час"));
    if (looksLikeHeader) return i + 1;
  }
  return 3;
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

function parseMaterialSheet(workbook: XLSX.WorkBook, targetWorkDate?: string): { rows: MaterialParsedRow[]; dates: string[]; mhMaterial: number } {
  const ws = pickSheet(workbook, ["ЛИНИЯ Материал", "Field Material"]);
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true }) as unknown[][];
  const rows: MaterialParsedRow[] = [];
  const dates: string[] = [];
  let mhMaterial = 0;
  const dataStart = findMaterialDataStart(matrix);

  for (let i = dataStart; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const rowDate = toIsoDate(row[1]);
    const teamNo = normalizeText(row[7]);
    const budgetCode = normalizeText(row[8]);
    const description = normalizeText(row[9]);
    const qty = numberFromUnknown(row[11]);
    const manhours = numberFromUnknown(row[12]);
    const hasNumericWork = qty !== null || manhours !== null;
    const hasBudgetLikeCode = Boolean(budgetCode && /\d/.test(budgetCode));
    if (!(description && (hasNumericWork || hasBudgetLikeCode))) {
      continue;
    }

    if (rowDate) dates.push(rowDate);
    if (!rowDate) continue;
    if (targetWorkDate && rowDate !== targetWorkDate) continue;
    mhMaterial += manhours ?? 0;
    rows.push({
      rowDate,
      teamNo,
      zone: normalizeText(row[4]),
      floor: normalizeText(row[5]),
      budgetCode,
      description,
      unit: normalizeText(row[10]),
      qty,
      manhours,
      raw: {
        line_no: row[0] ?? null,
        report_date: row[1] ?? null,
        install_or_remove: row[2] ?? null,
        location: row[3] ?? null,
        zone: row[4] ?? null,
        floor: row[5] ?? null,
        elevation: row[6] ?? null,
        team_no: row[7] ?? null,
        budget_code: row[8] ?? null,
        description: row[9] ?? null,
        unit: row[10] ?? null,
        qty: row[11] ?? null,
        manhours: row[12] ?? null,
        project_name: row[13] ?? null,
        orientation: row[14] ?? null,
        comment: row[15] ?? null,
      },
    });
  }

  return { rows, dates, mhMaterial };
}

function parseLaborSheet(workbook: XLSX.WorkBook, targetWorkDate?: string): { rows: LaborParsedRow[]; dates: string[]; mhDirect: number; mhIndirect: number } {
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

    if (!((employeeId || fullName) && (hoursIndirect !== null || hoursDirect !== null))) {
      continue;
    }

    if (rowDate) dates.push(rowDate);
    if (!rowDate) continue;
    if (targetWorkDate && rowDate !== targetWorkDate) continue;

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
        source_created_at: new Date().toISOString(),
      },
      { onConflict: "bucket_id,storage_path" }
    )
    .select("id,project_code,work_date,bucket_id,storage_path,file_name,file_kind,revision,updated_at")
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
    .select("id,project_code,work_date,bucket_id,storage_path,file_name,file_kind,revision,updated_at")
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

export async function importFieldInstallationDay(args: {
  admin: SupabaseClient;
  projectCode: string;
  workDate: string;
}): Promise<{
  fileId: string;
  parsedMaterialRows: number;
  parsedLaborRows: number;
  mh_material: number;
  mh_direct: number;
  mh_indirect: number;
  warnings: WarningItem[];
}> {
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

  const download = await args.admin.storage.from(file.bucket_id || bucket).download(file.storage_path);
  if (download.error || !download.data) {
    throw new Error(`Storage download failed: ${download.error?.message || "unknown"}`);
  }

  const workbook = XLSX.read(Buffer.from(await download.data.arrayBuffer()), {
    type: "buffer",
    raw: true,
    cellDates: true,
  });
  const materialParsed = parseMaterialSheet(workbook, args.workDate);
  const laborParsed = parseLaborSheet(workbook, args.workDate);
  const mhTotal = laborParsed.mhDirect + laborParsed.mhIndirect;
  const mhMatchOk = Math.abs(materialParsed.mhMaterial - laborParsed.mhDirect) <= 0.5;
  const efficiencyPct = laborParsed.mhDirect > 0 ? clampEfficiency((materialParsed.mhMaterial / laborParsed.mhDirect) * 100) : 0;

  const warnings: WarningItem[] = [];
  const fromNameDate = parseInstallationFileMeta(path.basename(file.file_name || file.storage_path || ""))?.workDate || null;
  if (fromNameDate && fromNameDate !== args.workDate) {
    warnings.push({
      code: "filename_date_mismatch",
      message: "Filename date does not match requested work date.",
      details: { expected: args.workDate, filenameDate: fromNameDate },
    });
  }

  const allSheetDates = [...materialParsed.dates, ...laborParsed.dates].filter(Boolean);
  const mismatchedDates = allSheetDates.filter((date) => date !== args.workDate);
  const dateOk = mismatchedDates.length === 0;
  if (!dateOk) {
    warnings.push({
      code: "sheet_date_mismatch",
      message: "Some row dates differ from the selected work date.",
      details: { expected: args.workDate, mismatchedCount: mismatchedDates.length, samples: mismatchedDates.slice(0, 5) },
    });
  }

  if (!mhMatchOk) {
    warnings.push({
      code: "manhour_mismatch",
      message: "Material manhours and direct personnel hours are not aligned.",
      details: { mh_material: materialParsed.mhMaterial, mh_direct: laborParsed.mhDirect, tolerance: 0.5 },
    });
  }

  // Condition #2: Installation direct personnel list vs Daily Personal Reports (Direct + Electrical)
  const installationDirectNames = laborParsed.rows
    .filter((row) => (row.hoursDirect || 0) > 0)
    .map((row) => normalizePersonName(row.fullName))
    .filter(Boolean);

  const { data: projectRow, error: projectErr } = await args.admin
    .from("projects")
    .select("id")
    .eq("code", args.projectCode)
    .maybeSingle();
  if (projectErr) throw new Error(projectErr.message);

  let attendanceDirectElectricalNames: string[] = [];
  if (projectRow?.id) {
    const attendanceRes = await args.admin
      .from("attendance_records")
      .select("full_name")
      .eq("project_id", projectRow.id)
      .eq("work_date", args.workDate)
      .eq("segment", "Direct")
      .eq("discipline", "Electrical")
      .eq("status", "Present");
    if (attendanceRes.error) throw new Error(attendanceRes.error.message);
    attendanceDirectElectricalNames = (attendanceRes.data || [])
      .map((row) => normalizePersonName((row as { full_name?: string | null }).full_name))
      .filter(Boolean);
  }

  const instSet = new Set(installationDirectNames);
  const attSet = new Set(attendanceDirectElectricalNames);
  const missingInAttendance = Array.from(instSet).filter((name) => !attSet.has(name));
  const missingInInstallation = Array.from(attSet).filter((name) => !instSet.has(name));
  const attendanceMatchOk =
    installationDirectNames.length === attendanceDirectElectricalNames.length &&
    missingInAttendance.length === 0 &&
    missingInInstallation.length === 0;

  if (!attendanceMatchOk) {
    warnings.push({
      code: "direct_personnel_mismatch",
      message: "Direct personnel list mismatch between Installation report and Daily Personal Reports (Electrical-Direct).",
      details: {
        installation_direct_count: installationDirectNames.length,
        personal_electrical_direct_count: attendanceDirectElectricalNames.length,
        missing_in_personal: missingInAttendance,
        missing_in_installation: missingInInstallation,
      },
    });
  }

  const delMaterial = await args.admin.from("field_installation_rows").delete().eq("source_file_id", file.id);
  if (delMaterial.error) throw new Error(delMaterial.error.message);
  const delLabor = await args.admin.from("field_installation_labor_rows").delete().eq("source_file_id", file.id);
  if (delLabor.error) throw new Error(delLabor.error.message);

  const materialPayload = materialParsed.rows.map((row) => ({
    project_code: args.projectCode,
    work_date: args.workDate,
    report_date: args.workDate,
    source_file_id: file.id,
    zone: row.zone,
    floor: row.floor,
    budget_code: row.budgetCode,
    activity_code: null,
    description: row.description,
    unit: row.unit,
    qty: row.qty,
    crew: numberFromUnknown(row.teamNo),
    raw: row.raw,
  }));

  for (let i = 0; i < materialPayload.length; i += 500) {
    const chunk = materialPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await args.admin.from("field_installation_rows").insert(chunk);
    if (ins.error) throw new Error(ins.error.message);
  }

  const laborPayload = laborParsed.rows.map((row) => ({
    project_code: args.projectCode,
    work_date: args.workDate,
    source_file_id: file.id,
    team_no: row.teamNo,
    employee_id: row.employeeId,
    full_name: row.fullName,
    title: row.title,
    hours_indirect: row.hoursIndirect,
    hours_direct: row.hoursDirect,
    raw: row.raw,
  }));

  for (let i = 0; i < laborPayload.length; i += 500) {
    const chunk = laborPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await args.admin.from("field_installation_labor_rows").insert(chunk);
    if (ins.error) throw new Error(ins.error.message);
  }

  const summary = await args.admin.from("field_installation_day_summary").upsert(
    {
      project_code: args.projectCode,
      work_date: args.workDate,
      source_file_id: file.id,
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

  return {
    fileId: file.id,
    parsedMaterialRows: materialParsed.rows.length,
    parsedLaborRows: laborParsed.rows.length,
    mh_material: materialParsed.mhMaterial,
    mh_direct: laborParsed.mhDirect,
    mh_indirect: laborParsed.mhIndirect,
    warnings,
  };
}
