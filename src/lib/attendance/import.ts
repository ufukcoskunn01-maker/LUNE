import crypto from "crypto";
import ExcelJS from "exceljs";
import { uploadFile } from "@/features/files/uploadFile";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Segment = "Indirect" | "Direct" | "Mobilization";
type Discipline = "Electrical" | "Mechanical" | "Shared";

export type AttendanceImportInput = {
  projectCode: string;
  workDate: string;
  sourcePath?: string;
  fileBuffer?: Buffer;
  fileName?: string;
};

export type AttendanceImportResult = {
  jobId: string;
  fileId: string;
  parsedRows: number;
  upsertedRows: number;
  duplicatesRemoved: number;
  storagePath: string;
};

type AttendanceUpsertRow = {
  project_id: string;
  work_date: string;
  employee_id: string;
  full_name: string;
  segment: Segment;
  discipline: Discipline;
  profession_actual: string | null;
  profession_official: string | null;
  profession_grouped: string | null;
  company: string | null;
  status: "Present" | "Absent";
  absence_reason: string | null;
  remarks: string | null;
  construction_group: string | null;
  source_file_id: string;
};

type AttendanceColumnMap = {
  employeeIdCol: number;
  fullNameCol: number;
  professionOfficialCol: number | null;
  professionActualCol: number | null;
  controlCol: number | null;
  companyCol: number | null;
  remarksCol: number | null;
  constructionGroupCol: number | null;
};

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "imports";
const STORAGE_SUBFOLDER = "1-Daily Personal Reports";
const LOGICAL_NAME = "attendance_daily";
const SYSTEM_FILES_OWNER_ID = process.env.FILES_SYSTEM_OWNER_ID || "00000000-0000-0000-0000-000000000000";

function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "text" in v) {
    const text = (v as { text?: unknown }).text;
    if (text !== null && text !== undefined) return String(text).trim();
  }
  return String(v).trim();
}

function normalizeEmployeeId(v: unknown): string {
  const s = txt(v).replace(/\s+/g, "");
  if (!s) return "";
  const m = s.match(/^(\d+)(?:\.0+)?$/);
  return m ? m[1] : s;
}

function detectSegmentAndDiscipline(marker: string): { segment?: Segment; discipline?: Discipline } {
  const s = marker.toLowerCase();

  let segment: Segment | undefined;
  if (s.includes("инжен") || s.includes("итр")) segment = "Indirect";
  if (s.includes("команд")) segment = "Direct";
  if (s.includes("мобилизац")) segment = "Mobilization";

  let discipline: Discipline | undefined;
  if (s.includes("вис")) discipline = "Shared";
  if (s.includes("ов") || s.includes("вк")) discipline = "Mechanical";
  if (s.includes("эом") || s.includes("сс") || s.includes("элект")) discipline = "Electrical";

  return { segment, discipline };
}

function findHeaderColumn(ws: ExcelJS.Worksheet, patterns: RegExp[]): number | null {
  for (let rowNo = 1; rowNo <= 20; rowNo += 1) {
    const row = ws.getRow(rowNo);
    for (let col = 1; col <= 15; col += 1) {
      const value = txt(row.getCell(col).value).toLowerCase();
      if (!value) continue;
      if (patterns.some((pattern) => pattern.test(value))) return col;
    }
  }
  return null;
}

function detectColumnMap(ws: ExcelJS.Worksheet): AttendanceColumnMap {
  const employeeIdCol = findHeaderColumn(ws, [/табель/i, /personnel/i, /employee/i]);
  const fullNameCol = findHeaderColumn(ws, [/ф\.?\s*и\.?\s*о/i, /full\s*name/i, /name/i]);
  const professionOfficialCol = findHeaderColumn(ws, [/должност/i, /profession/i, /position/i]);
  const controlCol = findHeaderColumn(ws, [/контрол/i, /control/i, /absence/i]);
  const remarksCol = findHeaderColumn(ws, [/прим/i, /remark/i, /note/i]);

  return {
    employeeIdCol: employeeIdCol ?? 4,
    fullNameCol: fullNameCol ?? 8,
    professionOfficialCol: professionOfficialCol ?? 7,
    professionActualCol: professionOfficialCol ? Math.max(1, professionOfficialCol - 1) : 6,
    controlCol: controlCol ?? 9,
    companyCol: 10,
    remarksCol: remarksCol ?? 11,
    constructionGroupCol: 12,
  };
}

function isProbablyPersonRow(row: ExcelJS.Row, columns: AttendanceColumnMap): boolean {
  const emp = normalizeEmployeeId(row.getCell(columns.employeeIdCol).value);
  const name = txt(row.getCell(columns.fullNameCol).value);
  return !!emp && name.length >= 3 && name.toLowerCase() !== "ф.и.о";
}

function monthFolder(iso: string): string {
  const [y, m] = iso.split("-");
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
  return `${y}/${m}-${names[Number(m) - 1]}`;
}

