import fs from "node:fs/promises";
import path from "node:path";

import { XMLBuilder, XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

import type { DisciplineBucket, MonthlyHoursRow, SegmentBucket } from "@/lib/attendance-monthly-hours";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "A27",
  "Personal Reports",
  "A27-Montly Personal Report-Template.xlsx"
);

const TEMPLATE_SHEET_XML = "xl/worksheets/sheet1.xml";
const TEMPLATE_DAY_COLUMNS = Array.from({ length: 31 }, (_, index) => encodeColumn(4 + index));
const TOTAL_COLUMN = "AI";
const DATE_LABEL_SOURCE_COLUMN = "AH";
const DATE_VALUE_SOURCE_COLUMN = "AI";
const DATE_LABEL_TARGET_COLUMN = "AJ";
const DATE_VALUE_TARGET_COLUMN = "AK";
const DATE_LABEL_TEXT = "\u0414\u0430\u0442\u0430";

type TemplateBlock = {
  discipline: DisciplineBucket;
  segment: SegmentBucket;
  startRow: number;
  endRow: number;
};

type ResolvedTemplateBlock = TemplateBlock;

type WorksheetCell = {
  "@_r": string;
  "@_s"?: string;
  "@_t"?: string;
  "@_cm"?: string;
  "@_vm"?: string;
  "@_ph"?: string;
  v?: string;
  f?: string | { "#text"?: string; "@_ca"?: string };
  is?: { t?: string | { "#text": string; "@_xml:space"?: string } };
};

type WorksheetRow = {
  "@_r": string;
  c?: WorksheetCell | WorksheetCell[];
  [key: string]: unknown;
};

type WorksheetCol = Record<string, string>;

type WorksheetDocument = {
  worksheet: {
    cols?: { col: WorksheetCol | WorksheetCol[] };
    sheetData: { row: WorksheetRow | WorksheetRow[] };
    [key: string]: unknown;
  };
};

const TEMPLATE_BLOCKS: TemplateBlock[] = [
  { discipline: "Electrical", segment: "Indirect", startRow: 10, endRow: 27 },
  { discipline: "Electrical", segment: "Direct", startRow: 29, endRow: 57 },
  { discipline: "Electrical", segment: "Mobilization", startRow: 59, endRow: 72 },
  { discipline: "Mechanical", segment: "Indirect", startRow: 75, endRow: 96 },
  { discipline: "Mechanical", segment: "Direct", startRow: 98, endRow: 208 },
  { discipline: "Mechanical", segment: "Mobilization", startRow: 210, endRow: 213 },
  { discipline: "Shared", segment: "Indirect", startRow: 216, endRow: 230 },
  { discipline: "Shared", segment: "Direct", startRow: 232, endRow: 254 },
];

const XML_PARSER = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
});

const XML_BUILDER = new XMLBuilder({
  attributeNamePrefix: "@_",
  format: false,
  ignoreAttributes: false,
  suppressEmptyNode: true,
});

function encodeColumn(columnNumber: number): string {
  let current = columnNumber;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function decodeColumn(columnName: string): number {
  let result = 0;
  for (const char of columnName) result = result * 26 + (char.charCodeAt(0) - 64);
  return result;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function monthDayCount(month: string): number {
  const [yearText, monthText] = month.split("-");
  return new Date(Date.UTC(Number(yearText), Number(monthText), 0)).getUTCDate();
}

function excelSerialUtc(year: number, month: number, day: number): number {
  const excelEpochUtc = Date.UTC(1899, 11, 30);
  const dateUtc = Date.UTC(year, month - 1, day);
  return Math.round((dateUtc - excelEpochUtc) / 86_400_000);
}

function buildMonthDisplayName(month: string): string {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1));
  return new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "UTC" }).format(date).toLocaleUpperCase("ru-RU");
}

function clearCell(cell: WorksheetCell) {
  delete cell["@_t"];
  delete cell.v;
  delete cell.f;
  delete cell.is;
}

