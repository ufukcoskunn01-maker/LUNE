export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import {
  buildMonthlyHoursRows,
  DISCIPLINE_ORDER,
  monthRange,
  parseMonthToken,
  SEGMENT_ORDER,
  type MonthlyAttendanceRecord,
} from "@/lib/attendance/monthly-hours";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const TEMPLATE_BUCKET = process.env.MONTHLY_HOURS_TEMPLATE_BUCKET || "templates";
const TEMPLATE_STORAGE_PATH = process.env.MONTHLY_HOURS_TEMPLATE_PATH || "A27/Personal Reports/A27-MonthlyHours-Template.xlsx";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "A27-MonthlyHours-2026-02.xlsx");
const DEFAULT_HEADER_ROW = 9;
const DEFAULT_DATA_START_ROW = 11;
const DEFAULT_COL_EMPLOYEE_ID = 2;
const DEFAULT_COL_FULL_NAME = 3;
const DEFAULT_COL_TOTAL = 35;

type TemplateLayout = {
  headerRow: number;
  dataStartRow: number;
  samplePersonRow: number;
  colEmployeeId: number;
  colFullName: number;
  colDayStart: number;
  colTotal: number;
  dayTokens: Array<string | null>;
};

type XlsxLoadInput = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

function cloneStyle(style: Partial<ExcelJS.Style> | undefined): Partial<ExcelJS.Style> {
  return style ? JSON.parse(JSON.stringify(style)) : {};
}

function normalizeTemplateColumns(sheet: ExcelJS.Worksheet, layout: TemplateLayout): void {
  for (let col = layout.colEmployeeId; col <= layout.colTotal; col += 1) {
    if (!sheet.getColumn(col).width || sheet.getColumn(col).width! < 4) {
      sheet.getColumn(col).width = col === layout.colFullName ? 32 : col === layout.colEmployeeId ? 16 : 6;
    }
  }
}

function isCellEmpty(value: ExcelJS.CellValue): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "object" && "result" in value) {
    const inner = (value as { result?: unknown }).result;
    return inner === null || inner === undefined || inner === "";
  }
  return false;
}

function normalizeText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "result" in value) {
    return normalizeText((value as { result?: ExcelJS.CellValue }).result ?? null);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim().toLowerCase();
}

function toDayToken(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && "result" in value) {
    return toDayToken((value as { result?: ExcelJS.CellValue }).result ?? null);
  }
  if (value instanceof Date) return String(value.getUTCDate()).padStart(2, "0");
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31) {
    return String(value).padStart(2, "0");
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(8, 10);
  if (/^\d{1,2}$/.test(raw)) return String(Number(raw)).padStart(2, "0");
  return null;
}

function detectTemplateLayout(sheet: ExcelJS.Worksheet): TemplateLayout {
  let headerRow = DEFAULT_HEADER_ROW;
  let colEmployeeId = DEFAULT_COL_EMPLOYEE_ID;
  let colFullName = DEFAULT_COL_FULL_NAME;
  let colTotal = DEFAULT_COL_TOTAL;

  for (let rowIndex = 1; rowIndex <= Math.min(sheet.rowCount, 120); rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    let idColCandidate: number | null = null;
    let nameColCandidate: number | null = null;
    let totalColCandidate: number | null = null;
    for (let col = 1; col <= 120; col += 1) {
      const text = normalizeText(row.getCell(col).value);
      if (!text) continue;
      if (text === "personal id") idColCandidate = col;
      if (text === "name surname") nameColCandidate = col;
      if (text.startsWith("total")) totalColCandidate = col;
    }
    if (idColCandidate && nameColCandidate) {
      headerRow = rowIndex;
      colEmployeeId = idColCandidate;
      colFullName = nameColCandidate;
      if (totalColCandidate && totalColCandidate > colFullName) colTotal = totalColCandidate;
      break;
    }
  }

  const colDayStart = colFullName + 1;
  const dayTokens: Array<string | null> = [];
  for (let col = colDayStart; col < colTotal; col += 1) {
    dayTokens.push(toDayToken(sheet.getRow(headerRow).getCell(col).value));
  }

  let dataStartRow = DEFAULT_DATA_START_ROW;
  for (let rowIndex = headerRow + 1; rowIndex <= Math.min(sheet.rowCount, headerRow + 30); rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    if (!isCellEmpty(row.getCell(colEmployeeId).value) || !isCellEmpty(row.getCell(colFullName).value)) {
      dataStartRow = rowIndex;
      break;
    }
  }

  let samplePersonRow = dataStartRow;
  const groupNames = new Set(["electrical", "mechanical", "shared", "indirect", "direct", "mobilisation", "mobilization"]);
  for (let rowIndex = dataStartRow; rowIndex <= Math.min(sheet.rowCount, dataStartRow + 120); rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const idText = normalizeText(row.getCell(colEmployeeId).value);
    const nameText = normalizeText(row.getCell(colFullName).value);
    if (!nameText || groupNames.has(nameText)) continue;
    if (idText || /\p{L}/u.test(nameText)) {
      samplePersonRow = rowIndex;
      break;
    }
  }

  return {
    headerRow,
    dataStartRow,
    samplePersonRow,
    colEmployeeId,
    colFullName,
    colDayStart,
    colTotal,
    dayTokens,
  };
}

