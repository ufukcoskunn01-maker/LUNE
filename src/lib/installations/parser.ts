import * as XLSX from "xlsx";

export type InstallationRowInput = {
  work_date: string;
  budget_code: string | null;
  activity_code: string | null;
  description: string | null;
  manhours: number | null;
  qty: number | null;
  uom: string | null;
  turk_count: number | null;
  local_count: number | null;
  turk_adsa: number | null;
  local_adsa: number | null;
};

export type ParsedInstallationResult = {
  worksheet: string;
  headerRow: number;
  parsedRows: number;
  rows: InstallationRowInput[];
};

type HeaderMap = {
  date: number | null;
  budget_code: number | null;
  activity_code: number | null;
  description: number | null;
  manhours: number | null;
  qty: number | null;
  uom: number | null;
  turk_count: number | null;
  local_count: number | null;
  turk_adsa: number | null;
  local_adsa: number | null;
};

type CandidateHeader = {
  worksheet: string;
  headerRowIndex0: number;
  map: HeaderMap;
};

const HEADER_KEYS: Record<keyof HeaderMap, string[]> = {
  date: ["TARIH", "DATE", "ДАТА"],
  budget_code: ["BUTCE KODU", "BÜTÇE KODU", "BUDGET KODU", "BUDGET CODE", "БЮДЖЕТ"],
  activity_code: ["AKTIVITE KODU", "AKTIVITEKODU", "ACTIVITY CODE", "КОД АКТИВИТЕ"],
  description: ["IMALATIN TANIMI", "İMALATIN TANIMI", "DESCRIPTION", "НАИМЕНОВАНИЕ", "ОПИСАНИЕ"],
  manhours: ["TOPLAM ADSA", "TOTAL ADSA", "ADSA"],
  qty: ["METRAJ", "QTY", "QUANTITY", "КОЛИЧЕСТВО"],
  uom: ["BIRIM", "BİRİM", "UNIT", "ЕД"],
  turk_count: ["TURK SAYISI", "TÜRK SAYISI"],
  local_count: ["YEREL SAYISI"],
  turk_adsa: ["TURK ADSA", "TÜRK ADSA"],
  local_adsa: ["YEREL ADSA"],
};

function normalizeText(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tryParseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw.replace(/\u00A0/g, "").replace(/\s+/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  normalized = normalized.replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function tryParseInt(value: unknown): number | null {
  const parsed = tryParseNumber(value);
  if (parsed === null) return null;
  return Math.trunc(parsed);
}

function tryParseDateIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function findColumn(headerRow: unknown[], aliases: string[]): number | null {
  const normalizedAliases = aliases.map((item) => normalizeText(item));
  for (let idx = 0; idx < headerRow.length; idx += 1) {
    const cell = normalizeText(headerRow[idx]);
    if (!cell) continue;
    if (normalizedAliases.some((alias) => cell === alias || cell.includes(alias))) {
      return idx;
    }
  }
  return null;
}

function detectHeaderCandidate(worksheet: string, rows: unknown[][]): CandidateHeader | null {
  const maxScan = Math.min(60, rows.length);
  for (let rowIndex = 0; rowIndex < maxScan; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const map: HeaderMap = {
      date: findColumn(row, HEADER_KEYS.date),
      budget_code: findColumn(row, HEADER_KEYS.budget_code),
      activity_code: findColumn(row, HEADER_KEYS.activity_code),
      description: findColumn(row, HEADER_KEYS.description),
      manhours: findColumn(row, HEADER_KEYS.manhours),
      qty: findColumn(row, HEADER_KEYS.qty),
      uom: findColumn(row, HEADER_KEYS.uom),
      turk_count: findColumn(row, HEADER_KEYS.turk_count),
      local_count: findColumn(row, HEADER_KEYS.local_count),
      turk_adsa: findColumn(row, HEADER_KEYS.turk_adsa),
      local_adsa: findColumn(row, HEADER_KEYS.local_adsa),
    };

    const hasActivity = map.activity_code !== null;
    const hasQtyOrUom = map.qty !== null || map.uom !== null;
    if (hasActivity && hasQtyOrUom) {
      return {
        worksheet,
        headerRowIndex0: rowIndex,
        map,
      };
    }
  }
  return null;
}

function getCell(row: unknown[], index: number | null): unknown {
  if (index === null) return null;
  return row[index];
}

function toTrimmedString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function parseInstallationWorkbook(buffer: Buffer, fallbackWorkDate: string): ParsedInstallationResult {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  let candidate: CandidateHeader | null = null;
  let candidateRows: unknown[][] | null = null;

  for (const worksheet of workbook.SheetNames) {
    const sheet = workbook.Sheets[worksheet];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: true,
      raw: false,
    }) as unknown[][];

    const detected = detectHeaderCandidate(worksheet, rows);
    if (detected) {
      candidate = detected;
      candidateRows = rows;
      break;
    }
  }

  if (!candidate || !candidateRows) {
    throw new Error("No worksheet with required installation headers found (AKTIVITE KODU + METRAJ/BIRIM).");
  }

  const rows: InstallationRowInput[] = [];
  const startRow = candidate.headerRowIndex0 + 1;

  for (let rowIndex = startRow; rowIndex < candidateRows.length; rowIndex += 1) {
    const row = candidateRows[rowIndex] || [];

    const activityCode = toTrimmedString(getCell(row, candidate.map.activity_code));
    const description = toTrimmedString(getCell(row, candidate.map.description));
    const qty = tryParseNumber(getCell(row, candidate.map.qty));

    if (!activityCode && !description && qty === null) {
      break;
    }

    const parsedWorkDate = tryParseDateIso(getCell(row, candidate.map.date));
    rows.push({
      work_date: parsedWorkDate || fallbackWorkDate,
      budget_code: toTrimmedString(getCell(row, candidate.map.budget_code)),
      activity_code: activityCode,
      description,
      manhours: tryParseNumber(getCell(row, candidate.map.manhours)),
      qty,
      uom: toTrimmedString(getCell(row, candidate.map.uom)),
      turk_count: tryParseInt(getCell(row, candidate.map.turk_count)),
      local_count: tryParseInt(getCell(row, candidate.map.local_count)),
      turk_adsa: tryParseNumber(getCell(row, candidate.map.turk_adsa)),
      local_adsa: tryParseNumber(getCell(row, candidate.map.local_adsa)),
    });
  }

  return {
    worksheet: candidate.worksheet,
    headerRow: candidate.headerRowIndex0 + 1,
    parsedRows: rows.length,
    rows,
  };
}
