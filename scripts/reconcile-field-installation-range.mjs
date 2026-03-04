import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const PROJECT_CODE = String(process.env.FIELD_INSTALLATION_PROJECT || "A27").trim();
const START_DATE = String(process.env.FIELD_INSTALLATION_START_DATE || "2025-06-30").trim();
const END_DATE = String(process.env.FIELD_INSTALLATION_END_DATE || "2026-03-02").trim();
const DRY_RUN = String(process.env.FIELD_INSTALLATION_DRY_RUN || "false").toLowerCase() === "true";
const BUCKET_HINT = String(process.env.SUPABASE_STORAGE_BUCKET || "imports").trim() || "imports";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

const ROOT_PREFIXES = [
  `${PROJECT_CODE}/2-Daily Field Reports`,
  `${PROJECT_CODE}/2-Daily Installation Reports`,
  `${PROJECT_CODE}/2-Installation Reports`,
  `${PROJECT_CODE}/field-installation`,
  `${PROJECT_CODE}/2-Daily Reports A27 E&I`,
];

function normalizePrefix(value) {
  return String(value || "").replace(/^\/+/, "").replace(/\/+$/, "");
}

function isFolder(item) {
  const name = String(item?.name || "").trim();
  if (!name) return false;
  const meta = item?.metadata || {};
  if (typeof meta.size === "number" || typeof meta.mimetype === "string") return false;
  return !/\.[a-z0-9]{1,8}$/i.test(name);
}

async function listPrefix(bucket, prefix) {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const res = await admin.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (res.error) throw new Error(`Storage list failed at ${bucket}/${prefix}: ${res.error.message}`);
    const batch = res.data || [];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return out;
}

async function listFilesRecursive(bucket, prefix) {
  const files = [];
  const queue = [normalizePrefix(prefix)];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const rows = await listPrefix(bucket, current);
    for (const row of rows) {
      const name = String(row?.name || "").trim();
      if (!name) continue;
      const fullPath = `${current}/${name}`;
      if (isFolder(row)) queue.push(fullPath);
      else files.push(fullPath);
    }
  }
  return files;
}

function parseRevision(fileName) {
  const match = String(fileName || "").match(/(?:_|-)rev(\d{1,3})/i);
  const n = match ? Number(match[1] || 0) : 0;
  return `rev${String(Number.isFinite(n) ? n : 0).padStart(2, "0")}`;
}

function filePriority(fileName) {
  const name = String(fileName || "").toLowerCase();
  let score = 0;
  if (/(?:^|[-_])ins(?:[-_.]|$)/.test(name)) score += 1000;
  if (name.includes("daily reports a27 e&i")) score += 900;
  if (name.includes("installation")) score += 700;
  if (name.includes("daily")) score += 100;
  return score;
}

