import * as XLSX from "xlsx";

export type FieldReportItemInput = {
  row_no: number;
  zone: string | null;
  floor: string | null;
  system: string | null;
  activity_code: string | null;
  material_code: string | null;
  item_name: string | null;
  unit: string | null;
  qty: number | null;
  notes: string | null;
};

export type ParsedInstallationWorkbook = {
  worksheet: string;
  headerRow: number;
  summary: Record<string, unknown>;
  items: FieldReportItemInput[];
};

type HeaderIndices = {
  itemName: number | null;
  qty: number | null;
  unit: number | null;
  zone: number | null;
  floor: number | null;
  system: number | null;
  activityCode: number | null;
  materialCode: number | null;
  notes: number | null;
};

type HeaderCandidate = {
  worksheet: string;
  rowIndex: number;
  score: number;
  indices: HeaderIndices;
};

const HEADER_ALIASES: Record<keyof HeaderIndices, string[]> = {
  itemName: [
    "ВЫПОЛНЕННЫЕ РАБОТЫ",
    "НАИМЕНОВАНИЕ",
    "МАТЕРИАЛ",
    "WORK NAME",
    "DESCRIPTION",
    "İMALATIN TANIMI",
    "IMALATIN TANIMI",
  ],
  qty: ["ВЫПОЛНЕННЫЙ ОБЪЕМ", "ОБЪЕМ", "QTY", "QUANTITY", "METRAJ", "КОЛИЧЕСТВО"],
  unit: ["ЕД. ИЗМ", "ЕД ИЗМ", "BIRIM", "BİRİM", "UNIT", "UOM"],
  zone: ["ЗОНА", "ZONE", "BÖLGE", "BOLGE"],
  floor: ["ЭТАЖ", "FLOOR", "KAT"],
  system: ["СИСТЕМА", "SYSTEM"],
  activityCode: ["AKTIVITE KODU", "ACTIVITY CODE", "AKTIVITE", "АКТИВИТЕ КОДУ", "AC"],
  materialCode: ["MATERIAL CODE", "МАТЕРИАЛ КОД", "КОД МАТЕРИАЛА", "MC"],
  notes: ["ПРИМЕЧАНИЕ", "NOTES", "NOTE", "AÇIKLAMA", "ACIKLAMA"],
};

