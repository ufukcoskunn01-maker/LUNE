import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing SUPABASE URL or service key");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const targets = [
  { id: "9265d19a-af80-4a97-b5aa-892fd781c10f", workDate: "2025-08-05", revision: "00" },
  { id: "c74e1c6e-fb4b-4df4-b966-d82351fd9e5b", workDate: "2025-08-11", revision: "01" },
];

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
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    else normalized = normalized.replace(/,/g, "");
  } else if (hasComma) normalized = normalized.replace(/,/g, ".");
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
  const t = String(value ?? "").trim();
  if (!t) return null;
  const dmy = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const yy = Number(dmy[3]);
    const y = yy < 100 ? 2000 + yy : yy;
    return `${y}-${String(Number(dmy[2])).padStart(2, "0")}-${String(Number(dmy[1])).padStart(2, "0")}`;
  }
  const ymd = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${String(Number(ymd[2])).padStart(2, "0")}-${String(Number(ymd[3])).padStart(2, "0")}`;
  return null;
}

function findSheet(workbook, aliases) {
  const wanted = aliases.map((v) => String(v).toLowerCase());
  for (const name of workbook.SheetNames) {
    const n = String(name).toLowerCase();
    if (wanted.some((a) => n.includes(a))) return workbook.Sheets[name] || null;
  }
  return null;
}

function parseWorkbook(buffer, projectCode, workDate) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const materialSheet = findSheet(workbook, ["линия материал", "field material", "линлия материал"]);
  const laborSheet = findSheet(workbook, ["линия чел", "чел.-час", "чел час", "field manhour", "линлия работа"]);
  if (!materialSheet) throw new Error("Material sheet not found");
  if (!laborSheet) throw new Error("Labor sheet not found");

  const mat = XLSX.utils.sheet_to_json(materialSheet, { header: 1, raw: true, defval: null, blankrows: false });
  const lab = XLSX.utils.sheet_to_json(laborSheet, { header: 1, raw: true, defval: null, blankrows: false });

  const materialRows = [];
  const laborRows = [];

  let mhMaterial = 0;
  let mhDirect = 0;
  let mhIndirect = 0;
  let dateOk = true;

  let rowNo = 1;
  for (let r = 3; r < mat.length; r += 1) {
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
      project_code: projectCode,
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
      project_code: projectCode,
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
      warnings: [],
    },
  };
}

async function runOne(target) {
  const fileRes = await admin
    .from("field_installation_files")
    .select("id,project_code,work_date,bucket_id,storage_path,file_name")
    .eq("id", target.id)
    .maybeSingle();
  if (fileRes.error || !fileRes.data) throw new Error(`file lookup failed: ${fileRes.error?.message || target.id}`);
  const file = fileRes.data;

  const upd = await admin
    .from("field_installation_files")
    .update({ work_date: target.workDate, revision: target.revision })
    .eq("id", target.id);
  if (upd.error) throw new Error(`file update failed: ${upd.error.message}`);

  const delRows = await admin.from("field_installation_rows").delete().eq("source_file_id", target.id);
  if (delRows.error) throw new Error(`delete rows failed: ${delRows.error.message}`);
  const delLabor = await admin.from("field_installation_labor_rows").delete().eq("source_file_id", target.id);
  if (delLabor.error) throw new Error(`delete labor failed: ${delLabor.error.message}`);
  const delSummary = await admin.from("field_installation_day_summary").delete().eq("source_file_id", target.id);
  if (delSummary.error) throw new Error(`delete summary failed: ${delSummary.error.message}`);

  const bucket = String(file.bucket_id || process.env.SUPABASE_STORAGE_BUCKET || "imports");
  const dl = await admin.storage.from(bucket).download(file.storage_path);
  if (dl.error || !dl.data) throw new Error(`download failed: ${dl.error?.message || "unknown"}`);

  const parsed = parseWorkbook(Buffer.from(await dl.data.arrayBuffer()), String(file.project_code), target.workDate);

  const materialPayload = parsed.materialRows.map((r) => ({ ...r, source_file_id: target.id }));
  for (let i = 0; i < materialPayload.length; i += 500) {
    const chunk = materialPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await admin.from("field_installation_rows").insert(chunk);
    if (ins.error) throw new Error(`insert rows failed: ${ins.error.message}`);
  }

  const laborPayload = parsed.laborRows.map((r) => ({ ...r, source_file_id: target.id }));
  for (let i = 0; i < laborPayload.length; i += 500) {
    const chunk = laborPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await admin.from("field_installation_labor_rows").insert(chunk);
    if (ins.error) throw new Error(`insert labor failed: ${ins.error.message}`);
  }

  const sum = await admin.from("field_installation_day_summary").upsert(
    {
      project_code: file.project_code,
      work_date: target.workDate,
      source_file_id: target.id,
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
  if (sum.error) throw new Error(`summary upsert failed: ${sum.error.message}`);

  return { id: target.id, fileName: file.file_name, from: file.work_date, to: target.workDate, revision: target.revision, rows: materialPayload.length };
}

async function main() {
  const out = [];
  for (const t of targets) {
    try {
      out.push({ ok: true, ...(await runOne(t)) });
    } catch (error) {
      out.push({ ok: false, id: t.id, error: error instanceof Error ? error.message : "unknown" });
    }
  }
  console.log(JSON.stringify({ ok: true, results: out }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "unknown" }, null, 2));
  process.exit(1);
});
