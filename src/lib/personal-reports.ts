import { monthRange } from "@/lib/attendance-monthly-hours";

export const DEFAULT_PROJECT_CODE = "A27";

export type AttendanceStatus = "Present" | "Absent" | "Unknown";
export type PatCode = "P" | "A" | "U";
export type ReportSegment = "Indirect" | "Direct" | "Mobilization";
export type ReportDiscipline = "Electrical" | "Mechanical" | "Shared";
export type ReportDisciplineOrTotal = ReportDiscipline | "Total";

export type PersonalReportRow = {
  rowKey: string;
  employeeId: string | null;
  fullName: string;
  company: string | null;
  segment: ReportSegment;
  discipline: ReportDiscipline;
  status: AttendanceStatus;
  pat: PatCode;
  absenceReason: string | null;
  professionActual: string | null;
  professionOfficial: string | null;
};

export type PatCounts = {
  present: number;
  absent: number;
  total: number;
};

export type SummaryMatrix = Record<ReportSegment, Record<ReportDisciplineOrTotal, PatCounts>>;

export type PivotRow = {
  profession: string;
  companyCount: number;
  present: number;
  absent: number;
  total: number;
};

export type MonthlyPersonnelPoint = {
  date: string;
  day: number;
  present: number;
  absent: number;
  total: number;
};

export type PersonalReportsData = {
  rows: PersonalReportRow[];
  patTotals: PatCounts;
  summaryMatrix: SummaryMatrix;
  disciplineTotals: Record<ReportDisciplineOrTotal, PatCounts>;
  pivotRows: PivotRow[];
  monthlyPoints: MonthlyPersonnelPoint[];
};

type AttendanceActiveRow = {
  id: string;
  project_code: string;
  report_date: string;
  source_file_id: string;
  source_row_no: number | null;
  employee_id: string | null;
  full_name: string | null;
  company: string | null;
  segment: string | null;
  discipline: string | null;
  profession_actual: string | null;
  profession_official: string | null;
  status: string | null;
  absence_reason: string | null;
};

const SEGMENTS: ReportSegment[] = ["Indirect", "Direct", "Mobilization"];
const DISCIPLINES: ReportDiscipline[] = ["Electrical", "Mechanical", "Shared"];

function requireEnv(name: string, value: string | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`Missing required environment variable: ${name}`);
  return normalized;
}