function setInlineString(cell: WorksheetCell, value: string) {
  clearCell(cell);
  if (!value) return;
  cell["@_t"] = "inlineStr";
  cell.is = { t: { "#text": value, "@_xml:space": "preserve" } };
}

function setNumberCell(cell: WorksheetCell, value: number | null) {
  clearCell(cell);
  if (value === null || !Number.isFinite(value)) return;
  cell.v = String(value);
}

function sortCells(cells: WorksheetCell[]): WorksheetCell[] {
  return cells.sort(
    (left, right) => decodeColumn(left["@_r"].replace(/\d+/g, "")) - decodeColumn(right["@_r"].replace(/\d+/g, ""))
  );
}

function getCell(row: WorksheetRow, columnName: string): WorksheetCell {
  const rowNumber = Number(row["@_r"]);
  const cells = toArray(row.c);
  const address = `${columnName}${rowNumber}`;
  const existing = cells.find((cell) => cell["@_r"] === address);
  if (existing) return existing;

  const created: WorksheetCell = { "@_r": address };
  row.c = sortCells([...cells, created]);
  return created;
}

function getRows(document: WorksheetDocument): WorksheetRow[] {
  const rows = toArray(document.worksheet.sheetData.row);
  document.worksheet.sheetData.row = rows;
  return rows;
}

function getRowMap(document: WorksheetDocument): Map<number, WorksheetRow> {
  return new Map(getRows(document).map((row) => [Number(row["@_r"]), row]));
}

function expandColumns(document: WorksheetDocument): WorksheetCol[] {
  const definitions = toArray(document.worksheet.cols?.col);
  const expanded = new Map<number, WorksheetCol>();

  for (const definition of definitions) {
    const min = Number(definition["@_min"]);
    const max = Number(definition["@_max"]);

    for (let index = min; index <= max; index += 1) {
      expanded.set(index, {
        ...definition,
        "@_min": String(index),
        "@_max": String(index),
      });
    }
  }

  return Array.from(expanded.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => value);
}

function applyHiddenDayColumns(document: WorksheetDocument, dayCount: number) {
  const columns = expandColumns(document);

  for (const column of columns) {
    const index = Number(column["@_min"]);
    const isExtraDayColumn = index >= 4 + dayCount && index <= 34;

    if (isExtraDayColumn) {
      column["@_hidden"] = "1";
    } else {
      delete column["@_hidden"];
    }
  }

  if (!document.worksheet.cols) document.worksheet.cols = { col: columns };
  else document.worksheet.cols.col = columns;
}

function sectionKey(discipline: DisciplineBucket, segment: SegmentBucket): string {
  return `${discipline}__${segment}`;
}

