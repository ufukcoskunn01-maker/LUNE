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

type AttendanceReportPointerRow = {
  project_code: string;
  report_date: string;
  active_file_id: string;
};

type AttendanceDailySnapshotRow = {
  source_file_id: string;
  employee_id: string | null;
  full_name: string | null;
  company: string | null;
  section_title: string | null;
  discipline_group: string | null;
  discipline_code: string | null;
  profession_group: string | null;
  status: string | null;
  absence_reason: string | null;
  is_mobilization: boolean | null;
};

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

function inferSegmentFromSnapshot(row: AttendanceDailySnapshotRow): ReportSegment {
  if (row.is_mobilization) return "Mobilization";
  const section = txt(row.section_title).toLowerCase();
  if (section.includes("итр")) return "Indirect";
  if (section.includes("команд")) return "Direct";
  return "Indirect";
}

function inferDisciplineFromSnapshot(row: AttendanceDailySnapshotRow): ReportDiscipline {
  const code = txt(row.discipline_code).toLowerCase();
  if (code === "э" || code === "e") return "Electrical";
  if (code === "м" || code === "m") return "Mechanical";

  const group = txt(row.discipline_group).toLowerCase();
  if (group.includes("эом") || group.includes("cc") || group.includes("сс") || group.includes("elect")) return "Electrical";
  if (group.includes("ов") || group.includes("вк") || group.includes("вис") || group.includes("mech")) return "Mechanical";
  return "Shared";
}

async function fetchActiveReport(projectCode: string, date: string): Promise<AttendanceReportPointerRow | null> {
  const rows = await supabaseGet<AttendanceReportPointerRow>(
    "attendance_reports",
    new URLSearchParams({
      select: "project_code,report_date,active_file_id",
      project_code: `eq.${projectCode}`,
      report_date: `eq.${date}`,
      limit: "1",
    })
  );
  return rows[0] ?? null;
}