function clearTemplateDataArea(sheet: ExcelJS.Worksheet, layout: TemplateLayout): void {
  for (let rowIndex = layout.dataStartRow; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.outlineLevel = 0;
    row.hidden = false;
    for (let col = layout.colEmployeeId; col <= layout.colTotal; col += 1) {
      row.getCell(col).value = null;
    }
    row.commit();
  }
}

async function loadTemplateWorkbook(admin: ReturnType<typeof supabaseAdmin> | null): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  // 1) Preferred source: Supabase Storage template.
  let storageErrorMessage = "admin client unavailable";
  if (admin) {
    const { data: storageBlob, error: storageError } = await admin.storage.from(TEMPLATE_BUCKET).download(TEMPLATE_STORAGE_PATH);
    if (!storageError && storageBlob) {
      const arrayBuffer = await storageBlob.arrayBuffer();
      await workbook.xlsx.load(Buffer.from(arrayBuffer) as unknown as XlsxLoadInput);
      return workbook;
    }
    storageErrorMessage = storageError?.message || "No storage error details";
  }

  // 2) Fallback source: local checked-in template.
  try {
    const templateBuffer = await fs.readFile(TEMPLATE_PATH);
    await workbook.xlsx.load(templateBuffer as unknown as XlsxLoadInput);
    return workbook;
  } catch (error) {
    const localMessage = error instanceof Error ? error.message : "Unknown local template read error";
    throw new Error(
      `Template not available. Storage: ${TEMPLATE_BUCKET}/${TEMPLATE_STORAGE_PATH} (${storageErrorMessage}). Local: ${TEMPLATE_PATH} (${localMessage}).`
    );
  }
}