function yymmdd(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y.slice(2)}${m}${d}`;
}

function normalizeSourcePath(rawPath: string, bucket: string): string {
  const cleaned = rawPath.replace(/^\/+/, "");
  if (cleaned.startsWith(`${bucket}/`)) return cleaned.slice(bucket.length + 1);
  if (cleaned.startsWith("imports/")) return cleaned.slice("imports/".length);
  if (cleaned.startsWith("import/")) return cleaned.slice("import/".length);
  return cleaned;
}

function basenameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || "daily-personal-report.xlsx";
}

export async function runAttendanceImport(input: AttendanceImportInput): Promise<AttendanceImportResult> {
  const sb = supabaseAdmin();
  const sourcePathInput = input.sourcePath ? input.sourcePath.trim() : "";
  const hasFile = Boolean(input.fileBuffer && input.fileName);

  if (!input.projectCode) throw new Error("projectCode required");
  if (!input.workDate) throw new Error("workDate required (YYYY-MM-DD)");
  if (!hasFile && !sourcePathInput) throw new Error("fileBuffer+fileName or sourcePath required");

  const { data: proj, error: projErr } = await sb
    .from("projects")
    .select("id,code")
    .eq("code", input.projectCode)
    .maybeSingle();
  if (projErr) throw new Error(projErr.message);
  if (!proj) throw new Error(`Project not found: ${input.projectCode}`);

  const requestFilename = hasFile ? String(input.fileName) : basenameFromPath(sourcePathInput);
  const jobStartedAt = new Date().toISOString();

  const { data: jobRow, error: jobErr } = await sb
    .from("import_jobs")
    .insert({
      project_id: proj.id,
      type: "import-attendance",
      status: "running",
      started_at: jobStartedAt,
      log: [{ t: jobStartedAt, msg: "Job started" }],
      request_meta: {
        projectCode: input.projectCode,
        workDate: input.workDate,
        filename: requestFilename,
        sourcePath: sourcePathInput || null,
      },
    })
    .select("id")
    .single();
  if (jobErr) throw new Error(jobErr.message);
  const jobId = String(jobRow.id);

  try {
    let buffer: Buffer;
    let originalFilename = requestFilename;
    let storagePath = "";

    if (hasFile) {
      buffer = input.fileBuffer as Buffer;
      storagePath = `${input.projectCode}/${STORAGE_SUBFOLDER}/${monthFolder(input.workDate)}/${input.projectCode}-E-IN-${yymmdd(input.workDate)}_rev00.xlsx`;

      await uploadFile({
        supabase: sb,
        ownerId: SYSTEM_FILES_OWNER_ID,
        bucket: STORAGE_BUCKET,
        path: storagePath,
        data: buffer,
        fileName: input.fileName || `${input.projectCode}-attendance.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
        entityType: "attendance_daily",
        entityId: `${input.projectCode}:${input.workDate}`,
        metadata: {
          projectCode: input.projectCode,
          workDate: input.workDate,
          logicalName: LOGICAL_NAME,
        },
      });
    } else {
      storagePath = normalizeSourcePath(sourcePathInput, STORAGE_BUCKET);
      originalFilename = basenameFromPath(storagePath);
      const { data: blob, error: downloadErr } = await sb.storage.from(STORAGE_BUCKET).download(storagePath);
      if (downloadErr || !blob) {
        throw new Error(`Storage download failed for ${storagePath}: ${downloadErr?.message ?? "unknown error"}`);
      }
      const ab = await blob.arrayBuffer();
      buffer = Buffer.from(new Uint8Array(ab));
    }

    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    let fileId = "";

    const { data: existingFile, error: existingFileErr } = await sb
      .from("files")
      .select("id")
      .eq("project_id", proj.id)
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (existingFileErr) throw new Error(`files lookup failed: ${existingFileErr.message}`);

    if (existingFile?.id) {
      fileId = String(existingFile.id);
      const { error: updateFileErr } = await sb
        .from("files")
        .update({
          original_filename: originalFilename,
          checksum_sha256: checksum,
          byte_size: buffer.length,
          meta: { workDate: input.workDate, sheet: "ЕЖЕДНЕВНЫЙ ОТЧЕТ" },
        })
        .eq("id", fileId);
      if (updateFileErr) throw new Error(`files update failed: ${updateFileErr.message}`);
    } else {
      const { data: lastFile } = await sb
        .from("files")
        .select("revision")
        .eq("project_id", proj.id)
        .eq("type", "import")
        .eq("logical_name", LOGICAL_NAME)
        .order("revision", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextRev = (lastFile?.revision ?? 0) + 1;

      const { data: fileRow, error: fileErr } = await sb
        .from("files")
        .insert({
          project_id: proj.id,
          type: "import",
          logical_name: LOGICAL_NAME,
          revision: nextRev,
          storage_path: storagePath,
          original_filename: originalFilename,
          checksum_sha256: checksum,
          byte_size: buffer.length,
          meta: { workDate: input.workDate, sheet: "ЕЖЕДНЕВНЫЙ ОТЧЕТ" },
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (fileErr) throw new Error(`files insert failed: ${fileErr.message}`);
      fileId = String(fileRow.id);
    }

    await sb.from("import_jobs").update({ file_id: fileId }).eq("id", jobId);

    const wb = new ExcelJS.Workbook();
    type WorkbookLoadInput = Parameters<typeof wb.xlsx.load>[0];
    await wb.xlsx.load(buffer as unknown as WorkbookLoadInput);

    const ws = wb.getWorksheet("ЕЖЕДНЕВНЫЙ ОТЧЕТ") || wb.getWorksheet("РАСХОД ЕЖЕДНЕВНЫЙ") || wb.worksheets?.[0];
    if (!ws) throw new Error("No worksheet found in workbook.");

    const columns = detectColumnMap(ws);
    let currentSegment: Segment = "Indirect";
    let currentDiscipline: Discipline = "Electrical";
    const rowsToUpsert: AttendanceUpsertRow[] = [];

    ws.eachRow({ includeEmpty: false }, (row) => {
      const marker = [1, 2, 3, 4, 5, 6].map((col) => txt(row.getCell(col).value)).filter(Boolean).join(" ");
      if (marker) {
        const det = detectSegmentAndDiscipline(marker);
        if (det.segment) currentSegment = det.segment;
        if (det.discipline) currentDiscipline = det.discipline;
      }

      if (!isProbablyPersonRow(row, columns)) return;
      const employeeId = normalizeEmployeeId(row.getCell(columns.employeeIdCol).value);
      if (!employeeId) return;

      const fullName = txt(row.getCell(columns.fullNameCol).value);
      if (!fullName) return;

      const professionOfficial = columns.professionOfficialCol ? txt(row.getCell(columns.professionOfficialCol).value) : "";
      const professionActual = columns.professionActualCol ? txt(row.getCell(columns.professionActualCol).value) : "";
      const control = columns.controlCol ? txt(row.getCell(columns.controlCol).value) : "";
      const company = columns.companyCol ? txt(row.getCell(columns.companyCol).value) : "";
      const remarks = columns.remarksCol ? txt(row.getCell(columns.remarksCol).value) : "";
      const constructionGroup = columns.constructionGroupCol ? txt(row.getCell(columns.constructionGroupCol).value) : "";
      const derivedGroup = constructionGroup || marker;
      const status: "Present" | "Absent" = control ? "Absent" : "Present";
      const professionGrouped = professionOfficial || professionActual;

      rowsToUpsert.push({
        project_id: proj.id,
        work_date: input.workDate,
        employee_id: employeeId,
        full_name: fullName,
        segment: currentSegment,
        discipline: currentDiscipline,
        profession_actual: professionActual || null,
        profession_official: professionOfficial || null,
        profession_grouped: professionGrouped || null,
        company: company || null,
        status,
        absence_reason: control || null,
        remarks: remarks || null,
        construction_group: derivedGroup || null,
        source_file_id: fileId,
      });
    });

    const dedupeMap = new Map<string, AttendanceUpsertRow>();
    let duplicatesRemoved = 0;
    for (const row of rowsToUpsert) {
      const key = `${row.project_id}|${row.work_date}|${row.employee_id}`;
      if (dedupeMap.has(key)) duplicatesRemoved += 1;
      dedupeMap.set(key, row);
    }
    const dedupedRows = Array.from(dedupeMap.values());

    let inserted = 0;
    for (let i = 0; i < dedupedRows.length; i += 500) {
      const chunk = dedupedRows.slice(i, i + 500);
      const { error } = await sb.from("attendance_records").upsert(chunk, {
        onConflict: "project_id,work_date,employee_id",
      });
      if (error) throw new Error(`attendance upsert failed: ${error.message}`);
      inserted += chunk.length;
    }

    const finished = new Date().toISOString();
    await sb
      .from("import_jobs")
      .update({
        status: "succeeded",
        finished_at: finished,
        log: [
          { t: finished, msg: "Job succeeded" },
          { t: finished, msg: `Parsed rows: ${rowsToUpsert.length}` },
          { t: finished, msg: `Deduped rows: ${dedupedRows.length} (removed ${duplicatesRemoved})` },
        ],
        warnings_count: 0,
        errors_count: 0,
      })
      .eq("id", jobId);

    return {
      jobId,
      fileId,
      parsedRows: rowsToUpsert.length,
      upsertedRows: inserted,
      duplicatesRemoved,
      storagePath,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    await sb
      .from("import_jobs")
      .update({
        status: "failed",
        finished_at: failedAt,
        errors_count: 1,
        log: [{ t: failedAt, msg: "Job failed", error: message }],
      })
      .eq("id", jobId);
    throw error;
  }
}
