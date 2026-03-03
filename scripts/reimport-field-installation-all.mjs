import path from "path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const PROJECT_CODE = String(process.env.FIELD_INSTALLATION_PROJECT || "A27").trim();
const LIMIT = Number(process.env.FIELD_INSTALLATION_LIMIT || "0");
const ONLY_DATE = String(process.env.FIELD_INSTALLATION_ONLY_DATE || "").trim();
const DRY_RUN = String(process.env.FIELD_INSTALLATION_DRY_RUN || "false").toLowerCase() === "true";
const REPAIR_WORK_DATE = String(process.env.FIELD_INSTALLATION_REPAIR_WORK_DATE || "false").toLowerCase() === "true";
const BUCKET_FALLBACK = String(process.env.SUPABASE_STORAGE_BUCKET || "imports").trim() || "imports";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

function normalizePersonName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function numberFromUnknown(value) {
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

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateFromToken(token) {
  const digits = token.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${2000 + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function toIsoDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  if (typeof value === "number" && Number.isFinite(value) && XLSX?.SSF && typeof XLSX.SSF.parse_date_code === "function") {
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

function parseInstallationFileDate(fileName) {
  const exact = String(fileName || "").match(/^[A-Z0-9]+-E-INS-(\d{6})_rev\d{1,3}\.xls[xm]?$/i);
  if (exact?.[1]) return parseDateFromToken(exact[1]);
  const token = String(fileName || "").match(/(?:^|[-_])(\d{6})(?:[-_.]|$)/);
  if (!token?.[1]) return null;
  return parseDateFromToken(token[1]);
}

function pickSheet(workbook, sheetNames) {
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

function pickSheetWithName(workbook, sheetNames) {
  for (const sheetName of sheetNames) {
    if (workbook.Sheets[sheetName]) return { name: sheetName, sheet: workbook.Sheets[sheetName] };
  }

  const normalizedAliases = sheetNames.map((sheetName) => sheetName.trim().toLowerCase());
  const fuzzy = workbook.SheetNames.find((name) => {
    const normalized = name.trim().toLowerCase();
    return normalizedAliases.some((alias) => normalized.includes(alias));
  });

  if (fuzzy && workbook.Sheets[fuzzy]) return { name: fuzzy, sheet: workbook.Sheets[fuzzy] };
  throw new Error(`Sheet not found. Expected one of: ${sheetNames.join(", ")}`);
}

function scoreMaterialSheet(matrix) {
  let score = 0;
  const rows = Math.min(matrix.length, 220);
  for (let i = 0; i < rows; i += 1) {
    const row = matrix[i] || [];
    const rowDate = toIsoDate(row[1]);
    const description = normalizeText(row[9]);
    const qty = numberFromUnknown(row[11]);
    const manhours = numberFromUnknown(row[12]);
    if (rowDate && description && (qty !== null || manhours !== null)) score += 1;
  }
  return score;
}

function scoreLaborSheet(matrix) {
  let score = 0;
  const rows = Math.min(matrix.length, 260);
  for (let i = 0; i < rows; i += 1) {
    const row = matrix[i] || [];
    const rowDate = toIsoDate(row[1]);
    const employeeId = normalizeText(row[3]);
    const fullName = normalizeText(row[4]);
    const hoursIndirect = numberFromUnknown(row[6]);
    const hoursDirect = numberFromUnknown(row[7]);
    if (rowDate && (employeeId || fullName) && (hoursIndirect !== null || hoursDirect !== null)) score += 1;
  }
  return score;
}

function pickSheetByScore(workbook, kind, excludedSheetName = null) {
  let bestName = null;
  let bestScore = -1;

  for (const sheetName of workbook.SheetNames) {
    if (excludedSheetName && sheetName === excludedSheetName) continue;
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true });
    const score = kind === "material" ? scoreMaterialSheet(matrix) : scoreLaborSheet(matrix);
    if (score > bestScore) {
      bestScore = score;
      bestName = sheetName;
    }
  }

  if (!bestName || bestScore <= 0) {
    throw new Error(`Sheet autodetect failed for ${kind}.`);
  }

  return { name: bestName, sheet: workbook.Sheets[bestName] };
}

function pickMaterialSheet(workbook) {
  try {
    return pickSheetWithName(workbook, [
      "Ð›Ð˜ÐÐ˜Ð¯ ÐœÐ°Ñ‚ÐµÑ€Ð¸Ð°Ð»",
      "ЛИНИЯ Материал",
      "Field Material",
      "Material",
      "Материал",
    ]);
  } catch {
    return pickSheetByScore(workbook, "material");
  }
}

function pickLaborSheet(workbook, materialSheetName) {
  try {
    const found = pickSheetWithName(workbook, [
      "Ð›Ð˜ÐÐ˜Ð¯ Ð§ÐµÐ».-Ð§Ð°Ñ.",
      "ЛИНИЯ Чел.-Час.",
      "Field Manhour",
      "Manhour",
      "Чел",
    ]);
    if (materialSheetName && found.name === materialSheetName) {
      return pickSheetByScore(workbook, "labor", materialSheetName);
    }
    return found;
  } catch {
    return pickSheetByScore(workbook, "labor", materialSheetName || null);
  }
}

function findMaterialDataStart(matrix) {
  for (let i = 0; i < Math.min(matrix.length, 12); i += 1) {
    const row = matrix[i] || [];
    const a = String(row[0] ?? "").toLowerCase();
    const b = String(row[1] ?? "").toLowerCase();
    const j = String(row[9] ?? "").toLowerCase();
    const m = String(row[12] ?? "").toLowerCase();
    const looksLikeHeader =
      (a.includes("â„–") || a.includes("Ð¿/Ð¿")) &&
      b.includes("Ð´Ð°Ñ‚Ð°") &&
      (j.includes("Ð½Ð°Ð¸Ð¼ÐµÐ½Ð¾Ð²Ð°Ð½Ð¸Ðµ") || j.includes("Ð¼Ð°Ñ‚ÐµÑ€Ð¸Ð°Ð»")) &&
      (m.includes("Ñ‡ÐµÐ»") || m.includes("Ñ‡Ð°Ñ"));
    if (looksLikeHeader) return i + 1;
  }
  return 3;
}

function parseMaterialSheet(ws, targetWorkDate) {
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true });
  const rows = [];
  const dates = [];
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
    if (!(description && (hasNumericWork || hasBudgetLikeCode))) continue;

    if (rowDate) dates.push(rowDate);
    if (!rowDate) continue;
    if (rowDate !== targetWorkDate) continue;

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

  return { rows, dates, mhMaterial: Number(mhMaterial.toFixed(3)) };
}

function parseLaborSheet(ws, targetWorkDate) {
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: true });
  const rows = [];
  const dates = [];
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
    if (!rowDate) continue;
    if (rowDate !== targetWorkDate) continue;

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

  return {
    rows,
    dates,
    mhDirect: Number(mhDirect.toFixed(3)),
    mhIndirect: Number(mhIndirect.toFixed(3)),
  };
}

