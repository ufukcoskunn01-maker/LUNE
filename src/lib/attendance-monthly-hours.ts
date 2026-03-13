export type MonthlyAttendanceRecord = {
  employee_id: string | null;
  full_name: string | null;
  work_date: string | null;
  status: string | null;
  segment: string | null;
  discipline: string | null;
  hours?: number | null;
};

export type DisciplineBucket = "Electrical" | "Mechanical" | "Shared";
export type SegmentBucket = "Indirect" | "Direct" | "Mobilization";

export type MonthlyHoursRow = {
  employee_id: string;
  full_name: string;
  discipline: DisciplineBucket;
  segment: SegmentBucket;
  days: Record<string, number | null>;
  total_hours: number;
};

export const FIXED_DAILY_HOURS = 10;
export const DISCIPLINE_ORDER: DisciplineBucket[] = ["Electrical", "Mechanical", "Shared"];
export const SEGMENT_ORDER: SegmentBucket[] = ["Indirect", "Direct", "Mobilization"];

const DEFAULT_PRESENT_STATUSES = ["present", "p", "worked", "on site", "onsite", "available", "attended"];

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseMonthToken(month: string): { year: number; month: number } | null {
  const trimmed = safeTrim(month);
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;

  const [yearPart, monthPart] = trimmed.split("-");
  const year = Number(yearPart);
  const monthNum = Number(monthPart);

  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) return null;

  return { year, month: monthNum };
}

export function monthRange(month: string): { start: string; end: string } | null {
  const parsed = parseMonthToken(month);
  if (!parsed) return null;

  const lastDay = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
  const monthStr = String(parsed.month).padStart(2, "0");
  const lastDayStr = String(lastDay).padStart(2, "0");

  return {
    start: `${parsed.year}-${monthStr}-01`,
    end: `${parsed.year}-${monthStr}-${lastDayStr}`,
  };
}

function buildDayColumns(month?: string): string[] {
  if (!month) {
    return Array.from({ length: 31 }, (_, idx) => String(idx + 1).padStart(2, "0"));
  }

  const range = monthRange(month);
  if (!range) return [];

  const lastDay = Number(range.end.slice(8, 10));
  return Array.from({ length: lastDay }, (_, idx) => String(idx + 1).padStart(2, "0"));
}

function parseIsoDateStrict(value: string | null | undefined): Date | null {
  const trimmed = safeTrim(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [yearPart, monthPart, dayPart] = trimmed.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function dayFromIsoStrict(workDate: string | null | undefined): string | null {
  const date = parseIsoDateStrict(workDate);
  return date ? String(date.getUTCDate()).padStart(2, "0") : null;
}

function monthTokenFromIso(workDate: string | null | undefined): string | null {
  const date = parseIsoDateStrict(workDate);
  return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` : null;
}

function normalizeDiscipline(value: string | null | undefined): DisciplineBucket {
  const normalized = safeTrim(value).toLowerCase();
  if (!normalized) return "Shared";
  if (normalized === "electrical" || normalized === "elec" || normalized.includes("elect")) return "Electrical";
  if (normalized === "mechanical" || normalized === "mech" || normalized.includes("mech")) return "Mechanical";
  return "Shared";
}

function normalizeSegment(value: string | null | undefined): SegmentBucket {
  const normalized = safeTrim(value).toLowerCase();
  if (!normalized) return "Indirect";
  if (normalized === "direct" || normalized.includes("direct")) return "Direct";
  if (normalized === "mobilization" || normalized === "mobilisation" || normalized.includes("mobil")) return "Mobilization";
  return "Indirect";
}

function isPresentStatus(status: string | null | undefined): boolean {
  const normalized = safeTrim(status).toLowerCase();
  return normalized ? DEFAULT_PRESENT_STATUSES.includes(normalized) : false;
}

function resolveHours(record: MonthlyAttendanceRecord): number {
  const candidate = typeof record.hours === "number" ? record.hours : Number(record.hours);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : FIXED_DAILY_HOURS;
}

export function buildMonthlyHoursRows(records: MonthlyAttendanceRecord[], month?: string): MonthlyHoursRow[] {
  const dayColumns = buildDayColumns(month);
  const byEmployeeGroup = new Map<
    string,
    {
      employee_id: string;
      full_name: string;
      discipline: DisciplineBucket;
      segment: SegmentBucket;
      hoursByDay: Map<string, number>;
    }
  >();

  for (const record of records) {
    const employeeId = safeTrim(record.employee_id);
    if (!employeeId) continue;
    if (!isPresentStatus(record.status)) continue;

    const workDate = safeTrim(record.work_date);
    const day = dayFromIsoStrict(workDate);
    if (!day) continue;
    if (month && monthTokenFromIso(workDate) !== month) continue;

    const discipline = normalizeDiscipline(record.discipline);
    const segment = normalizeSegment(record.segment);
    const fullName = safeTrim(record.full_name) || employeeId;
    const hours = resolveHours(record);
    const key = `${employeeId}__${discipline}__${segment}`;

    let current = byEmployeeGroup.get(key);
    if (!current) {
      current = {
        employee_id: employeeId,
        full_name: fullName,
        discipline,
        segment,
        hoursByDay: new Map<string, number>(),
      };
      byEmployeeGroup.set(key, current);
    }

    if (current.hoursByDay.has(day)) {
      current.hoursByDay.set(day, Math.max(current.hoursByDay.get(day) ?? FIXED_DAILY_HOURS, hours));
    } else {
      current.hoursByDay.set(day, hours);
    }
  }

  return Array.from(byEmployeeGroup.values())
    .map((entry) => {
      const days: Record<string, number | null> = {};
      for (const day of dayColumns) {
        days[day] = entry.hoursByDay.get(day) ?? null;
      }

      return {
        employee_id: entry.employee_id,
        full_name: entry.full_name,
        discipline: entry.discipline,
        segment: entry.segment,
        days,
        total_hours: Array.from(entry.hoursByDay.values()).reduce((sum, value) => sum + value, 0),
      };
    })
    .sort(
      (left, right) =>
        DISCIPLINE_ORDER.indexOf(left.discipline) - DISCIPLINE_ORDER.indexOf(right.discipline) ||
        SEGMENT_ORDER.indexOf(left.segment) - SEGMENT_ORDER.indexOf(right.segment) ||
        left.full_name.localeCompare(right.full_name) ||
        left.employee_id.localeCompare(right.employee_id)
    );
}
