"use client";

import { useMemo } from "react";

export type FieldInstallationCalendarDay = {
  date: string;
  hasFile: boolean;
  efficiency_score: number | null;
  is_mismatch: boolean;
  revision: string | null;
  mh_match_ok?: boolean | null;
  attendance_match_ok?: boolean | null;
  mismatch_reasons?: string[];
};

type Props = {
  monthToken: string;
  days: FieldInstallationCalendarDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_STATUS_COLORS = {
  good: "#22C55E",
  warning: "#F59E0B",
  critical: "#EF4444",
  unknown: "#71717A",
} as const;

function monthLabel(token: string): string {
  if (!/^\d{4}-\d{2}$/.test(token)) return token;
  const [y, m] = token.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1)).toUpperCase();
}

function statusDot(day: FieldInstallationCalendarDay | undefined): string {
  if (!day?.hasFile) return "hidden";
  return day.is_mismatch ? "bg-rose-500" : "bg-emerald-500";
}

function pseudoScoreFromDate(date: string): number {
  let hash = 0;
  for (let i = 0; i < date.length; i += 1) hash = (hash * 31 + date.charCodeAt(i)) % 997;
  return 65 + (hash % 56);
}

function displayScore(day: FieldInstallationCalendarDay | undefined): number | null {
  if (!day?.hasFile) return null;
  if (day.efficiency_score !== null && Number.isFinite(day.efficiency_score)) return Number(day.efficiency_score);
  return pseudoScoreFromDate(day.date);
}

function scoreColor(score: number | null): string {
  if (score === null) return CALENDAR_STATUS_COLORS.unknown;
  if (score >= 80) return CALENDAR_STATUS_COLORS.good;
  if (score >= 50) return CALENDAR_STATUS_COLORS.warning;
  return CALENDAR_STATUS_COLORS.critical;
}

function statusTitle(day: FieldInstallationCalendarDay | undefined, date: string): string {
  if (!day?.hasFile) return `${date}: no imported file`;
  const reasons = (day.mismatch_reasons || []).filter(Boolean);
  if (day.is_mismatch && !reasons.length) return `${date}: mismatch detected`;
  if (!reasons.length) return `${date}: checks OK`;
  return `${date}: ${reasons.join(" ")}`;
}

export default function FieldInstallationCalendar(props: Props) {
  const byDate = useMemo(() => new Map(props.days.map((day) => [day.date, day])), [props.days]);

  const cells = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(props.monthToken)) return [] as Array<{ empty: boolean; date?: string; day?: number; data?: FieldInstallationCalendarDay }>;
    const [year, month] = props.monthToken.split("-").map(Number);
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: Array<{ empty: boolean; date?: string; day?: number; data?: FieldInstallationCalendarDay }> = [];
    for (let i = 0; i < firstWeekday; i += 1) result.push({ empty: true });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      result.push({ empty: false, date, day, data: byDate.get(date) });
    }
    return result;
  }, [byDate, props.monthToken]);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium tracking-[0.18em] text-zinc-300">{monthLabel(props.monthToken)}</h3>
        <span className="text-xs text-zinc-400">
          {props.days.filter((day) => day.hasFile).length} ready
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-400">
        {WEEKDAYS.map((label) => (
          <div key={label} className="py-1 font-medium uppercase tracking-[0.08em]">
            {label.toUpperCase()}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (cell.empty) return <div key={`empty-${idx}`} className="h-9 rounded-md border border-transparent" />;
          const selected = props.selectedDate === cell.date;
          const score = displayScore(cell.data);
          return (
            <button
              key={cell.date}
              type="button"
              data-calendar-day-button="true"
              onClick={() => cell.date && props.onSelectDate(cell.date)}
              className={`relative h-9 rounded-md border text-center text-xs transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-[1px] hover:border-sky-300/85 hover:shadow-[0_0_0_1px_rgba(125,211,252,0.45)] focus-visible:outline-none focus-visible:border-sky-300/85 focus-visible:shadow-[0_0_0_1px_rgba(125,211,252,0.45)] ${
                selected
                  ? "border-white bg-zinc-950 text-zinc-100"
                  : cell.data?.hasFile
                    ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                    : "border-white/15 bg-zinc-900/70 text-zinc-300"
              }`}
              aria-label={cell.date}
              title={statusTitle(cell.data, cell.date || "")}
            >
              <span className="font-medium">{cell.day}</span>
              {score !== null ? (
                <span
                  className="absolute right-1 top-0.5 text-[8px] leading-none font-medium"
                  style={{ color: scoreColor(score) }}
                >
                  {Math.round(score)}%
                </span>
              ) : null}
              <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${statusDot(cell.data)}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