async function fetchMonthReportPointers(projectCode: string, month: string): Promise<AttendanceReportPointerRow[]> {
  const range = monthRange(month);
  if (!range) throw new Error("Invalid month");

  const pageSize = 1000;
  const rows: AttendanceReportPointerRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const searchParams = new URLSearchParams({
      select: "project_code,report_date,active_file_id",
      project_code: `eq.${projectCode}`,
      report_date: `gte.${range.start}`,
      order: "report_date.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    searchParams.append("report_date", `lte.${range.end}`);

    const batch = await supabaseGet<AttendanceReportPointerRow>("attendance_reports", searchParams);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

async function fetchSnapshotRowsBySourceFiles(sourceFileIds: string[]): Promise<AttendanceDailySnapshotRow[]> {
  if (!sourceFileIds.length) return [];

  const pageSize = 1000;
  const rows: AttendanceDailySnapshotRow[] = [];
  const inList = `in.(${sourceFileIds.join(",")})`;

  for (let offset = 0; ; offset += pageSize) {
    const searchParams = new URLSearchParams({
      select: "source_file_id,employee_id,full_name,company,section_title,discipline_group,discipline_code,profession_group,status,absence_reason,is_mobilization",
      source_file_id: inList,
      order: "full_name.asc.nullslast,employee_id.asc.nullslast",
      limit: String(pageSize),
      offset: String(offset),
    });

    const batch = await supabaseGet<AttendanceDailySnapshotRow>("attendance_daily_rows", searchParams);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

function normalizeRows(rawRows: AttendanceDailySnapshotRow[]): PersonalReportRow[] {
  const normalized = rawRows.flatMap((row) => {
      const employeeId = txt(row.employee_id);
      const fullName = txt(row.full_name) || employeeId;
      if (!employeeId || !fullName) return [];

      const status = normalizeStatus(row.status);

      const normalizedRow: PersonalReportRow = {
        employeeId,
        fullName,
        company: txt(row.company) || null,
        segment: inferSegmentFromSnapshot(row),
        discipline: inferDisciplineFromSnapshot(row),
        status,
        pat: toPat(status),
        absenceReason: txt(row.absence_reason) || null,
        professionActual: txt(row.profession_group) || null,
        professionOfficial: null,
      };

      return [normalizedRow];
    });

  return normalized.sort(
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
    .map((value) => ({
      profession: value.profession,
      companyCount: value.companyCount,
      present: value.present,
      absent: value.absent,
      total: value.total,
    }))
    .sort((left, right) => right.total - left.total || left.profession.localeCompare(right.profession));
}

function buildMonthlyPersonnelPoints(
  pointers: AttendanceReportPointerRow[],
  rowsBySourceFile: Map<string, AttendanceDailySnapshotRow[]>,
  month: string
): MonthlyPersonnelPoint[] {
  const range = monthRange(month);
  const lastDay = Number(range?.end.slice(8, 10) || "0");
  const points = Array.from({ length: lastDay }, (_, index) => ({
    date: `${month}-${String(index + 1).padStart(2, "0")}`,
    day: index + 1,
    present: 0,
    absent: 0,
    total: 0,
  }));

  for (const pointer of pointers) {
    const day = Number(pointer.report_date.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > points.length) continue;
    const point = points[day - 1];
    const rows = rowsBySourceFile.get(pointer.active_file_id) ?? [];

    for (const row of rows) {
      const status = normalizeStatus(row.status);
      if (status === "Present") point.present += 1;
      if (status === "Absent") point.absent += 1;
      point.total += 1;
    }
  }

  return points;
}

function toMonthlyAttendanceRecord(row: AttendanceDailySnapshotRow, reportDate: string): MonthlyAttendanceRecord | null {
  const employeeId = txt(row.employee_id);
  const fullName = txt(row.full_name);
  if (!employeeId || !fullName) return null;

  return {
    employee_id: employeeId,
    full_name: fullName,
    work_date: reportDate,
    status: txt(row.status) || null,
    segment: inferSegmentFromSnapshot(row),
    discipline: inferDisciplineFromSnapshot(row),
  };
}

export async function getPersonalReportsData(projectCode: string, date: string): Promise<PersonalReportsData> {
  const month = monthTokenFromDate(date);
  const [selectedPointer, monthPointers] = await Promise.all([
    fetchActiveReport(projectCode, date),
    fetchMonthReportPointers(projectCode, month),
  ]);

  const sourceFileIds = Array.from(
    new Set(
      [selectedPointer?.active_file_id, ...monthPointers.map((pointer) => pointer.active_file_id)].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  const allSnapshotRows = await fetchSnapshotRowsBySourceFiles(sourceFileIds);
  const rowsBySourceFile = new Map<string, AttendanceDailySnapshotRow[]>();

  for (const row of allSnapshotRows) {
    const current = rowsBySourceFile.get(row.source_file_id) ?? [];
    current.push(row);
    rowsBySourceFile.set(row.source_file_id, current);
  }

  const selectedRows = selectedPointer ? rowsBySourceFile.get(selectedPointer.active_file_id) ?? [] : [];
  const rows = normalizeRows(selectedRows);
  const { summaryMatrix, disciplineTotals } = buildSummaryMatrix(rows);
  const pivotRows = buildPivotRows(rows);
  const monthlyPoints = buildMonthlyPersonnelPoints(monthPointers, rowsBySourceFile, month);

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
  const pointers = await fetchMonthReportPointers(projectCode, month);
  const sourceFileIds = Array.from(new Set(pointers.map((pointer) => pointer.active_file_id)));
  const snapshotRows = await fetchSnapshotRowsBySourceFiles(sourceFileIds);
  const reportDateBySourceFile = new Map(pointers.map((pointer) => [pointer.active_file_id, pointer.report_date]));

  const monthlyRows = buildMonthlyHoursRows(
    snapshotRows
      .map((row) => {
        const reportDate = reportDateBySourceFile.get(row.source_file_id);
        return reportDate ? toMonthlyAttendanceRecord(row, reportDate) : null;
      })
      .filter((row): row is MonthlyAttendanceRecord => row !== null),
    month
  );

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