function buildGroupedRows(rows: MonthlyHoursRow[]): Map<string, MonthlyHoursRow[]> {
  const grouped = new Map<string, MonthlyHoursRow[]>();

  for (const row of rows) {
    const key = sectionKey(row.discipline, row.segment);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  return grouped;
}

function validateTemplateCapacity(rows: MonthlyHoursRow[]) {
  const grouped = buildGroupedRows(rows);

  const sharedMobilization = grouped.get(sectionKey("Shared", "Mobilization")) ?? [];
  if (sharedMobilization.length > 0) {
    throw new Error("Template has no Shared/Mobilization block, but live data contains Shared/Mobilization personnel.");
  }
}

function cloneRow(row: WorksheetRow, newRowNumber: number): WorksheetRow {
  const cloned = JSON.parse(JSON.stringify(row)) as WorksheetRow;
  cloned["@_r"] = String(newRowNumber);
  cloned.c = toArray(cloned.c).map((cell) => ({
    ...cell,
    "@_r": `${cell["@_r"].replace(/\d+/g, "")}${newRowNumber}`,
  }));
  return cloned;
}

function shiftRow(row: WorksheetRow, delta: number) {
  const nextRowNumber = Number(row["@_r"]) + delta;
  row["@_r"] = String(nextRowNumber);
  row.c = toArray(row.c).map((cell) => ({
    ...cell,
    "@_r": `${cell["@_r"].replace(/\d+/g, "")}${nextRowNumber}`,
  }));
}

function resolveTemplateBlocks(document: WorksheetDocument, rows: MonthlyHoursRow[]): ResolvedTemplateBlock[] {
  const grouped = buildGroupedRows(rows);
  const sheetRows = getRows(document);
  let rowOffset = 0;

  return TEMPLATE_BLOCKS.map((block) => {
    const startRow = block.startRow + rowOffset;
    const endRow = block.endRow + rowOffset;
    const required = grouped.get(sectionKey(block.discipline, block.segment))?.length ?? 0;
    const capacity = endRow - startRow + 1;
    const extraRows = Math.max(0, required - capacity);

    if (extraRows > 0) {
      const insertionIndex = sheetRows.findIndex((row) => Number(row["@_r"]) > endRow);
      const sourceRow = sheetRows.find((row) => Number(row["@_r"]) === endRow);
      if (!sourceRow) throw new Error(`Template row ${endRow} is missing.`);

      const clones = Array.from({ length: extraRows }, (_, index) => cloneRow(sourceRow, endRow + index + 1));

      for (const row of sheetRows) {
        if (Number(row["@_r"]) > endRow) shiftRow(row, extraRows);
      }

      if (insertionIndex === -1) sheetRows.push(...clones);
      else sheetRows.splice(insertionIndex, 0, ...clones);
      rowOffset += extraRows;
    }

    return {
      ...block,
      startRow,
      endRow: endRow + extraRows,
    };
  });
}

function updateDimension(document: WorksheetDocument) {
  const rows = getRows(document);
  const lastRowNumber = rows.reduce((max, row) => Math.max(max, Number(row["@_r"])), 0);
  const dimension = document.worksheet.dimension as { "@_ref"?: string } | undefined;
  if (!dimension?.["@_ref"]) return;

  const [startRef, endRef = startRef] = dimension["@_ref"].split(":");
  const endColumn = endRef.replace(/\d+/g, "") || endRef;
  dimension["@_ref"] = `${startRef}:${endColumn}${lastRowNumber}`;
}

function clearTemplatePersonRow(row: WorksheetRow) {
  for (const columnName of ["B", "C", ...TEMPLATE_DAY_COLUMNS, TOTAL_COLUMN]) {
    clearCell(getCell(row, columnName));
  }
}

function populateTemplatePersonRow(row: WorksheetRow, source: MonthlyHoursRow, dayCount: number) {
  setInlineString(getCell(row, "B"), source.employee_id);
  setInlineString(getCell(row, "C"), source.full_name);

  for (let day = 1; day <= 31; day += 1) {
    const columnName = TEMPLATE_DAY_COLUMNS[day - 1];
    const cell = getCell(row, columnName);
    const dayKey = String(day).padStart(2, "0");
    const hours = day <= dayCount ? source.days[dayKey] ?? null : null;
    setNumberCell(cell, hours);
  }

  setNumberCell(getCell(row, TOTAL_COLUMN), source.total_hours || null);
}

function populateTemplateBlocks(
  document: WorksheetDocument,
  rows: MonthlyHoursRow[],
  dayCount: number,
  blocks: ResolvedTemplateBlock[]
) {
  const grouped = buildGroupedRows(rows);
  const rowMap = getRowMap(document);

  for (const block of blocks) {
    const sectionRows = grouped.get(sectionKey(block.discipline, block.segment)) ?? [];
    const capacity = block.endRow - block.startRow + 1;

    for (let offset = 0; offset < capacity; offset += 1) {
      const templateRow = rowMap.get(block.startRow + offset);
      if (!templateRow) throw new Error(`Template row ${block.startRow + offset} is missing.`);

      const source = sectionRows[offset];
      if (!source) clearTemplatePersonRow(templateRow);
      else populateTemplatePersonRow(templateRow, source, dayCount);
    }
  }
}

function updateTemplateHeaders(document: WorksheetDocument, projectCode: string, month: string, dayCount: number) {
  const rowMap = getRowMap(document);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  const titleRow = rowMap.get(3);
  const monthRow = rowMap.get(5);
  const dayHeaderRow = rowMap.get(6);
  const topRow = rowMap.get(1);

  if (!titleRow || !monthRow || !dayHeaderRow || !topRow) {
    throw new Error("Monthly export template is missing required header rows.");
  }

  setInlineString(getCell(titleRow, "B"), `${projectCode} Montly Personal Report`);
  setInlineString(getCell(monthRow, "D"), buildMonthDisplayName(month));

  for (let day = 1; day <= 31; day += 1) {
    const columnName = TEMPLATE_DAY_COLUMNS[day - 1];
    const cell = getCell(dayHeaderRow, columnName);
    if (day <= dayCount) setNumberCell(cell, excelSerialUtc(year, monthNumber, day));
    else clearCell(cell);
  }

  setInlineString(getCell(dayHeaderRow, TOTAL_COLUMN), "Total hours");

  const generationDate = new Date();
  const generationSerial = excelSerialUtc(
    generationDate.getUTCFullYear(),
    generationDate.getUTCMonth() + 1,
    generationDate.getUTCDate()
  );

  if (dayCount < 31) {
    const labelStyle = getCell(topRow, DATE_LABEL_SOURCE_COLUMN)["@_s"];
    const valueStyle = getCell(topRow, DATE_VALUE_SOURCE_COLUMN)["@_s"];
    const targetLabel = getCell(topRow, DATE_LABEL_TARGET_COLUMN);
    const targetValue = getCell(topRow, DATE_VALUE_TARGET_COLUMN);

    if (labelStyle) targetLabel["@_s"] = labelStyle;
    if (valueStyle) targetValue["@_s"] = valueStyle;

    setInlineString(targetLabel, DATE_LABEL_TEXT);
    setNumberCell(targetValue, generationSerial);
    clearCell(getCell(topRow, DATE_LABEL_SOURCE_COLUMN));
    clearCell(getCell(topRow, DATE_VALUE_SOURCE_COLUMN));
  } else {
    setInlineString(getCell(topRow, DATE_LABEL_SOURCE_COLUMN), DATE_LABEL_TEXT);
    setNumberCell(getCell(topRow, DATE_VALUE_SOURCE_COLUMN), generationSerial);
    clearCell(getCell(topRow, DATE_LABEL_TARGET_COLUMN));
    clearCell(getCell(topRow, DATE_VALUE_TARGET_COLUMN));
  }
}

function buildWorksheetXml(document: WorksheetDocument): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${XML_BUILDER.build(document)}`;
}

export async function buildMonthlyTemplateWorkbook(
  projectCode: string,
  month: string,
  rows: MonthlyHoursRow[]
): Promise<Buffer> {
  validateTemplateCapacity(rows);

  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  const sheetXmlFile = zip.file(TEMPLATE_SHEET_XML);

  if (!sheetXmlFile) throw new Error("Monthly export template sheet is missing.");

  const worksheetXml = await sheetXmlFile.async("string");
  const worksheetDocument = XML_PARSER.parse(worksheetXml) as WorksheetDocument;
  const dayCount = monthDayCount(month);
  const resolvedBlocks = resolveTemplateBlocks(worksheetDocument, rows);

  applyHiddenDayColumns(worksheetDocument, dayCount);
  updateTemplateHeaders(worksheetDocument, projectCode, month, dayCount);
  populateTemplateBlocks(worksheetDocument, rows, dayCount, resolvedBlocks);
  updateDimension(worksheetDocument);

  zip.file(TEMPLATE_SHEET_XML, buildWorksheetXml(worksheetDocument));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