function revisionValue(revision) {
  const parsed = Number(String(revision || "rev00").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  for (const item of value) {
    if (typeof item === "string") {
      const message = item.trim();
      if (!message) continue;
      normalized.push({ code: "warning", message, details: null });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item;
    const code = typeof record.code === "string" && record.code.trim() ? record.code.trim() : "warning";
    const message =
      typeof record.message === "string" && record.message.trim() ? record.message.trim() : `Warning (${code}).`;
    const details = record.details && typeof record.details === "object" && !Array.isArray(record.details) ? record.details : null;
    normalized.push({ code, message, details });
  }
  return normalized;
}

function pickDominantDate(dates, fallback) {
  const counts = new Map();
  for (const date of dates) {
    if (!date) continue;
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  if (!counts.size) return fallback;

  let bestDate = fallback;
  let bestCount = -1;
  for (const [date, count] of counts.entries()) {
    if (count > bestCount) {
      bestDate = date;
      bestCount = count;
      continue;
    }
    if (count === bestCount && String(date) > String(bestDate || "")) {
      bestDate = date;
    }
  }
  return bestDate || fallback;
}

async function listAllFiles(projectCode) {
  const out = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const pageRes = await admin
      .from("field_installation_files")
      .select("id,project_code,work_date,bucket_id,storage_path,file_name,revision,updated_at")
      .eq("project_code", projectCode)
      .order("work_date", { ascending: true })
      .range(from, from + pageSize - 1);
    if (pageRes.error) throw new Error(pageRes.error.message);
    const batch = pageRes.data || [];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function keepLatestPerDate(files) {
  const map = new Map();
  for (const file of files) {
    const key = String(file.work_date || "");
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, file);
      continue;
    }
    const byRevision = revisionValue(file.revision) - revisionValue(prev.revision);
    if (byRevision > 0) {
      map.set(key, file);
      continue;
    }
    if (byRevision === 0 && String(file.updated_at || "") > String(prev.updated_at || "")) {
      map.set(key, file);
    }
  }
  return Array.from(map.values()).sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)));
}

async function fetchProjectId(projectCode) {
  const projectRes = await admin.from("projects").select("id").eq("code", projectCode).maybeSingle();
  if (projectRes.error) throw new Error(projectRes.error.message);
  return projectRes.data?.id || null;
}

