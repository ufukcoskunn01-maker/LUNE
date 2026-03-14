import { buildMonthlyHoursRows, monthRange, type MonthlyAttendanceRecord } from "@/lib/attendance-monthly-hours";
import { buildMonthlyTemplateWorkbook } from "@/lib/personal-reports-monthly-template";

type AttendanceActiveRow = {
  report_date: string;
  employee_id: string | null;
  full_name: string | null;
  company: string | null;
  segment: string | null;
  discipline: string | null;
  status: string | null;
};

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

function txt(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function coerceSegment(raw: string | null | undefined): "Indirect" | "Direct" | "Mobilization" {
  const normalized = txt(raw);
  if (normalized === "Direct" || normalized === "Mobilization" || normalized === "Indirect") return normalized;
  return "Indirect";
}

function coerceDiscipline(raw: string | null | undefined): "Electrical" | "Mechanical" | "Shared" {
  const normalized = txt(raw);
  if (normalized === "Electrical" || normalized === "Mechanical" || normalized === "Shared") return normalized;
  return "Shared";
}

async function fetchActiveRowsForMonth(projectCode: string, month: string): Promise<AttendanceActiveRow[]> {
  const range = monthRange(month);
  if (!range) throw new Error("Invalid month");

  const pageSize = 1000;
  const rows: AttendanceActiveRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const searchParams = new URLSearchParams({
      select: ["report_date", "employee_id", "full_name", "company", "segment", "discipline", "status"].join(","),
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

function toMonthlyAttendanceRecord(row: AttendanceActiveRow): MonthlyAttendanceRecord | null {
  const fullName = txt(row.full_name);
  if (!fullName) return null;

  return {
    employee_id: txt(row.employee_id) || null,
    full_name: fullName,
    work_date: row.report_date,
    status: txt(row.status) || null,
    segment: coerceSegment(row.segment),
    discipline: coerceDiscipline(row.discipline),
    company: txt(row.company) || null,
  };
}

export async function exportPersonalReportsMonthlyWorkbook(
  projectCode: string,
  month: string
): Promise<{ fileName: string; content: Buffer; contentType: string }> {
  const rows = await fetchActiveRowsForMonth(projectCode, month);

  const monthlyRows = buildMonthlyHoursRows(
    rows
      .map((row) => toMonthlyAttendanceRecord(row))
      .filter((row): row is MonthlyAttendanceRecord => row !== null),
    month
  );

  const content = await buildMonthlyTemplateWorkbook(projectCode, month, monthlyRows);

  return {
    fileName: `${projectCode}-MonthlyHours-${month}.xlsx`,
    content,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
