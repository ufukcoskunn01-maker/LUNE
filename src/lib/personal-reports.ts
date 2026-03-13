import { buildMonthlyHoursRows, monthRange, type MonthlyAttendanceRecord } from "@/lib/attendance-monthly-hours";

export const DEFAULT_PROJECT_CODE = "A27";

export type AttendanceStatus = "Present" | "Absent" | "Unknown";
export type PatCode = "P" | "A" | "U";
export type ReportSegment = "Indirect" | "Direct" | "Mobilization";
export type ReportDiscipline = "Electrical" | "Mechanical" | "Shared";
export type ReportDisciplineOrTotal = ReportDiscipline | "Total";

export type PersonalReportRow = {
  employeeId: string;
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

type ProjectRow = { id: string };
type AttendanceRecordRow = Record<string, unknown>;

const SEGMENTS: ReportSegment[] = ["Indirect", "Direct", "Mobilization"];
const DISCIPLINES: ReportDiscipline[] = ["Electrical", "Mechanical", "Shared"];

function requireEnv(name: string, value: string | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`Missing required environment variable: ${name}`);
  return normalized;
}

function getSupabaseRestConfig() {
  const url = requireEnv("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
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

function createCounts(): PatCounts {
  return { present: 0, absent: 0, total: 0 };
}

function createSummaryMatrix(): SummaryMatrix {
  return {
    Indirect: { Electrical: createCounts(), Mechanical: createCounts(), Shared: createCounts(), Total: createCounts() },
    Direct: { Electrical: createCounts(), Mechanical: createCounts(), Shared: createCounts(), Total: createCounts() },
    Mobilization: { Electrical: createCounts(), Mechanical: createCounts(), Shared: createCounts(), Total: createCounts() },
  };
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
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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

function normalizeSegment(value: unknown): ReportSegment {
  const normalized = txt(value).toLowerCase();
  if (normalized.includes("direct")) return "Direct";
  if (normalized.includes("mobil")) return "Mobilization";
  return "Indirect";
}

function normalizeDiscipline(value: unknown): ReportDiscipline {
  const normalized = txt(value).toLowerCase();
  if (normalized.includes("elect")) return "Electrical";
  if (normalized.includes("mech")) return "Mechanical";
  return "Shared";
}

function normalizeStatus(value: unknown): AttendanceStatus {
  const normalized = txt(value).toLowerCase();
  if (normalized === "present" || normalized === "p" || normalized === "worked" || normalized === "attended") return "Present";
  if (normalized === "absent" || normalized === "a") return "Absent";
  return "Unknown";
}

function toPat(status: AttendanceStatus): PatCode {
  if (status === "Present") return "P";
  if (status === "Absent") return "A";
  return "U";
}

function bestProfession(row: PersonalReportRow): string {
  return row.professionOfficial || row.professionActual || "Unassigned";
}

async function fetchProjectId(projectCode: string): Promise<string> {
  const searchParams = new URLSearchParams({
    select: "id",
    code: `eq.${projectCode}`,
    limit: "1",
  });
  const rows = await supabaseGet<ProjectRow>("projects", searchParams);
  const project = rows[0];
  if (!project?.id) throw new Error(`Project not found: ${projectCode}`);
  return project.id;
}

async function fetchAttendanceRows(projectId: string, date: string): Promise<AttendanceRecordRow[]> {
  const pageSize = 1000;
  const rows: AttendanceRecordRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const searchParams = new URLSearchParams({
      select: "employee_id,full_name,segment,discipline,company,status,absence_reason,profession_actual,profession_official,work_date",
      project_id: `eq.${projectId}`,
      work_date: `eq.${date}`,
      order: "full_name.asc.nullslast,employee_id.asc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });

    const batch = await supabaseGet<AttendanceRecordRow>("attendance_records", searchParams);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

async function fetchMonthlyAttendanceRows(projectId: string, month: string): Promise<MonthlyAttendanceRecord[]> {
  const range = monthRange(month);
  if (!range) throw new Error("Invalid month");

  const pageSize = 1000;
  const rows: MonthlyAttendanceRecord[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const searchParams = new URLSearchParams({
      select: "employee_id,full_name,work_date,status,segment,discipline",
      project_id: `eq.${projectId}`,
      work_date: `gte.${range.start}`,
      order: "work_date.asc,employee_id.asc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });
    searchParams.append("work_date", `lte.${range.end}`);

    const batch = await supabaseGet<MonthlyAttendanceRecord>("attendance_records", searchParams);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

function normalizeRows(rawRows: AttendanceRecordRow[]): PersonalReportRow[] {
  return rawRows
    .map((row) => {
      const employeeId = txt(row.employee_id);
      const fullName = txt(row.full_name) || employeeId;
      if (!employeeId || !fullName) return null;

      const status = normalizeStatus(row.status);

      return {
        employeeId,
        fullName,
        company: txt(row.company) || null,
        segment: normalizeSegment(row.segment),
        discipline: normalizeDiscipline(row.discipline),
        status,
        pat: toPat(status),
        absenceReason: txt(row.absence_reason) || null,
        professionActual: txt(row.profession_actual) || null,
        professionOfficial: txt(row.profession_official) || null,
      };
    })
    .filter((row): row is PersonalReportRow => row !== null)
    .sort(
      (left, right) =>
        left.segment.localeCompare(right.segment) ||
        left.discipline.localeCompare(right.discipline) ||
        left.fullName.localeCompare(right.fullName) ||
        left.employeeId.localeCompare(right.employeeId)
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
    const segmentCell = summaryMatrix[row.segment][row.discipline];
    if (row.status === "Present") segmentCell.present += 1;
    if (row.status === "Absent") segmentCell.absent += 1;
    segmentCell.total += 1;
  }

  for (const segment of SEGMENTS) {
    summaryMatrix[segment].Total = {
      present: summaryMatrix[segment].Electrical.present + summaryMatrix[segment].Mechanical.present + summaryMatrix[segment].Shared.present,
      absent: summaryMatrix[segment].Electrical.absent + summaryMatrix[segment].Mechanical.absent + summaryMatrix[segment].Shared.absent,
      total: summaryMatrix[segment].Electrical.total + summaryMatrix[segment].Mechanical.total + summaryMatrix[segment].Shared.total,
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
    .map((value) => ({ profession: value.profession, companyCount: value.companyCount, present: value.present, absent: value.absent, total: value.total }))
    .sort((left, right) => right.total - left.total || left.profession.localeCompare(right.profession));
}

function buildMonthlyPersonnelPoints(rawRows: AttendanceRecordRow[], month: string): MonthlyPersonnelPoint[] {
  const range = monthRange(month);
  const lastDay = Number(range?.end.slice(8, 10) || "0");
  const points = Array.from({ length: lastDay }, (_, index) => ({
    date: `${month}-${String(index + 1).padStart(2, "0")}`,
    day: index + 1,
    present: 0,
    absent: 0,
    total: 0,
  }));

  for (const rawRow of rawRows) {
    const workDate = txt(rawRow.work_date);
    if (!workDate.startsWith(`${month}-`)) continue;
    const day = Number(workDate.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > points.length) continue;

    const point = points[day - 1];
    const status = normalizeStatus(rawRow.status);
    if (status === "Present") point.present += 1;
    if (status === "Absent") point.absent += 1;
    point.total += 1;
  }

  return points;
}

export async function getPersonalReportsData(projectCode: string, date: string): Promise<PersonalReportsData> {
  const projectId = await fetchProjectId(projectCode);
  const month = monthTokenFromDate(date);
  const [rawRows, monthlyRawRows] = await Promise.all([
    fetchAttendanceRows(projectId, date),
    fetchMonthlyAttendanceRows(projectId, month),
  ]);
  const rows = normalizeRows(rawRows);
  const { summaryMatrix, disciplineTotals } = buildSummaryMatrix(rows);
  const pivotRows = buildPivotRows(rows);
  const monthlyPoints = buildMonthlyPersonnelPoints(monthlyRawRows, month);

  return {
    rows,
    patTotals: disciplineTotals.Total,
    summaryMatrix,
    disciplineTotals,
    pivotRows,
    monthlyPoints,
  };
}

export async function exportPersonalReportsMonthlyCsv(projectCode: string, month: string): Promise<{ fileName: string; content: string }> {
  const projectId = await fetchProjectId(projectCode);
  const rows = await fetchMonthlyAttendanceRows(projectId, month);
  const monthlyRows = buildMonthlyHoursRows(rows, month);
  const range = monthRange(month);
  const dayCount = Number(range?.end.slice(8, 10) || "0");
  const dayColumns = Array.from({ length: dayCount }, (_, index) => String(index + 1).padStart(2, "0"));

  const header = ["Employee ID", "Full Name", "Discipline", "Segment", ...dayColumns, "Total Hours"];
  const csvRows = [
    header.join(","),
    ...monthlyRows.map((row) =>
      [
        escapeCsv(row.employee_id),
        escapeCsv(row.full_name),
        escapeCsv(row.discipline),
        escapeCsv(row.segment),
        ...dayColumns.map((day) => escapeCsv(row.days[day] == null ? "" : String(row.days[day]))),
        escapeCsv(String(row.total_hours)),
      ].join(",")
    ),
  ];

  return {
    fileName: `${projectCode}-MonthlyHours-${month}.csv`,
    content: csvRows.join("\n"),
  };
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