export async function GET(req: Request) {
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const url = new URL(req.url);
    const projectCode = (url.searchParams.get("projectCode") || "").trim();
    const month = (url.searchParams.get("month") || "").trim();

    if (!projectCode) {
      return NextResponse.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }
    if (!parseMonthToken(month)) {
      return NextResponse.json({ ok: false, error: "month must be in YYYY-MM format." }, { status: 400 });
    }

    const range = monthRange(month);
    if (!range) {
      return NextResponse.json({ ok: false, error: "Invalid month." }, { status: 400 });
    }

    let admin: ReturnType<typeof supabaseAdmin> | null = null;
    try {
      admin = supabaseAdmin();
    } catch {
      admin = null;
    }

    const dbClient = admin ?? sb;
    const { data: project, error: projectError } = await dbClient.from("projects").select("id").eq("code", projectCode).maybeSingle();
    if (projectError) {
      return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
    }
    if (!project?.id) {
      return NextResponse.json({ ok: false, error: `Project not found: ${projectCode}` }, { status: 404 });
    }

    const records: MonthlyAttendanceRecord[] = [];
    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await dbClient
        .from("attendance_records")
        .select("employee_id,full_name,work_date,status,segment,discipline")
        .eq("project_id", project.id)
        .gte("work_date", range.start)
        .lte("work_date", range.end)
        .order("work_date", { ascending: true })
        .order("employee_id", { ascending: true })
        .range(from, to);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      const batch = (data || []) as MonthlyAttendanceRecord[];
      records.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }

    const rows = buildMonthlyHoursRows(records);

    let workbook: ExcelJS.Workbook;
    try {
      workbook = await loadTemplateWorkbook(admin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load template workbook.";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
    const sheet = workbook.getWorksheet("Monthly Hours") || workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ ok: false, error: "Template worksheet not found." }, { status: 500 });
    }
    const layout = detectTemplateLayout(sheet);

    // Keep template visuals and make sure grouping is enabled.
    sheet.properties.outlineLevelRow = 2;
    normalizeTemplateColumns(sheet, layout);

    // Capture the template person row style before replacing data rows.
    const templatePersonStyle: Record<number, Partial<ExcelJS.Style>> = {};
    for (let col = layout.colEmployeeId; col <= layout.colTotal; col += 1) {
      templatePersonStyle[col] = cloneStyle(sheet.getRow(layout.samplePersonRow).getCell(col).style);
    }

    // Update date cells based on requested month while keeping all template text styles.
    const parsedMonth = parseMonthToken(month)!;
    const monthLastDay = Number(range.end.slice(8, 10));
    for (let idx = 0; idx < layout.dayTokens.length; idx += 1) {
      const token = layout.dayTokens[idx];
      if (!token) continue;
      const dayNumber = Number(token);
      const cell = sheet.getRow(layout.headerRow).getCell(layout.colDayStart + idx);
      if (dayNumber >= 1 && dayNumber <= monthLastDay) {
        cell.value = new Date(Date.UTC(parsedMonth.year, parsedMonth.month - 1, dayNumber));
      } else {
        cell.value = null;
      }
    }

    // Clear old template rows in-place to preserve template internals (shared formulas, drawing anchors, etc.).
    clearTemplateDataArea(sheet, layout);

    let cursor = layout.dataStartRow;
    for (const discipline of DISCIPLINE_ORDER) {
      const disciplineRows = rows.filter((row) => row.discipline === discipline);
      if (disciplineRows.length === 0) continue;

      const dRow = sheet.getRow(cursor++);
      dRow.getCell(layout.colFullName).value = discipline;
      dRow.getCell(layout.colFullName).font = { bold: true, size: 11 };
      dRow.getCell(layout.colFullName).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAF2FF" },
      };
      dRow.outlineLevel = 0;
      dRow.commit();

      for (const segment of SEGMENT_ORDER) {
        const segmentRows = disciplineRows.filter((row) => row.segment === segment);
        if (segmentRows.length === 0) continue;

        const sRow = sheet.getRow(cursor++);
        sRow.getCell(layout.colFullName).value = segment;
        sRow.getCell(layout.colFullName).font = { bold: true, italic: true, size: 10 };
        sRow.getCell(layout.colFullName).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF6FAFF" },
        };
        sRow.outlineLevel = 1;
        sRow.commit();

        for (const row of segmentRows) {
          const pRow = sheet.getRow(cursor++);
          pRow.getCell(layout.colEmployeeId).value = row.employee_id;
          pRow.getCell(layout.colFullName).value = row.full_name;
          for (let idx = 0; idx < layout.dayTokens.length; idx += 1) {
            const dayToken = layout.dayTokens[idx];
            pRow.getCell(layout.colDayStart + idx).value = dayToken ? (row.days[dayToken] ?? null) : null;
          }
          pRow.getCell(layout.colTotal).value = row.total_hours;

          for (let col = layout.colEmployeeId; col <= layout.colTotal; col += 1) {
            pRow.getCell(col).style = cloneStyle(templatePersonStyle[col]);
          }
          pRow.outlineLevel = 2;
          pRow.commit();
        }
      }
    }

    const out = await workbook.xlsx.writeBuffer();
    const fileName = `${projectCode}-MonthlyHours-${month}.xlsx`;
    const encoded = encodeURIComponent(fileName);

    return new Response(new Uint8Array(out as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monthly hours export failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