function normalizeText(value: unknown): string {
  const raw = String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function toText(value: unknown): string {
  const text = String(value ?? "").replace(/\u00A0/g, " ").trim();
  return text || "";
}

function toNumber(value: unknown): number | null {
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
  return Number.isFinite(parsed) ? parsed : null;
}

function findColumnIndex(row: unknown[], aliases: string[]): number | null {
  const normalizedAliases = aliases.map((alias) => normalizeText(alias));
  for (let idx = 0; idx < row.length; idx += 1) {
    const cell = normalizeText(row[idx]);
    if (!cell) continue;
    if (normalizedAliases.some((alias) => cell === alias || cell.includes(alias))) {
      return idx;
    }
  }
  return null;
}

function scoreHeader(indices: HeaderIndices): number {
  let score = 0;
  if (indices.itemName !== null) score += 5;
  if (indices.qty !== null) score += 4;
  if (indices.unit !== null) score += 3;
  if (indices.zone !== null) score += 1;
  if (indices.floor !== null) score += 1;
  if (indices.system !== null) score += 1;
  if (indices.activityCode !== null) score += 1;
  if (indices.materialCode !== null) score += 1;
  if (indices.notes !== null) score += 1;
  return score;
}

function detectBestHeader(worksheet: string, rows: unknown[][]): HeaderCandidate | null {
  const maxScan = Math.min(80, rows.length);
  let best: HeaderCandidate | null = null;

  for (let rowIndex = 0; rowIndex < maxScan; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const indices: HeaderIndices = {
      itemName: findColumnIndex(row, HEADER_ALIASES.itemName),
      qty: findColumnIndex(row, HEADER_ALIASES.qty),
      unit: findColumnIndex(row, HEADER_ALIASES.unit),
      zone: findColumnIndex(row, HEADER_ALIASES.zone),
      floor: findColumnIndex(row, HEADER_ALIASES.floor),
      system: findColumnIndex(row, HEADER_ALIASES.system),
      activityCode: findColumnIndex(row, HEADER_ALIASES.activityCode),
      materialCode: findColumnIndex(row, HEADER_ALIASES.materialCode),
      notes: findColumnIndex(row, HEADER_ALIASES.notes),
    };
    const score = scoreHeader(indices);
    const valid = indices.itemName !== null && (indices.qty !== null || indices.unit !== null);
    if (!valid) continue;

    if (!best || score > best.score) {
      best = { worksheet, rowIndex, score, indices };
    }
  }

  return best;
}

function pick(row: unknown[], index: number | null): unknown {
  if (index === null) return null;
  return row[index];
}

function extractCode(source: string, prefix: "AC" | "MC"): string | null {
  const regex = new RegExp(`\\b${prefix}\\s*[:\\-]?\\s*([A-Z0-9_.\\-/]+)\\b`, "i");
  const match = source.match(regex);
  return match?.[1] ? match[1].toUpperCase() : null;
}

function parseContextToken(raw: string, keys: string[]): string | null {
  const lowered = raw.toLowerCase();
  for (const key of keys) {
    const idx = lowered.indexOf(key);
    if (idx >= 0) {
      const token = raw.slice(idx + key.length).replace(/^[:\-\s]+/, "").trim();
      if (token) return token;
    }
  }
  return null;
}

function applySectionContext(raw: string, state: { zone: string | null; floor: string | null; system: string | null }) {
  const zone = parseContextToken(raw, ["зона", "zone", "bolge", "bölge"]);
  const floor = parseContextToken(raw, ["этаж", "floor", "kat"]);
  const system = parseContextToken(raw, ["система", "system"]);
  if (zone) state.zone = zone;
  if (floor) state.floor = floor;
  if (system) state.system = system;
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text ? text : null;
}

export function parseInstallationXlsx(buffer: Buffer): ParsedInstallationWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  let best: HeaderCandidate | null = null;
  let bestRows: unknown[][] | null = null;

  for (const worksheet of workbook.SheetNames) {
    const sheet = workbook.Sheets[worksheet];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: true,
      raw: false,
    }) as unknown[][];

    const candidate = detectBestHeader(worksheet, rows);
    if (!candidate) continue;
    if (!best || candidate.score > best.score) {
      best = candidate;
      bestRows = rows;
    }
  }

  if (!best || !bestRows) {
    throw new Error("Could not locate installation table headers in workbook.");
  }

  const state = { zone: null as string | null, floor: null as string | null, system: null as string | null };
  const items: FieldReportItemInput[] = [];
  let blankStreak = 0;
  let rowNo = 0;

  for (let idx = best.rowIndex + 1; idx < bestRows.length; idx += 1) {
    const row = bestRows[idx] || [];
    const itemNameText = toText(pick(row, best.indices.itemName));
    const qty = toNumber(pick(row, best.indices.qty));
    const unit = toNullableText(pick(row, best.indices.unit));
    const zoneCol = toNullableText(pick(row, best.indices.zone));
    const floorCol = toNullableText(pick(row, best.indices.floor));
    const systemCol = toNullableText(pick(row, best.indices.system));
    const activityCol = toNullableText(pick(row, best.indices.activityCode));
    const materialCol = toNullableText(pick(row, best.indices.materialCode));
    const notesCol = toNullableText(pick(row, best.indices.notes));

    const hasCoreData =
      Boolean(itemNameText) ||
      qty !== null ||
      Boolean(unit) ||
      Boolean(zoneCol) ||
      Boolean(floorCol) ||
      Boolean(systemCol) ||
      Boolean(activityCol) ||
      Boolean(materialCol);

    if (!hasCoreData) {
      blankStreak += 1;
      if (blankStreak >= 15) break;
      continue;
    }
    blankStreak = 0;

    const isSectionHeader =
      Boolean(itemNameText) &&
      qty === null &&
      !unit &&
      !activityCol &&
      !materialCol &&
      !zoneCol &&
      !floorCol &&
      !systemCol &&
      itemNameText.length > 2;

    if (isSectionHeader) {
      applySectionContext(itemNameText, state);
      continue;
    }

    const activityCode = activityCol || extractCode(itemNameText, "AC");
    const materialCode = materialCol || extractCode(itemNameText, "MC");

    rowNo += 1;
    items.push({
      row_no: rowNo,
      zone: zoneCol || state.zone,
      floor: floorCol || state.floor,
      system: systemCol || state.system,
      activity_code: activityCode || null,
      material_code: materialCode || null,
      item_name: itemNameText || null,
      unit,
      qty,
      notes: notesCol,
    });
  }

  if (!items.length) {
    throw new Error("Installation table was detected but no data rows were parsed.");
  }

  const totalsByZone: Record<string, number> = {};
  const totalsBySystem: Record<string, number> = {};
  const totalsByFloor: Record<string, number> = {};
  const totalsByDiscipline: Record<string, number> = {
    Electrical: 0,
    Mechanical: 0,
    Shared: 0,
    Unknown: 0,
  };
  let totalQty = 0;

  for (const item of items) {
    const qty = item.qty ?? 0;
    totalQty += qty;

    if (item.zone) totalsByZone[item.zone] = (totalsByZone[item.zone] || 0) + qty;
    if (item.system) totalsBySystem[item.system] = (totalsBySystem[item.system] || 0) + qty;
    if (item.floor) totalsByFloor[item.floor] = (totalsByFloor[item.floor] || 0) + qty;

    const code = (item.activity_code || item.material_code || "").toUpperCase();
    if (/(EOM|EL|ELEC|SS)/.test(code)) totalsByDiscipline.Electrical += qty;
    else if (/(MECH|OV|VK|HVAC)/.test(code)) totalsByDiscipline.Mechanical += qty;
    else if (/(CIV|SHARED|GEN)/.test(code)) totalsByDiscipline.Shared += qty;
    else totalsByDiscipline.Unknown += qty;
  }

  return {
    worksheet: best.worksheet,
    headerRow: best.rowIndex + 1,
    summary: {
      itemCount: items.length,
      totalQty,
      totalsByZone,
      totalsByFloor,
      totalsBySystem,
      totalsByDiscipline,
    },
    items,
  };
}

