export const TRANSPORT_BUCKET = "transport-approvals";
export const DEFAULT_PROJECT_CODE = "A27";
export const SHIFT_VALUES = ["morning", "evening"] as const;

export type TransportShift = (typeof SHIFT_VALUES)[number];

export function isTransportShift(value: string): value is TransportShift {
  return SHIFT_VALUES.includes(value as TransportShift);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseMonthToken(month: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthNum = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum)) return null;
  if (monthNum < 1 || monthNum > 12) return null;
  return { year, month: monthNum };
}

export function monthRange(month: string): { start: string; end: string; daysInMonth: number } | null {
  const parsed = parseMonthToken(month);
  if (!parsed) return null;
  const { year, month: monthNum } = parsed;
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  return {
    start: `${year}-${String(monthNum).padStart(2, "0")}-01`,
    end: `${year}-${String(monthNum).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
    daysInMonth,
  };
}

export function dayColumns31(): string[] {
  return Array.from({ length: 31 }, (_, idx) => String(idx + 1).padStart(2, "0"));
}

export function normalizePlate(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function sanitizePathSegment(value: string): string {
  const cleaned = value.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "item";
}

export function buildTransportPhotoPath(args: {
  projectCode: string;
  workDate: string;
  shift: TransportShift;
  plate: string;
  uuid: string;
}): string {
  const month = args.workDate.slice(0, 7);
  return [
    "transport",
    sanitizePathSegment(args.projectCode),
    month,
    args.workDate,
    args.shift,
    sanitizePathSegment(args.plate),
    `${args.uuid}.jpg`,
  ].join("/");
}

export function toMonthFromDate(workDate: string): string {
  return workDate.slice(0, 7);
}
