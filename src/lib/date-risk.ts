export function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

export function startOfDay(value: Date): Date {
  const output = new Date(value);
  output.setHours(0, 0, 0, 0);
  return output;
}

export function diffCalendarDays(target: Date, reference: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((startOfDay(target).getTime() - startOfDay(reference).getTime()) / msPerDay);
}

export function isDateWithinDays(target: Date, reference: Date, days: number): boolean {
  const diff = diffCalendarDays(target, reference);
  return diff >= 0 && diff <= days;
}

export function shiftIsoDate(value: string, diffDays: number): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  parsed.setDate(parsed.getDate() + diffDays);
  return parsed.toISOString().slice(0, 10);
}

export function toWeekLabel(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return "Unknown";

  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));

  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNo =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );

  return `${date.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}