async function processOneFile(file, projectId) {
  const bucket = String(file.bucket_id || BUCKET_FALLBACK).trim() || BUCKET_FALLBACK;
  const originalWorkDate = String(file.work_date || "");
  if (!originalWorkDate) throw new Error(`Missing work_date on file ${file.id}`);

  const dl = await admin.storage.from(bucket).download(file.storage_path);
  if (dl.error || !dl.data) {
    throw new Error(`Storage download failed: ${dl.error?.message || "unknown"}`);
  }

  const workbook = XLSX.read(Buffer.from(await dl.data.arrayBuffer()), {
    type: "buffer",
    raw: true,
    cellDates: true,
  });

  const materialSelection = pickMaterialSheet(workbook);
  const laborSelection = pickLaborSheet(workbook, materialSelection.name);
  let materialParsed = parseMaterialSheet(materialSelection.sheet, originalWorkDate);
  let laborParsed = parseLaborSheet(laborSelection.sheet, originalWorkDate);

  const candidateDates = [...materialParsed.dates, ...laborParsed.dates].filter(Boolean);
  const dominantDate = pickDominantDate(candidateDates, originalWorkDate);
  const effectiveWorkDate = REPAIR_WORK_DATE ? dominantDate : originalWorkDate;

  if (effectiveWorkDate !== originalWorkDate) {
    materialParsed = parseMaterialSheet(materialSelection.sheet, effectiveWorkDate);
    laborParsed = parseLaborSheet(laborSelection.sheet, effectiveWorkDate);
  }

  const mhTotal = Number((laborParsed.mhDirect + laborParsed.mhIndirect).toFixed(3));
  const mhMatchOk = Math.abs(materialParsed.mhMaterial - laborParsed.mhDirect) <= 0.5;
  const efficiencyPct = laborParsed.mhDirect > 0 ? Math.max(0, Math.min(100, (materialParsed.mhMaterial / laborParsed.mhDirect) * 100)) : 0;

  const warnings = [];
  const fromNameDate = parseInstallationFileDate(path.basename(file.file_name || file.storage_path || ""));
  if (fromNameDate && fromNameDate !== effectiveWorkDate) {
    warnings.push({
      code: "filename_date_mismatch",
      message: "Filename date does not match requested work date.",
      details: { expected: effectiveWorkDate, filenameDate: fromNameDate },
    });
  }

  if (effectiveWorkDate !== originalWorkDate) {
    warnings.push({
      code: "work_date_repaired",
      message: "Work date was corrected from dominant sheet date.",
      details: { from: originalWorkDate, to: effectiveWorkDate },
    });
  }

  const allSheetDates = [...materialParsed.dates, ...laborParsed.dates].filter(Boolean);
  const mismatchedDates = allSheetDates.filter((date) => date !== effectiveWorkDate);
  const dateOk = mismatchedDates.length === 0;
  if (!dateOk) {
    warnings.push({
      code: "sheet_date_mismatch",
      message: "Some row dates differ from the selected work date.",
      details: { expected: effectiveWorkDate, mismatchedCount: mismatchedDates.length, samples: mismatchedDates.slice(0, 5) },
    });
  }

  if (!mhMatchOk) {
    warnings.push({
      code: "manhour_mismatch",
      message: "Material manhours and direct personnel hours are not aligned.",
      details: { mh_material: materialParsed.mhMaterial, mh_direct: laborParsed.mhDirect, tolerance: 0.5 },
    });
  }

  const installationDirectNames = laborParsed.rows
    .filter((row) => (row.hoursDirect || 0) > 0)
    .map((row) => normalizePersonName(row.fullName))
    .filter(Boolean);

  let attendanceDirectElectricalNames = [];
  if (projectId) {
    const attendanceRes = await admin
      .from("attendance_records")
      .select("full_name")
      .eq("project_id", projectId)
      .eq("work_date", effectiveWorkDate)
      .eq("segment", "Direct")
      .eq("discipline", "Electrical")
      .eq("status", "Present");
    if (attendanceRes.error) throw new Error(attendanceRes.error.message);
    attendanceDirectElectricalNames = (attendanceRes.data || [])
      .map((row) => normalizePersonName(row.full_name))
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

  if (!DRY_RUN) {
    if (effectiveWorkDate !== originalWorkDate) {
      const updateFileRes = await admin.from("field_installation_files").update({ work_date: effectiveWorkDate }).eq("id", file.id);
      if (updateFileRes.error) throw new Error(updateFileRes.error.message);
    }

    const delMaterial = await admin.from("field_installation_rows").delete().eq("source_file_id", file.id);
    if (delMaterial.error) throw new Error(delMaterial.error.message);
    const delLabor = await admin.from("field_installation_labor_rows").delete().eq("source_file_id", file.id);
    if (delLabor.error) throw new Error(delLabor.error.message);

    const materialPayload = materialParsed.rows.map((row) => ({
      project_code: file.project_code,
      work_date: effectiveWorkDate,
      report_date: effectiveWorkDate,
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
      const ins = await admin.from("field_installation_rows").insert(chunk);
      if (ins.error) throw new Error(ins.error.message);
    }

    const laborPayload = laborParsed.rows.map((row) => ({
      project_code: file.project_code,
      work_date: effectiveWorkDate,
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
      const ins = await admin.from("field_installation_labor_rows").insert(chunk);
      if (ins.error) throw new Error(ins.error.message);
    }

    const summaryRes = await admin.from("field_installation_day_summary").upsert(
      {
        project_code: file.project_code,
        work_date: effectiveWorkDate,
        source_file_id: file.id,
        mh_material: materialParsed.mhMaterial,
        mh_direct: laborParsed.mhDirect,
        mh_indirect: laborParsed.mhIndirect,
        mh_total: mhTotal,
        date_ok: dateOk,
        mh_match_ok: mhMatchOk,
        attendance_match_ok: attendanceMatchOk,
        efficiency_pct: Number(efficiencyPct.toFixed(2)),
        warnings,
      },
      { onConflict: "project_code,work_date" }
    );
    if (summaryRes.error) throw new Error(summaryRes.error.message);
  }

  return {
    fileId: file.id,
    workDate: effectiveWorkDate,
    originalWorkDate,
    fileName: file.file_name,
    parsedMaterialRows: materialParsed.rows.length,
    parsedLaborRows: laborParsed.rows.length,
    mh_material: materialParsed.mhMaterial,
    mh_direct: laborParsed.mhDirect,
    mh_indirect: laborParsed.mhIndirect,
    mh_match_ok: mhMatchOk,
    attendance_match_ok: attendanceMatchOk,
    warningsCount: warnings.length,
  };
}

function hasLegacyPeopleWarning(warnings) {
  const parsed = normalizeWarnings(warnings);
  return parsed.some((item) => {
    const m = String(item.message || "").toLowerCase();
    return m.startsWith("manhour mismatch:") && m.includes("people=");
  });
}

async function collectPostCheck(projectCode) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const res = await admin
      .from("field_installation_day_summary")
      .select("work_date,mh_material,mh_direct,mh_match_ok,warnings,updated_at")
      .eq("project_code", projectCode)
      .order("work_date", { ascending: true })
      .range(from, from + pageSize - 1);
    if (res.error) throw new Error(res.error.message);
    const batch = res.data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const mhMismatches = rows.filter((row) => row.mh_match_ok === false);
  const legacyWarningRows = rows.filter((row) => hasLegacyPeopleWarning(row.warnings));
  return {
    totalSummaries: rows.length,
    mhMismatchCount: mhMismatches.length,
    mhMismatchDates: mhMismatches.slice(0, 50).map((row) => row.work_date),
    legacyPeopleWarningCount: legacyWarningRows.length,
    legacyPeopleWarningDates: legacyWarningRows.slice(0, 50).map((row) => row.work_date),
  };
}

async function main() {
  const files = await listAllFiles(PROJECT_CODE);
  const latestByDate = keepLatestPerDate(files);
  const byDate = ONLY_DATE ? latestByDate.filter((file) => String(file.work_date) === ONLY_DATE) : latestByDate;
  const targets = LIMIT > 0 ? byDate.slice(0, LIMIT) : byDate;
  const projectId = await fetchProjectId(PROJECT_CODE);

  const results = [];
  let failed = 0;
  for (const file of targets) {
    try {
      const result = await processOneFile(file, projectId);
      results.push({ status: "ok", ...result });
    } catch (error) {
      failed += 1;
      results.push({
        status: "failed",
        fileId: file.id,
        workDate: file.work_date,
        fileName: file.file_name,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const postCheck = await collectPostCheck(PROJECT_CODE);
  const mhMismatchedAfterRun = results.filter((row) => row.status === "ok" && row.mh_match_ok === false).length;

  console.log(
    JSON.stringify(
      {
        ok: failed === 0,
        dryRun: DRY_RUN,
        repairWorkDate: REPAIR_WORK_DATE,
        projectCode: PROJECT_CODE,
        onlyDate: ONLY_DATE || null,
        totalFiles: files.length,
        latestDates: latestByDate.length,
        eligibleDates: byDate.length,
        processed: targets.length,
        failed,
        mhMismatchedAfterRun,
        postCheck,
        failedItems: results.filter((row) => row.status === "failed"),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "unknown" }, null, 2));
  process.exit(1);
});
