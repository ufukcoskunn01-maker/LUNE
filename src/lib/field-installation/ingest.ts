import * as XLSX from "xlsx";

export type ParsedInstallationRow = {
  row_no: number;
  report_date: string | null;
  install_action: string | null;
  location: string | null;
  zone: string | null;
  floor: string | null;
  elevation: string | null;
  team_no: number | null;
  budget_code: string | null;
  activity_code: string | null;
  description: string | null;
  unit: string | null;
  qty: number | null;
  manhours: number | null;
  project_name: string | null;
  orientation: string | null;
  comment: string | null;
  raw: Record<string, unknown>;
};

export type ParsedInstallationSummary = {
  material_total_mh: number;
  people_total_mh: number;
  indirect_total_mh: number;
  direct_total_mh: number;
  delta_mh: number;
  efficiency_score: number;
  is_mismatch: boolean;
  warnings: string[];
  report_date: string | null;
};

export type ParsedInstallationWorkbook = {
  rows: ParsedInstallationRow[];
  summary: ParsedInstallationSummary;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\u00A0/g, " ").trim();
  return text ? text : null;
}

function toNumber(value: unknown): number | null {
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

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = toText(value);
  if (!text) return null;

  const ymd = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }

  const dmy = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
  if (dmy) {
    const yy = Number(dmy[3]);
    const year = yy < 100 ? 2000 + yy : yy;
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const maybeDate = new Date(text);
  if (!Number.isNaN(maybeDate.getTime())) return maybeDate.toISOString().slice(0, 10);
  return null;
}

function findSheet(workbook: XLSX.WorkBook, aliases: string[]): XLSX.WorkSheet | null {
  const wanted = aliases.map(normalizeText);
  for (const name of workbook.SheetNames) {
    const normalized = normalizeText(name);
    if (wanted.some((alias) => normalized.includes(alias))) {
      return workbook.Sheets[name] || null;
    }
  }
  return null;
}

function isMaterialRowEmpty(row: unknown[]): boolean {
  for (let i = 0; i <= 15; i += 1) {
    if (toText(row[i]) !== null || toNumber(row[i]) !== null) return false;
  }
  return true;
}

function parseMaterialRows(sheet: XLSX.WorkSheet, targetWorkDate?: string): {
  rows: ParsedInstallationRow[];
  materialTotalMh: number;
  reportDate: string | null;
} {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  const rows: ParsedInstallationRow[] = [];
  let rowNo = 0;
  let materialTotalMh = 0;
  let blankStreak = 0;

  const reportDateFromB3 = matrix[2]?.[1] ? toIsoDate(matrix[2][1]) : null;

  for (let r = 3; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    if (isMaterialRowEmpty(row)) {
      blankStreak += 1;
      if (blankStreak >= 15) break;
      continue;
    }
    blankStreak = 0;

    const rowDate = toIsoDate(row[1]);
    if (targetWorkDate && rowDate !== targetWorkDate) {
      continue;
    }

    rowNo += 1;
    const manhours = toNumber(row[12]);
    if (manhours !== null) materialTotalMh += manhours;

    rows.push({
      row_no: rowNo,
      report_date: rowDate,
      install_action: toText(row[2]),
      location: toText(row[3]),
      zone: toText(row[4]),
      floor: toText(row[5]),
      elevation: toText(row[6]),
      team_no: toNumber(row[7]),
      budget_code: toText(row[8]),
      activity_code: toText(row[8]),
      description: toText(row[9]),
      unit: toText(row[10]),
      qty: toNumber(row[11]),
      manhours,
      project_name: toText(row[13]),
      orientation: toText(row[14]),
      comment: toText(row[15]),
      raw: {
        no: row[0],
        report_date: row[1],
        install_action: row[2],
        location: row[3],
        zone: row[4],
        floor: row[5],
        elevation: row[6],
        team_no: row[7],
        budget_code: row[8],
        description: row[9],
        unit: row[10],
        qty: row[11],
        manhours: row[12],
        project_name: row[13],
        orientation: row[14],
        comment: row[15],
      },
    });
  }

  const firstRowDate = rows.find((row) => row.report_date)?.report_date || null;
  return {
    rows,
    materialTotalMh: Number(materialTotalMh.toFixed(3)),
    reportDate: reportDateFromB3 || firstRowDate,
  };
}

function parsePeopleSheet(sheet: XLSX.WorkSheet, targetWorkDate?: string): {
  peopleTotalMh: number;
  indirectTotalMh: number;
  directTotalMh: number;
} {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  let peopleTotalMh = 0;
  let indirectTotalMh = 0;
  let directTotalMh = 0;
  let blankStreak = 0;

  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r] || [];
    const rowDate = toIsoDate(row[1]);
    const employeeId = toText(row[3]);
    const fullName = toText(row[4]);
    const indirect = toNumber(row[6]) || 0;
    const direct = toNumber(row[7]) || 0;

    const hasData = Boolean(employeeId) || Boolean(fullName) || indirect !== 0 || direct !== 0;
    if (!hasData) {
      blankStreak += 1;
      if (blankStreak >= 15) break;
      continue;
    }
    blankStreak = 0;

    if (targetWorkDate && rowDate !== targetWorkDate) {
      continue;
    }

    indirectTotalMh += indirect;
    directTotalMh += direct;
    peopleTotalMh += indirect + direct;
  }

  return {
    peopleTotalMh: Number(peopleTotalMh.toFixed(3)),
    indirectTotalMh: Number(indirectTotalMh.toFixed(3)),
    directTotalMh: Number(directTotalMh.toFixed(3)),
  };
}

export function parseFieldInstallationWorkbook(buffer: Buffer, fileWorkDate: string): ParsedInstallationWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const warnings: string[] = [];

  const materialSheet = findSheet(workbook, ["линия материал", "field material"]);
  if (!materialSheet) {
    throw new Error('Material sheet "ЛИНИЯ Материал" not found.');
  }

  const peopleSheet = findSheet(workbook, ["линия чел", "чел.-час", "чел час", "field manhour"]);
  if (!peopleSheet) {
    throw new Error('People sheet "ЛИНИЯ Чел.-Час." not found.');
  }

  const material = parseMaterialRows(materialSheet, fileWorkDate);
  const people = parsePeopleSheet(peopleSheet, fileWorkDate);

  if (material.reportDate && material.reportDate !== fileWorkDate) {
    warnings.push(`Report date mismatch: sheet=${material.reportDate}, file=${fileWorkDate}`);
  }

  const delta = Number((material.materialTotalMh - people.directTotalMh).toFixed(3));
  const absDelta = Math.abs(delta);
  const isMismatch = absDelta > 0.5;
  if (isMismatch) {
    warnings.push(`Manhour mismatch: material=${material.materialTotalMh}, direct=${people.directTotalMh}, delta=${delta}`);
  }

  const denominator = Math.max(material.materialTotalMh, people.directTotalMh, 1);
  const efficiency = isMismatch ? Math.max(0, 100 * (1 - absDelta / denominator)) : 100;

  return {
    rows: material.rows,
    summary: {
      material_total_mh: material.materialTotalMh,
      people_total_mh: people.directTotalMh,
      indirect_total_mh: people.indirectTotalMh,
      direct_total_mh: people.directTotalMh,
      delta_mh: delta,
      efficiency_score: Number(efficiency.toFixed(2)),
      is_mismatch: isMismatch,
      warnings,
      report_date: material.reportDate,
    },
  };
}
