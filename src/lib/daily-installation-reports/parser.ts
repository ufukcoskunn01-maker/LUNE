import * as XLSX from "xlsx";
import type { NormalizedDailyInstallationItem, NormalizedDailyInstallationReport } from "@/lib/daily-installation-reports/types";

type HeaderMap = {
  category: number | null;
  itemCode: number | null;
  itemName: number | null;
  unit: number | null;
  plannedQty: number | null;
  actualQty: number | null;
  cumulativeQty: number | null;
  remarks: number | null;
};

type HeaderCandidate = {
  sheetName: string;
  rowIndex: number;
  score: number;
  map: HeaderMap;
};

const HEADER_ALIASES: Record<keyof HeaderMap, string[]> = {
  category: ["category", "discipline", "group", "section", "kategori"],
  itemCode: ["item code", "code", "material code", "activity code", "kod"],
  itemName: ["item name", "description", "work name", "material", "name", "naimenovanie", "imalatin tanimi"],
  unit: ["unit", "uom", "birim", "ed izm"],
  plannedQty: ["planned qty", "plan qty", "plan", "planned", "proje"],
  actualQty: ["actual qty", "qty", "quantity", "metraj", "obem", "fakt"],
  cumulativeQty: ["cumulative qty", "cumulative", "total qty", "toplam"],
  remarks: ["remarks", "note", "notes", "comment", "aciklama", "primechanie"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ");
}

function toText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\u00A0/g, " ").trim();
  return text || null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;

  let normalized = text.replace(/\u00A0/g, "").replace(/\s+/g, "");
  const comma = normalized.includes(",");
  const dot = normalized.includes(".");
  if (comma && dot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (comma) {
    normalized = normalized.replace(/,/g, ".");
  }
  normalized = normalized.replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (decoded?.y && decoded?.m && decoded?.d) {
      return `${String(decoded.y).padStart(4, "0")}-${String(decoded.m).padStart(2, "0")}-${String(decoded.d).padStart(2, "0")}`;
    }
  }
  const text = String(value ?? "").trim();
  if (!text) return null;

  const ymd = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;

  const dmy = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
  if (dmy) {
    const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return `${String(year).padStart(4, "0")}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function findColumn(row: unknown[], aliases: string[]): number | null {
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));
  for (let i = 0; i < row.length; i += 1) {
    const cell = normalizeHeader(row[i]);
    if (!cell) continue;
    if (normalizedAliases.some((alias) => cell === alias || cell.includes(alias))) return i;
  }
  return null;
}

function scoreHeader(map: HeaderMap): number {
  let score = 0;
  if (map.itemName !== null) score += 5;
  if (map.actualQty !== null) score += 4;
  if (map.unit !== null) score += 3;
  if (map.itemCode !== null) score += 2;
  if (map.category !== null) score += 1;
  if (map.plannedQty !== null) score += 1;
  if (map.cumulativeQty !== null) score += 1;
  if (map.remarks !== null) score += 1;
  return score;
}

function detectTemplateHeader(sheetName: string, rows: unknown[][]): HeaderCandidate | null {
  let best: HeaderCandidate | null = null;
  const maxRows = Math.min(rows.length, 80);
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const map: HeaderMap = {
      category: findColumn(row, HEADER_ALIASES.category),
      itemCode: findColumn(row, HEADER_ALIASES.itemCode),
      itemName: findColumn(row, HEADER_ALIASES.itemName),
      unit: findColumn(row, HEADER_ALIASES.unit),
      plannedQty: findColumn(row, HEADER_ALIASES.plannedQty),
      actualQty: findColumn(row, HEADER_ALIASES.actualQty),
      cumulativeQty: findColumn(row, HEADER_ALIASES.cumulativeQty),
      remarks: findColumn(row, HEADER_ALIASES.remarks),
    };
    const valid = map.itemName !== null && (map.actualQty !== null || map.unit !== null);
    if (!valid) continue;
    const score = scoreHeader(map);
    if (!best || score > best.score) best = { sheetName, rowIndex, score, map };
  }
  return best;
}

function pick(row: unknown[], index: number | null): unknown {
  return index === null ? null : row[index];
}

function extractMeta(rows: unknown[][]): {
  reportDate: string | null;
  reportTitle: string | null;
  contractorName: string | null;
  zone: string | null;
  floor: string | null;
} {
  const probe = rows.slice(0, 12).flat().map((value) => String(value ?? "").trim()).filter(Boolean);
  let reportDate: string | null = null;
  let reportTitle: string | null = null;
  let contractorName: string | null = null;
  let zone: string | null = null;
  let floor: string | null = null;

  for (const value of probe) {
    const lowered = value.toLowerCase();
    if (!reportDate) reportDate = toIsoDate(value);
    if (!reportTitle && (lowered.includes("daily") || lowered.includes("installation") || lowered.includes("report"))) {
      reportTitle = value;
    }
    if (!contractorName && (lowered.includes("contractor") || lowered.includes("subcontractor"))) {
      contractorName = value.split(":").slice(1).join(":").trim() || value;
    }
    if (!zone && lowered.startsWith("zone")) zone = value.split(":").slice(1).join(":").trim() || value;
    if (!floor && lowered.startsWith("floor")) floor = value.split(":").slice(1).join(":").trim() || value;
  }

  return { reportDate, reportTitle, contractorName, zone, floor };
}

export function parseDailyInstallationWorkbook(buffer: Buffer): NormalizedDailyInstallationReport {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  let best: HeaderCandidate | null = null;
  let bestRows: unknown[][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    }) as unknown[][];
    const candidate = detectTemplateHeader(sheetName, rows);
    if (!candidate) continue;
    if (!best || candidate.score > best.score) {
      best = candidate;
      bestRows = rows;
    }
  }

  if (!best) {
    throw new Error("Could not detect a supported installation report header.");
  }

  const meta = extractMeta(bestRows);
  const items: NormalizedDailyInstallationItem[] = [];
  let blankStreak = 0;
  let totalActualQty = 0;
  let totalPlannedQty = 0;
  let totalCumulativeQty = 0;
  const byCategory: Record<string, number> = {};

  for (let i = best.rowIndex + 1; i < bestRows.length; i += 1) {
    const row = bestRows[i] || [];
    const itemName = toText(pick(row, best.map.itemName));
    const itemCode = toText(pick(row, best.map.itemCode));
    const category = toText(pick(row, best.map.category));
    const unit = toText(pick(row, best.map.unit));
    const plannedQty = toNumber(pick(row, best.map.plannedQty));
    const actualQty = toNumber(pick(row, best.map.actualQty));
    const cumulativeQty = toNumber(pick(row, best.map.cumulativeQty));
    const remarks = toText(pick(row, best.map.remarks));

    const hasValue = Boolean(itemName || itemCode || category) || plannedQty !== null || actualQty !== null || cumulativeQty !== null;
    if (!hasValue) {
      blankStreak += 1;
      if (blankStreak >= 12) break;
      continue;
    }
    blankStreak = 0;

    if (!itemName) continue;

    const sortOrder = items.length + 1;
    items.push({
      sort_order: sortOrder,
      category,
      item_code: itemCode,
      item_name: itemName,
      unit,
      planned_qty: plannedQty,
      actual_qty: actualQty,
      cumulative_qty: cumulativeQty,
      remarks,
      raw_json: {
        row_index: i + 1,
        parsed_from_sheet: best.sheetName,
      },
    });

    totalPlannedQty += plannedQty || 0;
    totalActualQty += actualQty || 0;
    totalCumulativeQty += cumulativeQty || 0;
    if (category) byCategory[category] = (byCategory[category] || 0) + (actualQty || 0);
  }

  if (!items.length) {
    throw new Error("Report header detected but no item rows were parsed.");
  }

  return {
    report_date: meta.reportDate,
    report_title: meta.reportTitle,
    contractor_name: meta.contractorName,
    zone: meta.zone,
    floor: meta.floor,
    summary_json: {
      sheetName: best.sheetName,
      headerRow: best.rowIndex + 1,
      itemCount: items.length,
      totals: {
        plannedQty: totalPlannedQty,
        actualQty: totalActualQty,
        cumulativeQty: totalCumulativeQty,
      },
      totalsByCategory: byCategory,
    },
    items,
  };
}