function getSupabaseRestConfig() {
  const url = requireEnv(
    "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { url, serviceKey };
}

async function supabaseGet<T>(path: string, searchParams: URLSearchParams): Promise<T[]> {
  const { url, serviceKey } = getSupabaseRestConfig();
  const target = new URL(`/rest/v1/${path}`, url);
  target.search = searchParams.toString();

  const response = await fetch(target, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Supabase request failed for ${path}`);
  }

  return (await response.json()) as T[];
}

function normalizeIsoDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

export function resolveReportDate(rawDate?: string): string {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  return rawDate && normalizeIsoDate(rawDate) ? rawDate : todayIso;
}

export function formatReportDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function monthTokenFromDate(date: string): string {
  return date.slice(0, 7);
}

export function formatReportMonth(dateOrMonth: string): string {
  const month = dateOrMonth.length === 7 ? dateOrMonth : monthTokenFromDate(dateOrMonth);
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function txt(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeStatus(value: unknown): AttendanceStatus {
  const s = txt(value).toLowerCase();
  if (s === "present" || s === "p" || s === "worked" || s === "attended") return "Present";
  if (s === "absent" || s === "a") return "Absent";
  return "Unknown";
}

function toPat(status: AttendanceStatus): PatCode {
  if (status === "Present") return "P";
  if (status === "Absent") return "A";
  return "U";
}

function coerceSegment(raw: string | null | undefined): ReportSegment {
  const s = txt(raw);
  if (s === "Direct" || s === "Mobilization" || s === "Indirect") return s;
  return "Indirect";
}

function coerceDiscipline(raw: string | null | undefined): ReportDiscipline {
  const s = txt(raw);
  if (s === "Electrical" || s === "Mechanical" || s === "Shared") return s;
  return "Shared";
}

function createCounts(): PatCounts {
  return { present: 0, absent: 0, total: 0 };
}

function createSummaryMatrix(): SummaryMatrix {
  return {
    Indirect: { Electrical: createCounts(), Mechanical: createCounts(), Shared: createCounts(), Total: createCounts() },
    Direct: { Electrical: createCounts(), Mechanical: createCounts(), Shared: createCounts(), Total: createCounts() },
    Mobilization: {
      Electrical: createCounts(),
      Mechanical: createCounts(),
      Shared: createCounts(),
      Total: createCounts(),
    },
  };
}

function bestProfession(row: PersonalReportRow): string {
  return row.professionActual || row.professionOfficial || "Unassigned";
}

async function fetchActiveRowsForDate(projectCode: string, date: string): Promise<AttendanceActiveRow[]> {
  const pageSize = 1000;
  const rows: AttendanceActiveRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const searchParams = new URLSearchParams({
      select: [
        "project_code",
        "report_date",
        "id",
        "source_file_id",
        "source_row_no",
        "employee_id",
        "full_name",
        "company",
        "segment",
        "discipline",
        "profession_actual",
        "profession_official",
        "status",
        "absence_reason",
      ].join(","),
      project_code: `eq.${projectCode}`,
      report_date: `eq.${date}`,
      order: "full_name.asc.nullslast,employee_id.asc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });

    const batch = await supabaseGet<AttendanceActiveRow>("attendance_active_rows", searchParams);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

async function fetchActiveRowsForMonth(projectCode: string, month: string): Promise<AttendanceActiveRow[]> {
  const range = monthRange(month);
  if (!range) throw new Error("Invalid month");

  const pageSize = 1000;
  const rows: AttendanceActiveRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const searchParams = new URLSearchParams({
      select: [
        "project_code",
        "report_date",
        "id",
        "source_file_id",
        "source_row_no",
        "employee_id",
        "full_name",
        "company",
        "segment",
        "discipline",
        "profession_actual",
        "profession_official",
        "status",
        "absence_reason",
      ].join(","),
      project_code: `eq.${projectCode}`,
      report_date: `gte.${range.start}`,
      order: "report_date.asc,full_name.asc.nullslast,employee_id.asc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });
    searchParams.append("report_date", `lte.${range.end}`);

    const batch = await supabaseGet<AttendanceActiveRow>("attendance_active_rows", searchParams);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

function normalizeRows(rawRows: AttendanceActiveRow[]): PersonalReportRow[] {
  const normalized = rawRows.flatMap((row) => {
    const employeeId = txt(row.employee_id) || null;
    const fullName = txt(row.full_name);
    if (!fullName) return [];

    const status = normalizeStatus(row.status);
    const rowKey = row.id || `${row.source_file_id}:${row.source_row_no ?? "na"}:${employeeId ?? fullName}`;

    return [
      {
        rowKey,
        employeeId,
        fullName,
        company: txt(row.company) || null,
        segment: coerceSegment(row.segment),
        discipline: coerceDiscipline(row.discipline),
        status,
        pat: toPat(status),
        absenceReason: txt(row.absence_reason) || null,
        professionActual: txt(row.profession_actual) || null,
        professionOfficial: txt(row.profession_official) || null,
      },
    ];
  });

  return normalized.sort(
    (a, b) =>
      a.segment.localeCompare(b.segment) ||
      a.discipline.localeCompare(b.discipline) ||
      a.fullName.localeCompare(b.fullName) ||
      (a.employeeId ?? "").localeCompare(b.employeeId ?? "") ||
      a.rowKey.localeCompare(b.rowKey)
  );
}

function buildSummaryMatrix(rows: PersonalReportRow[]) {
  const summaryMatrix = createSummaryMatrix();
  const disciplineTotals: Record<ReportDisciplineOrTotal, PatCounts> = {
    Electrical: createCounts(),
    Mechanical: createCounts(),
    Shared: createCounts(),
    Total: createCounts(),
  };

  for (const row of rows) {
    const cell = summaryMatrix[row.segment][row.discipline];
    if (row.status === "Present") cell.present += 1;
    if (row.status === "Absent") cell.absent += 1;
    cell.total += 1;
  }

  for (const segment of SEGMENTS) {
    summaryMatrix[segment].Total = {
      present:
        summaryMatrix[segment].Electrical.present +
        summaryMatrix[segment].Mechanical.present +
        summaryMatrix[segment].Shared.present,
      absent:
        summaryMatrix[segment].Electrical.absent +
        summaryMatrix[segment].Mechanical.absent +
        summaryMatrix[segment].Shared.absent,
      total:
        summaryMatrix[segment].Electrical.total +
        summaryMatrix[segment].Mechanical.total +
        summaryMatrix[segment].Shared.total,
    };
  }

  for (const segment of SEGMENTS) {
    for (const discipline of [...DISCIPLINES, "Total"] as ReportDisciplineOrTotal[]) {
      disciplineTotals[discipline].present += summaryMatrix[segment][discipline].present;
      disciplineTotals[discipline].absent += summaryMatrix[segment][discipline].absent;
      disciplineTotals[discipline].total += summaryMatrix[segment][discipline].total;
    }
  }

  return { summaryMatrix, disciplineTotals };
}

function buildPivotRows(rows: PersonalReportRow[]): PivotRow[] {
  const pivotMap = new Map<string, PivotRow & { companies: Set<string> }>();

  for (const row of rows) {
    const profession = bestProfession(row);
    const current = pivotMap.get(profession) ?? {
      profession,
      companyCount: 0,
      present: 0,
      absent: 0,
      total: 0,
      companies: new Set<string>(),
    };

    if (row.company) current.companies.add(row.company);
    if (row.status === "Present") current.present += 1;
    if (row.status === "Absent") current.absent += 1;
    current.total += 1;
    current.companyCount = current.companies.size;
    pivotMap.set(profession, current);
  }

  return Array.from(pivotMap.values())
    .map(({ profession, companyCount, present, absent, total }) => ({
      profession,
      companyCount,
      present,
      absent,
      total,
    }))
    .sort((a, b) => b.total - a.total || a.profession.localeCompare(b.profession));
}

function buildMonthlyPersonnelPoints(rows: AttendanceActiveRow[], month: string): MonthlyPersonnelPoint[] {
  const range = monthRange(month);
  const lastDay = Number(range?.end.slice(8, 10) || "0");

  const points = Array.from({ length: lastDay }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, "0")}`,
    day: i + 1,
    present: 0,
    absent: 0,
    total: 0,
  }));

  for (const row of rows) {
    const reportDate = txt(row.report_date);
    const day = Number(reportDate.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > points.length) continue;

    const point = points[day - 1];
    const status = normalizeStatus(row.status);
    if (status === "Present") point.present += 1;
    if (status === "Absent") point.absent += 1;
    point.total += 1;
  }

  return points;
}

export async function getPersonalReportsData(projectCode: string, date: string): Promise<PersonalReportsData> {
  const month = monthTokenFromDate(date);

  const [selectedRaw, monthRaw] = await Promise.all([
    fetchActiveRowsForDate(projectCode, date),
    fetchActiveRowsForMonth(projectCode, month),
  ]);

  const rows = normalizeRows(selectedRaw);
  const { summaryMatrix, disciplineTotals } = buildSummaryMatrix(rows);
  const pivotRows = buildPivotRows(rows);
  const monthlyPoints = buildMonthlyPersonnelPoints(monthRaw, month);

  return {
    rows,
    patTotals: disciplineTotals.Total,
    summaryMatrix,
    disciplineTotals,
    pivotRows,
    monthlyPoints,
  };
}
