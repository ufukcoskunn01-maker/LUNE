export type MonthlyAttendanceRecord = {
  employee_id: string | null;
  full_name: string | null;
  work_date: string | null;
  status: string | null;
  segment: string | null;
  discipline: string | null;
};

export type DisciplineBucket = "Electrical" | "Mechanical" | "Shared";
export type SegmentBucket = "Indirect" | "Direct" | "Mobilisation";

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
export const SEGMENT_ORDER: SegmentBucket[] = ["Indirect", "Direct", "Mobilisation"];

export function parseMonthToken(month: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthNum = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum)) return null;
  if (monthNum < 1 || monthNum > 12) return null;
  return { year, month: monthNum };
}

export function monthRange(month: string): { start: string; end: string } | null {
  const parsed = parseMonthToken(month);
  if (!parsed) return null;
  const { year, month: monthNum } = parsed;
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return {
    start: `${year}-${String(monthNum).padStart(2, "0")}-01`,
    end: `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildDayColumns(): string[] {
  return Array.from({ length: 31 }, (_, idx) => String(idx + 1).padStart(2, "0"));
}

function dayFromIso(workDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return null;
  return workDate.slice(8, 10);
}

function normalizeDiscipline(value: string | null): DisciplineBucket {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "electrical") return "Electrical";
  if (normalized === "mechanical") return "Mechanical";
  return "Shared";
}

function normalizeSegment(value: string | null): SegmentBucket {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "direct") return "Direct";
  if (normalized === "mobilization" || normalized === "mobilisation") return "Mobilisation";
  return "Indirect";
}

export function buildMonthlyHoursRows(records: MonthlyAttendanceRecord[]): MonthlyHoursRow[] {
  const dayColumns = buildDayColumns();
  const byEmployeeGroup = new Map<
    string,
    {
      employee_id: string;
      full_name: string;
      discipline: DisciplineBucket;
      segment: SegmentBucket;
      presentDays: Set<string>;
    }
  >();

  for (const record of records) {
    const employeeId = (record.employee_id || "").trim();
    if (!employeeId) continue;

    const discipline = normalizeDiscipline(record.discipline);
    const segment = normalizeSegment(record.segment);
    const fullName = (record.full_name || "").trim();
    const status = (record.status || "").trim().toLowerCase();
    const day = record.work_date ? dayFromIso(record.work_date) : null;
    const employeeKey = `${employeeId}__${discipline}__${segment}`;

    let current = byEmployeeGroup.get(employeeKey);
    if (!current) {
      current = {
        employee_id: employeeId,
        full_name: fullName,
        discipline,
        segment,
        presentDays: new Set<string>(),
      };
      byEmployeeGroup.set(employeeKey, current);
    } else if (!current.full_name && fullName) {
      current.full_name = fullName;
    }

    if (day && status === "present") {
      current.presentDays.add(day);
    }
  }

  return Array.from(byEmployeeGroup.values())
    .map((entry) => {
      const days: Record<string, number | null> = {};
      for (const day of dayColumns) {
        days[day] = entry.presentDays.has(day) ? FIXED_DAILY_HOURS : null;
      }
      return {
        employee_id: entry.employee_id,
        full_name: entry.full_name || entry.employee_id,
        discipline: entry.discipline,
        segment: entry.segment,
        days,
        total_hours: entry.presentDays.size * FIXED_DAILY_HOURS,
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
