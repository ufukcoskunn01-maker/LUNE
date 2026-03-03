import crypto from "crypto";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

const INSTALLATION_FILE_RE = /-E-INS-(\d{6})_rev(\d+)\.xls[xm]$/i;
const LIST_LIMIT = 100;

type StorageListItem = {
  name?: string | null;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DiscoveredFieldFile = {
  projectCode: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  workDate: string;
  revision: number;
  lastModified: string | null;
  fileSize: number | null;
};

export type ParsedFieldRow = {
  rowIndex: number;
  budget_code: string | null;
  activity_code: string | null;
  description: string | null;
  unit: string | null;
  qty: number | null;
  zone: string | null;
  floor: string | null;
  crew: string | null;
  raw: Record<string, unknown>;
};

function normalizePrefix(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isLikelyFolder(item: StorageListItem): boolean {
  const name = String(item.name || "").trim();
  if (!name) return false;
  const metadata = item.metadata || {};
  if (
    typeof metadata.size === "number" ||
    typeof metadata.mimetype === "string" ||
    typeof metadata.eTag === "string"
  ) {
    return false;
  }
  return !/\.[a-z0-9]{1,8}$/i.test(name);
}

function parseYYMMDD(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const year = Number(`20${token.slice(0, 2)}`);
  const month = Number(token.slice(2, 4));
  const day = Number(token.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNumber(value: unknown): number | null {
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

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function findHeaderMap(rows: unknown[][]): { headerIndex: number; map: Record<string, number | null> } {
  const aliases: Record<string, string[]> = {
    budget_code: ["BUTCE KODU", "BUDGET CODE", "BUDGET", "BUTCE"],
    activity_code: ["AKTIVITE KODU", "ACTIVITY CODE", "AKTIVITE", "AKTIVITE KOD"],
    description: ["IMALATIN TANIMI", "DESCRIPTION", "ACIKLAMA", "ВЫПОЛНЕННЫЕ РАБОТЫ", "РАБОТЫ"],
    unit: ["BIRIM", "UNIT", "ЕД. ИЗМ", "ЕДИНИЦА", "UOM"],
    qty: ["METRAJ", "QTY", "QUANTITY", "ВЫПОЛНЕННЫЙ ОБЪЕМ", "OBEM", "MIKTAR"],
    zone: ["ZONE", "BOLGE", "ZONA"],
    floor: ["FLOOR", "KAT", "ЭТАЖ"],
    crew: ["CREW", "EKIP", "АДСА", "TOPLAM ADSA"],
  };

  let bestScore = -1;
  let bestIndex = 0;
  let bestMap: Record<string, number | null> = {
    budget_code: null,
    activity_code: null,
    description: null,
    unit: null,
    qty: null,
    zone: null,
    floor: null,
    crew: null,
  };

  const scanLimit = Math.min(rows.length, 80);
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const normalized = row.map((cell) => normalizeHeader(cell));
    const map: Record<string, number | null> = {};
    let score = 0;
    for (const [key, list] of Object.entries(aliases)) {
      const wanted = list.map((x) => normalizeHeader(x));
      let idx: number | null = null;
      for (let col = 0; col < normalized.length; col += 1) {
        const cell = normalized[col];
        if (!cell) continue;
        if (wanted.some((w) => cell === w || cell.includes(w))) {
          idx = col;
          break;
        }
      }
      map[key] = idx;
      if (idx !== null) score += key === "description" || key === "qty" ? 2 : 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
      bestMap = map;
    }
  }

  return { headerIndex: bestIndex, map: bestMap };
}

function pickSheetName(workbook: XLSX.WorkBook): string {
  const preferred = workbook.SheetNames.find((name) => /gunluk\s*rapor|günlük\s*rapor/i.test(name));
  return preferred || workbook.SheetNames[0];
}

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseRows(rows: unknown[][]): ParsedFieldRow[] {
  const { headerIndex, map } = findHeaderMap(rows);
  const result: ParsedFieldRow[] = [];
  let emptyStreak = 0;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const get = (key: string) => {
      const idx = map[key];
      return typeof idx === "number" ? row[idx] : null;
    };

    const description = asText(get("description")) || asText(row[1]) || asText(row[2]);
    const qty = parseNumber(get("qty")) ?? parseNumber(row[row.length - 1]);
    const budget = asText(get("budget_code"));
    const activity = asText(get("activity_code"));
    const unit = asText(get("unit"));
    const zone = asText(get("zone"));
    const floor = asText(get("floor"));
    const crew = asText(get("crew"));

    if (!description && qty === null && !budget && !activity) {
      emptyStreak += 1;
      if (emptyStreak >= 25) break;
      continue;
    }
    emptyStreak = 0;

    const raw: Record<string, unknown> = {};
    for (let col = 0; col < row.length; col += 1) {
      if (row[col] !== null && row[col] !== undefined && row[col] !== "") {
        raw[`c${col}`] = row[col] as unknown;
      }
    }

    result.push({
      rowIndex: i + 1,
      budget_code: budget,
      activity_code: activity,
      description,
      unit,
      qty,
      zone,
      floor,
      crew,
      raw,
    });
  }

  return result;
}

async function listAllAtPrefix(supabase: SupabaseClient, bucket: string, prefix: string): Promise<StorageListItem[]> {
  const rows: StorageListItem[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_LIMIT,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage list failed at ${prefix}: ${error.message}`);
    const batch = (data || []) as StorageListItem[];
    rows.push(...batch);
    if (batch.length < LIST_LIMIT) break;
    offset += LIST_LIMIT;
  }
  return rows;
}

export async function discoverFieldInstallationFiles(args: {
  supabase: SupabaseClient;
  bucket: string;
  projectCode: string;
  reportsPrefix: string;
  year?: number;
  month?: number;
}): Promise<DiscoveredFieldFile[]> {
  const rootPrefix = normalizePrefix(`${args.projectCode}/${args.reportsPrefix}`);
  const queue: Array<{ prefix: string; depth: number }> = [{ prefix: rootPrefix, depth: 0 }];
  const visited = new Set<string>();
  const files: DiscoveredFieldFile[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.prefix)) continue;
    visited.add(current.prefix);
    const rows = await listAllAtPrefix(args.supabase, args.bucket, current.prefix);

    for (const item of rows) {
      const name = String(item.name || "").trim();
      if (!name) continue;
      const childPath = `${current.prefix}/${name}`;

      if (isLikelyFolder(item)) {
        if (current.depth < 8) queue.push({ prefix: childPath, depth: current.depth + 1 });
        continue;
      }

      const match = name.match(INSTALLATION_FILE_RE);
      if (!match) continue;
      const workDate = parseYYMMDD(match[1]);
      if (!workDate) continue;
      const [y, m] = workDate.split("-").map(Number);
      if (args.year && y !== args.year) continue;
      if (args.month && m !== args.month) continue;

      const meta = item.metadata || {};
      files.push({
        projectCode: args.projectCode,
        storageBucket: args.bucket,
        storagePath: childPath,
        fileName: name,
        workDate,
        revision: Number(match[2] || 0),
        lastModified: (item.updated_at || item.created_at || null) as string | null,
        fileSize: typeof meta.size === "number" ? Math.trunc(meta.size) : null,
      });
    }
  }

  files.sort((a, b) => {
    if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
    if (a.revision !== b.revision) return a.revision - b.revision;
    return a.fileName.localeCompare(b.fileName);
  });
  return files;
}

export function sha256FromBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function parseInstallationWorkbook(buffer: Buffer): { rows: ParsedFieldRow[]; sheetName: string } {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: true });
  const sheetName = pickSheetName(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("No worksheet found in workbook.");
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false, raw: false }) as unknown[][];
  if (!rows.length) throw new Error("Worksheet is empty.");
  return { rows: parseRows(rows), sheetName };
}