function revisionRank(revision) {
  const n = Number(String(revision || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function validDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function parseYymmdd(token) {
  if (!/^\d{6}$/.test(token)) return null;
  const yy = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const dd = Number(token.slice(4, 6));
  const year = 2000 + yy;
  if (!validDate(year, mm, dd)) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function inferDateFromFileName(fileName) {
  const exact = String(fileName || "").match(/^[A-Z0-9]+-E-INS-(\d{6})_rev\d{1,3}\.xls[xm]?$/i);
  if (exact?.[1]) return parseYymmdd(exact[1]);
  const tokens = Array.from(String(fileName || "").matchAll(/(\d{6})/g)).map((m) => m[1]);
  for (const token of tokens) {
    const parsed = parseYymmdd(token);
    if (parsed) return parsed;
  }
  return null;
}

function inRange(iso) {
  return typeof iso === "string" && iso >= START_DATE && iso <= END_DATE;
}

function normalizeText(value) {
  const text = String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;
  let raw = String(value).trim();
  if (!raw) return null;
  raw = raw.replace(/\u00A0/g, "").replace(/\s+/g, "");
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  if (hasComma && hasDot) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(/,/g, ".");
    else raw = raw.replace(/,/g, "");
  } else if (hasComma) {
    raw = raw.replace(/,/g, ".");
  }
  raw = raw.replace(/[^0-9.+-]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
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
  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yy = Number(dmy[3]);
    const year = yy < 100 ? 2000 + yy : yy;
    if (validDate(year, mm, dd)) {
      return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseSourceMaterial(workbook) {
  const ws = workbook.Sheets["GUNLUK RAPOR"] || workbook.Sheets["ЛИНИЯ Материал"] || workbook.Sheets[workbook.SheetNames[1]];
  if (!ws) throw new Error("Material sheet not found.");
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true });
  const rows = [];
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const rowNo = toNumber(row[0]);
    const description = normalizeText(row[9]);
    const budgetCode = normalizeText(row[8]);
    const qty = toNumber(row[11]);
    const manhours = toNumber(row[12]);
    const hasBudget = Boolean(budgetCode && /\d/.test(budgetCode));
    if (!(description && (qty !== null || manhours !== null || hasBudget))) continue;
    rows.push({
      row_no: rowNo,
      report_date: toIsoDate(row[1]),
      zone: normalizeText(row[4]),
      floor: normalizeText(row[5]),
      budget_code: budgetCode,
      description,
      unit: normalizeText(row[10]),
      qty,
      manhours,
      team_no: toNumber(row[7]),
      install_action: normalizeText(row[2]),
      location: normalizeText(row[3]),
      elevation: normalizeText(row[6]),
      project_name: normalizeText(row[13]),
      orientation: normalizeText(row[14]),
      comment: normalizeText(row[15]),
      raw: {
        line_no: row[0] ?? null,
        report_date: row[1] ?? null,
        install_or_remove: normalizeText(row[2]),
        location: normalizeText(row[3]),
        zone: normalizeText(row[4]),
        floor: normalizeText(row[5]),
        elevation: normalizeText(row[6]),
        team_no: row[7] ?? null,
        budget_code: budgetCode,
        description,
        unit: normalizeText(row[10]),
        qty,
        manhours,
        project_name: normalizeText(row[13]),
        orientation: normalizeText(row[14]),
        comment: normalizeText(row[15]),
      },
    });
  }
  return rows;
}

function parseLabor(workbook) {
  const ws = workbook.Sheets["ЛИНИЯ Чел.-Час."] || workbook.Sheets[workbook.SheetNames[0]];
  if (!ws) return { rows: [], mhDirect: 0, mhIndirect: 0 };
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true });
  const rows = [];
  let mhDirect = 0;
  let mhIndirect = 0;
  for (let i = 2; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const employeeId = normalizeText(row[3]);
    const fullName = normalizeText(row[4]);
    const hoursIndirect = toNumber(row[6]);
    const hoursDirect = toNumber(row[7]);
    if (!((employeeId || fullName) && (hoursIndirect !== null || hoursDirect !== null))) continue;
    mhDirect += hoursDirect ?? 0;
    mhIndirect += hoursIndirect ?? 0;
    rows.push({
      team_no: normalizeText(row[2]),
      employee_id: employeeId,
      full_name: fullName,
      title: normalizeText(row[5]),
      hours_indirect: hoursIndirect,
      hours_direct: hoursDirect,
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
  return {
    rows,
    mhDirect: Number(mhDirect.toFixed(3)),
    mhIndirect: Number(mhIndirect.toFixed(3)),
  };
}

function aggregateMaterialRows(rows) {
  let totalQty = 0;
  let totalMh = 0;
  for (const row of rows) {
    totalQty += Number(row.qty || 0);
    totalMh += Number(row.manhours || 0);
  }
  return {
    rowCount: rows.length,
    qty: Number(totalQty.toFixed(6)),
    mh: Number(totalMh.toFixed(6)),
  };
}

function equalAgg(left, right) {
  return (
    left.rowCount === right.rowCount &&
    Math.abs(Number(left.qty || 0) - Number(right.qty || 0)) <= 1e-6 &&
    Math.abs(Number(left.mh || 0) - Number(right.mh || 0)) <= 1e-6
  );
}

async function listBuckets() {
  const res = await admin.storage.listBuckets();
  if (res.error) throw new Error(res.error.message);
  const names = (res.data || []).map((b) => String(b?.name || "").trim()).filter(Boolean);
  if (!names.includes(BUCKET_HINT)) names.unshift(BUCKET_HINT);
  return Array.from(new Set(names));
}

async function discoverSourceFiles() {
  const buckets = await listBuckets();
  const discovered = [];
  for (const bucket of buckets) {
    for (const prefix of ROOT_PREFIXES) {
      const root = normalizePrefix(prefix);
      if (!root) continue;
      let files = [];
      try {
        files = await listFilesRecursive(bucket, root);
      } catch {
        continue;
      }
      for (const storagePath of files) {
        const fileName = storagePath.split("/").pop() || "";
        if (!/\.xls[xm]?$/i.test(fileName)) continue;
        const inferredDate = inferDateFromFileName(fileName);
        if (!inferredDate || !inRange(inferredDate)) continue;
        discovered.push({
          project_code: PROJECT_CODE,
          work_date: inferredDate,
          bucket_id: bucket,
          storage_path: storagePath,
          file_name: fileName,
          revision: parseRevision(fileName),
        });
      }
    }
  }

  const byDate = new Map();
  for (const file of discovered) {
    const prev = byDate.get(file.work_date);
    if (!prev) {
      byDate.set(file.work_date, file);
      continue;
    }
    const revDiff = revisionRank(file.revision) - revisionRank(prev.revision);
    if (revDiff > 0) {
      byDate.set(file.work_date, file);
      continue;
    }
    const priDiff = filePriority(file.file_name) - filePriority(prev.file_name);
    if (priDiff > 0) {
      byDate.set(file.work_date, file);
      continue;
    }
    if (revDiff === 0 && priDiff === 0 && String(file.file_name).localeCompare(String(prev.file_name)) > 0) {
      byDate.set(file.work_date, file);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)));
}

async function fetchExistingFileMeta(workDate) {
  const res = await admin
    .from("field_installation_files")
    .select("id,project_code,work_date,bucket_id,storage_path,file_name,revision,updated_at")
    .eq("project_code", PROJECT_CODE)
    .eq("work_date", workDate)
    .order("updated_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);
  const rows = res.data || [];
  if (!rows.length) return null;
  rows.sort((a, b) => {
    const revDiff = revisionRank(b.revision) - revisionRank(a.revision);
    if (revDiff !== 0) return revDiff;
    return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
  });
  return rows[0];
}

async function fetchExistingAttendanceMatch(workDate) {
  const res = await admin
    .from("field_installation_day_summary")
    .select("attendance_match_ok")
    .eq("project_code", PROJECT_CODE)
    .eq("work_date", workDate)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return typeof res.data?.attendance_match_ok === "boolean" ? res.data.attendance_match_ok : null;
}

async function ensureFileMeta(sourceFile) {
  const existing = await fetchExistingFileMeta(sourceFile.work_date);
  if (existing && existing.bucket_id === sourceFile.bucket_id && existing.storage_path === sourceFile.storage_path) {
    return {
      fileId: existing.id,
      fileMetaEqual: true,
      dbFile: existing,
    };
  }

  if (DRY_RUN && existing) {
    return {
      fileId: existing.id,
      fileMetaEqual: false,
      dbFile: existing,
    };
  }

  if (existing) {
    return {
      fileId: existing.id,
      fileMetaEqual: false,
      dbFile: existing,
    };
  }

  const upsert = await admin
    .from("field_installation_files")
    .upsert(
      {
        project_code: PROJECT_CODE,
        work_date: sourceFile.work_date,
        bucket_id: sourceFile.bucket_id,
        storage_path: sourceFile.storage_path,
        file_name: sourceFile.file_name,
        file_kind: "installation",
        revision: sourceFile.revision || "rev00",
        source_created_at: new Date().toISOString(),
        ingest_status: "queued",
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "bucket_id,storage_path" }
    )
    .select("id,project_code,work_date,bucket_id,storage_path,file_name,revision,updated_at")
    .single();
  if (upsert.error || !upsert.data) throw new Error(upsert.error?.message || "Failed to upsert file meta.");
  return {
    fileId: upsert.data.id,
    fileMetaEqual: existing
      ? existing.bucket_id === sourceFile.bucket_id && existing.storage_path === sourceFile.storage_path
      : false,
    dbFile: upsert.data,
  };
}

async function fetchDbMaterialRows(fileId) {
  const res = await admin
    .from("field_installation_rows")
    .select("row_no,zone,floor,budget_code,description,unit,qty,manhours,team_no,install_action,location,elevation,project_name,orientation,comment,raw")
    .eq("source_file_id", fileId);
  if (res.error) throw new Error(res.error.message);
  return res.data || [];
}

async function replaceRowsAndSummary(args) {
  const {
    fileId,
    sourceFile,
    materialRows,
    laborRows,
    mhMaterial,
    mhDirect,
    mhIndirect,
    existingAttendanceMatch,
  } = args;

  if (DRY_RUN) return;

  const delMaterial = await admin.from("field_installation_rows").delete().eq("source_file_id", fileId);
  if (delMaterial.error) throw new Error(delMaterial.error.message);
  const delLabor = await admin.from("field_installation_labor_rows").delete().eq("source_file_id", fileId);
  if (delLabor.error) throw new Error(delLabor.error.message);

  const materialPayload = materialRows.map((row) => ({
    project_code: PROJECT_CODE,
    work_date: sourceFile.work_date,
    report_date: sourceFile.work_date,
    source_file_id: fileId,
    row_no: row.row_no,
    zone: row.zone,
    floor: row.floor,
    budget_code: row.budget_code,
    activity_code: null,
    description: row.description,
    unit: row.unit,
    qty: row.qty,
    manhours: row.manhours,
    team_no: row.team_no,
    crew: row.team_no,
    elevation: row.elevation,
    install_action: row.install_action,
    location: row.location,
    project_name: row.project_name,
    orientation: row.orientation,
    comment: row.comment,
    raw: row.raw,
  }));
  for (let i = 0; i < materialPayload.length; i += 500) {
    const chunk = materialPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await admin.from("field_installation_rows").insert(chunk);
    if (ins.error) throw new Error(ins.error.message);
  }

  const laborPayload = laborRows.map((row) => ({
    project_code: PROJECT_CODE,
    work_date: sourceFile.work_date,
    source_file_id: fileId,
    team_no: row.team_no,
    employee_id: row.employee_id,
    full_name: row.full_name,
    title: row.title,
    hours_indirect: row.hours_indirect,
    hours_direct: row.hours_direct,
    raw: row.raw,
  }));
  for (let i = 0; i < laborPayload.length; i += 500) {
    const chunk = laborPayload.slice(i, i + 500);
    if (!chunk.length) continue;
    const ins = await admin.from("field_installation_labor_rows").insert(chunk);
    if (ins.error) throw new Error(ins.error.message);
  }

  const mhTotal = Number((mhDirect + mhIndirect).toFixed(3));
  const mhMatchOk = Math.abs(mhMaterial - mhDirect) <= 0.5;
  const summary = await admin.from("field_installation_day_summary").upsert(
    {
      project_code: PROJECT_CODE,
      work_date: sourceFile.work_date,
      source_file_id: fileId,
      mh_material: mhMaterial,
      mh_direct: mhDirect,
      mh_indirect: mhIndirect,
      mh_total: mhTotal,
      date_ok: true,
      mh_match_ok: mhMatchOk,
      attendance_match_ok: typeof existingAttendanceMatch === "boolean" ? existingAttendanceMatch : false,
      efficiency_pct: mhDirect > 0 ? Number(((mhMaterial / mhDirect) * 100).toFixed(2)) : 0,
      warnings: [],
    },
    { onConflict: "project_code,work_date" }
  );
  if (summary.error) throw new Error(summary.error.message);

  const nowIso = new Date().toISOString();
  const fileUpdate = await admin
    .from("field_installation_files")
    .update({
      ingest_status: "ready",
      parse_error: null,
      last_error: null,
      parsed_material_rows: materialRows.length,
      inserted_material_rows: materialRows.length,
      parsed_labor_rows: laborRows.length,
      inserted_labor_rows: laborRows.length,
      rows_count: materialRows.length,
      distinct_row_dates: [sourceFile.work_date],
      processing_finished_at: nowIso,
      processed_at: nowIso,
    })
    .eq("id", fileId);
  if (fileUpdate.error) throw new Error(fileUpdate.error.message);
}

async function auditOnce(sourceFiles) {
  const results = [];
  for (const sourceFile of sourceFiles) {
    const ensured = await ensureFileMeta(sourceFile);
    const fileId = ensured.fileId;
    const existingAttendanceMatch = await fetchExistingAttendanceMatch(sourceFile.work_date);

    const download = await admin.storage.from(sourceFile.bucket_id).download(sourceFile.storage_path);
    if (download.error || !download.data) {
      results.push({
        date: sourceFile.work_date,
        file_name: sourceFile.file_name,
        status: "error",
        error: `Download failed: ${download.error?.message || "unknown"}`,
      });
      continue;
    }

    const workbook = XLSX.read(Buffer.from(await download.data.arrayBuffer()), {
      type: "buffer",
      raw: true,
      cellDates: true,
    });

    let sourceMaterialRows = [];
    let sourceLaborRows = [];
    let sourceAgg = { rowCount: 0, qty: 0, mh: 0 };
    let laborAgg = { mhDirect: 0, mhIndirect: 0 };
    try {
      sourceMaterialRows = parseSourceMaterial(workbook);
      sourceAgg = aggregateMaterialRows(sourceMaterialRows);
      const labor = parseLabor(workbook);
      sourceLaborRows = labor.rows;
      laborAgg = { mhDirect: labor.mhDirect, mhIndirect: labor.mhIndirect };
    } catch (error) {
      results.push({
        date: sourceFile.work_date,
        file_name: sourceFile.file_name,
        status: "error",
        error: error instanceof Error ? error.message : "Parse failed",
      });
      continue;
    }

    const dbRows = await fetchDbMaterialRows(fileId);
    const dbAgg = aggregateMaterialRows(dbRows);
    const equalBefore = equalAgg(sourceAgg, dbAgg);
    let repaired = false;

    if (!equalBefore && !DRY_RUN) {
      await replaceRowsAndSummary({
        fileId,
        sourceFile,
        materialRows: sourceMaterialRows,
        laborRows: sourceLaborRows,
        mhMaterial: sourceAgg.mh,
        mhDirect: laborAgg.mhDirect,
        mhIndirect: laborAgg.mhIndirect,
        existingAttendanceMatch,
      });
      repaired = true;
    }

    const afterRows = await fetchDbMaterialRows(fileId);
    const afterAgg = aggregateMaterialRows(afterRows);
    const equalAfter = equalAgg(sourceAgg, afterAgg);

    results.push({
      date: sourceFile.work_date,
      file_name: sourceFile.file_name,
      bucket_id: sourceFile.bucket_id,
      storage_path: sourceFile.storage_path,
      file_meta_equal: ensured.fileMetaEqual,
      source: sourceAgg,
      db_before: dbAgg,
      db_after: afterAgg,
      matched_before: equalBefore,
      matched_after: equalAfter,
      repaired,
    });
  }
  return results;
}

async function main() {
  const sourceFiles = await discoverSourceFiles();
  const results = await auditOnce(sourceFiles);

  const mismatchesBefore = results.filter((row) => row.matched_before === false).map((row) => row.date);
  const mismatchesAfter = results.filter((row) => row.matched_after === false).map((row) => row.date);
  const fileMetaMismatches = results.filter((row) => row.file_meta_equal === false).map((row) => row.date);
  const errors = results.filter((row) => row.status === "error");

  console.log(
    JSON.stringify(
      {
        project: PROJECT_CODE,
        startDate: START_DATE,
        endDate: END_DATE,
        dryRun: DRY_RUN,
        checkedDates: sourceFiles.length,
        mismatchesBeforeCount: mismatchesBefore.length,
        mismatchesBefore,
        repairedCount: results.filter((row) => row.repaired).length,
        mismatchesAfterCount: mismatchesAfter.length,
        mismatchesAfter,
        fileMetaMismatchCount: fileMetaMismatches.length,
        fileMetaMismatches,
        errorsCount: errors.length,
        errors,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown failure",
      },
      null,
      2
    )
  );
  process.exit(1);
});
