import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const PROJECT_CODE = "A27";
const YEAR = "2026";
const MONTH_FOLDER = "01-January";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "imports";
const PREFIX = `${PROJECT_CODE}/2-Daily Field Reports/${YEAR}/${MONTH_FOLDER}`;

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Missing SUPABASE URL or service role key in environment.");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function normalizeText(value) {
  const t = String(value ?? "").replace(/\u00A0/g, " ").trim();
  return t || null;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  let normalized = raw.replace(/\u00A0/g, "").replace(/\s+/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/,/g, ".");
  }
  normalized = normalized.replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d && d.y && d.m && d.d) return `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const t = normalizeText(value);
  if (!t) return null;
  const ymd = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const dmy = t.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
  if (dmy) {
    const y = Number(dmy[3]);
    const yyyy = y < 100 ? 2000 + y : y;
    return `${yyyy}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseRevision(fileName) {
  const m = fileName.match(/(?:_|-)rev(\d{1,3})/i);
  const n = m ? Number(m[1] || 0) : 0;
  return `rev${String(Number.isFinite(n) ? n : 0).padStart(2, "0")}`;
}

function parseWorkDate(fileName) {
  const m = fileName.match(/(\d{6})/);
  if (!m) return null;
  const token = m[1];
  const yy = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const dd = Number(token.slice(4, 6));
  const dt = new Date(Date.UTC(2000 + yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== 2000 + yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  return `${2000 + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function pickSheet(workbook, aliases) {
  const wanted = aliases.map((v) => String(v).toLowerCase());
  for (const name of workbook.SheetNames) {
    const n = String(name).toLowerCase();
    if (wanted.some((w) => n.includes(w))) return workbook.Sheets[name] || null;
  }
  return null;
}

function parseWorkbook(buffer, workDate) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const materialSheet = pickSheet(workbook, ["линия материал", "field material"]);
  const laborSheet = pickSheet(workbook, ["линия чел", "чел.-час", "чел час", "field manhour"]);
  if (!materialSheet) throw new Error("Material sheet not found");
  if (!laborSheet) throw new Error("Labor sheet not found");

  const mat = XLSX.utils.sheet_to_json(materialSheet, { header: 1, raw: true, defval: null, blankrows: false });
  const lab = XLSX.utils.sheet_to_json(laborSheet, { header: 1, raw: true, defval: null, blankrows: false });

  const materialRows = [];
  const laborRows = [];
  const warnings = [];

  let mhMaterial = 0;
  let mhDirect = 0;
  let mhIndirect = 0;
  let dateOk = true;

  for (let r = 3, rowNo = 1; r < mat.length; r += 1) {
    const row = mat[r] || [];
    const description = normalizeText(row[9]);
    const qty = toNumber(row[11]);
    const mh = toNumber(row[12]);
    const rowDate = toIsoDate(row[1]);
    const hasAny = description || qty !== null || mh !== null || normalizeText(row[4]) || normalizeText(row[8]);
    if (!hasAny) continue;

    if (rowDate && rowDate !== workDate) dateOk = false;
    mhMaterial += mh || 0;

    materialRows.push({
      project_code: PROJECT_CODE,
      work_date: workDate,
      report_date: workDate,
      row_no: rowNo,
      zone: normalizeText(row[4]),
      floor: normalizeText(row[5]),
      budget_code: normalizeText(row[8]),
      activity_code: normalizeText(row[8]),
      description,
      unit: normalizeText(row[10]),
      qty,
      manhours: mh,
      team_no: toNumber(row[7]),
      elevation: normalizeText(row[6]),
      install_action: normalizeText(row[2]),
      location: normalizeText(row[3]),
      project_name: normalizeText(row[13]),
      orientation: normalizeText(row[14]),
      comment: normalizeText(row[15]),
      crew: toNumber(row[7]),
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
    rowNo += 1;
  }

  for (let r = 2; r < lab.length; r += 1) {
    const row = lab[r] || [];
    const employeeId = normalizeText(row[3]);
    const fullName = normalizeText(row[4]);
    const hIn = toNumber(row[6]);
    const hDir = toNumber(row[7]);
    const rowDate = toIsoDate(row[1]);
    const hasAny = employeeId || fullName || hIn !== null || hDir !== null;
    if (!hasAny) continue;

    if (rowDate && rowDate !== workDate) dateOk = false;
    mhIndirect += hIn || 0;
    mhDirect += hDir || 0;

    laborRows.push({
      project_code: PROJECT_CODE,
      work_date: workDate,
      team_no: normalizeText(row[2]),
      employee_id: employeeId,
      full_name: fullName,
      title: normalizeText(row[5]),
      hours_indirect: hIn,
      hours_direct: hDir,
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

  const mhTotal = mhDirect + mhIndirect;
  const mhMatchOk = Math.abs(mhMaterial - mhTotal) <= 0.01;
  const efficiencyPct = mhTotal > 0 ? Math.max(0, Math.min(100, (mhMaterial / mhTotal) * 100)) : 0;
  if (!dateOk) warnings.push({ code: "sheet_date_mismatch", message: "Some row dates differ from work_date." });
  if (!mhMatchOk) warnings.push({ code: "manhour_mismatch", message: "Material and labor totals differ." });

  return {
    materialRows,
    laborRows,
    summary: {
      mh_material: Number(mhMaterial.toFixed(3)),
      mh_direct: Number(mhDirect.toFixed(3)),
      mh_indirect: Number(mhIndirect.toFixed(3)),
      mh_total: Number(mhTotal.toFixed(3)),
      date_ok: dateOk,
      mh_match_ok: mhMatchOk,
      attendance_match_ok: true,
      efficiency_pct: Number(efficiencyPct.toFixed(2)),
      warnings,
    },
  };
}

async function listFiles(prefix) {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const res = await admin.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (res.error) throw new Error(res.error.message);
    const rows = res.data || [];
    out.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return out
    .map((r) => String(r.name || "").trim())
    .filter(Boolean)
    .filter((name) => /\.xls[xm]?$/i.test(name));
}

async function ingestFile(fileName) {
  const workDate = parseWorkDate(fileName);
  if (!workDate) return { status: "skipped", fileName, reason: "date_parse_failed" };

  const storagePath = `${PREFIX}/${fileName}`;
  const upsert = await admin
    .from("field_installation_files")
    .upsert(
      {
        project_code: PROJECT_CODE,
        work_date: workDate,
        bucket_id: BUCKET,
        storage_path: storagePath,
        file_name: fileName,
        file_kind: "installation",
        revision: parseRevision(fileName),
        source_created_at: new Date().toISOString(),
      },
      { onConflict: "bucket_id,storage_path" }
    )
    .select("id,project_code,work_date")
    .single();

  if (upsert.error || !upsert.data) throw new Error(`file upsert failed for ${fileName}: ${upsert.error?.message || "unknown"}`);
  const fileId = upsert.data.id;

  const dl = await admin.storage.from(BUCKET).download(storagePath);
  if (dl.error || !dl.data) throw new Error(`download failed for ${fileName}: ${dl.error?.message || "unknown"}`);

  const parsed = parseWorkbook(Buffer.from(await dl.data.arrayBuffer()), workDate);

  const delRows = await admin.from("field_installation_rows").delete().eq("source_file_id", fileId);
  if (delRows.error) throw new Error(`delete rows failed for ${fileName}: ${delRows.error.message}`);
  const delLabor = await admin.from("field_installation_labor_rows").delete().eq("source_file_id", fileId);
  if (delLabor.error) throw new Error(`delete labor failed for ${fileName}: ${delLabor.error.message}`);

  const materialPayload = parsed.materialRows.map((r) => ({ ...r, source_file_id: fileId }));
  for (let i = 0; i < materialPayload.length; i += 500) {
    const chunk = materialPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await admin.from("field_installation_rows").insert(chunk);
    if (ins.error) throw new Error(`insert rows failed for ${fileName}: ${ins.error.message}`);
  }

  const laborPayload = parsed.laborRows.map((r) => ({ ...r, source_file_id: fileId }));
  for (let i = 0; i < laborPayload.length; i += 500) {
    const chunk = laborPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await admin.from("field_installation_labor_rows").insert(chunk);
    if (ins.error) throw new Error(`insert labor failed for ${fileName}: ${ins.error.message}`);
  }

  const sum = await admin.from("field_installation_day_summary").upsert(
    {
      project_code: PROJECT_CODE,
      work_date: workDate,
      source_file_id: fileId,
      mh_material: parsed.summary.mh_material,
      mh_direct: parsed.summary.mh_direct,
      mh_indirect: parsed.summary.mh_indirect,
      mh_total: parsed.summary.mh_total,
      date_ok: parsed.summary.date_ok,
      mh_match_ok: parsed.summary.mh_match_ok,
      attendance_match_ok: parsed.summary.attendance_match_ok,
      efficiency_pct: parsed.summary.efficiency_pct,
      warnings: parsed.summary.warnings,
    },
    { onConflict: "project_code,work_date" }
  );
  if (sum.error) throw new Error(`summary upsert failed for ${fileName}: ${sum.error.message}`);

  return {
    status: "ingested",
    fileName,
    workDate,
    fileId,
    rows: materialPayload.length,
    labor: laborPayload.length,
  };
}

async function main() {
  const files = await listFiles(PREFIX);
  const results = [];
  for (const file of files) {
    try {
      const result = await ingestFile(file);
      results.push(result);
    } catch (error) {
      results.push({ status: "failed", fileName: file, reason: error instanceof Error ? error.message : "unknown" });
    }
  }

  const ingested = results.filter((r) => r.status === "ingested").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log(JSON.stringify({ ok: true, prefix: PREFIX, bucket: BUCKET, scanned: files.length, ingested, skipped, failed, results }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "unknown" }, null, 2));
  process.exit(1);
});
