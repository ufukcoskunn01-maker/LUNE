"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Calendar, Download } from "lucide-react";
import FieldInstallationCalendar, { type FieldInstallationCalendarDay } from "@/components/field-installation/FieldInstallationCalendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MonthPayload = {
  projectCode: string;
  month: string;
  days: FieldInstallationCalendarDay[];
};

type DayFile = {
  id: string;
  project_code: string;
  work_date: string;
  bucket_id: string | null;
  storage_path: string;
  file_name: string;
  file_kind: string | null;
  revision: string | null;
  updated_at: string | null;
};

type DaySummary = {
  id: string;
  project_code: string;
  work_date: string;
  source_file_id: string;
  material_total_mh: number | null;
  people_total_mh: number | null;
  indirect_total_mh: number | null;
  direct_total_mh: number | null;
  delta_mh: number | null;
  efficiency_score: number | null;
  mh_match_ok: boolean | null;
  attendance_match_ok: boolean | null;
  mismatch_reasons: string[] | null;
  is_mismatch: boolean;
  warnings: WarningItem[] | null;
  updated_at: string | null;
};

type WarningItem = {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
};

type DayRow = {
  id: string;
  work_date: string;
  row_no: number | null;
  location: string | null;
  zone: string | null;
  floor: string | null;
  elevation: string | null;
  budget_code: string | null;
  activity_code: string | null;
  description: string | null;
  unit: string | null;
  qty: number | null;
  manhours: number | null;
  team_no: number | null;
  project_name: string | null;
  orientation: string | null;
  install_action: string | null;
  comment: string | null;
};

type DayPayload = {
  file: DayFile | null;
  summary: DaySummary | null;
  rows: DayRow[];
};

type DatesPayload = {
  projectCode: string;
  projectCodes: string[];
  dates: string[];
  latestImportedDate: string | null;
};

type RangePayload = {
  rows: DayRow[];
};

type Props = {
  embedded?: boolean;
};

function buildIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonthDate(currentIso: string, deltaMonths: number, availableDates: string[]): string {
  const [yearStr, monthStr, dayStr] = currentIso.split("-");
  const baseYear = Number(yearStr);
  const baseMonthIndex = Number(monthStr) - 1;
  const baseDay = Number(dayStr);
  if (!Number.isFinite(baseYear) || !Number.isFinite(baseMonthIndex) || !Number.isFinite(baseDay)) {
    return currentIso;
  }

  const targetMonthDate = new Date(baseYear, baseMonthIndex + deltaMonths, 1);
  const targetYear = targetMonthDate.getFullYear();
  const targetMonthIndex = targetMonthDate.getMonth();
  const targetDays = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const preferredDay = Math.max(1, Math.min(baseDay, targetDays));
  const preferredIso = buildIsoDate(targetYear, targetMonthIndex, preferredDay);

  const monthPrefix = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-`;
  const monthDates = availableDates.filter((d) => d.startsWith(monthPrefix)).sort();
  if (!monthDates.length) return preferredIso;
  if (monthDates.includes(preferredIso)) return preferredIso;

  let bestDate = monthDates[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of monthDates) {
    const candidateDay = Number(candidate.slice(8, 10));
    const distance = Math.abs(candidateDay - preferredDay);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDate = candidate;
    }
  }

  return bestDate ?? preferredIso;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return todayIso().slice(0, 7);
}

function formatNum(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function checkBadgeClass(value: boolean | null): string {
  if (value === true) return "border-emerald-300/35 bg-emerald-500/18 text-emerald-100";
  if (value === false) return "border-rose-300/35 bg-rose-500/18 text-rose-100";
  return "border-white/15 bg-black/30 text-zinc-300";
}

function checkLabel(value: boolean | null): string {
  if (value === true) return "OK";
  if (value === false) return "Mismatch";
  return "Unknown";
}

function formatDateLabel(value: string): string {
  const iso = String(value || "").trim();
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function isLegacyPeopleMismatchWarning(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized.startsWith("manhour mismatch:") && normalized.includes("people=");
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function extractPersonnelColumns(details: Record<string, unknown> | null): {
  installation: string[];
  personal: string[];
  isPartial: boolean;
} {
  if (!details) return { installation: [], personal: [], isPartial: true };

  const installation = toStringList(details.installation_direct_names);
  const personal = toStringList(details.personal_electrical_direct_names);
  const missingInPersonal = toStringList(details.missing_in_personal);
  const missingInInstallation = toStringList(details.missing_in_installation);

  const installationList = installation.length ? installation : missingInPersonal;
  const personalList = personal.length ? personal : missingInInstallation;
  const isPartial = !installation.length || !personal.length;

  return { installation: installationList, personal: personalList, isPartial };
}

function displayProjectName(value: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "-";
  const normalized = raw.replace(/^ÐœÐ˜\.?\s*2020\.?\s*154-Ð -\s*/i, "").trim();
  return normalized || "-";
}

function csvLine(values: Array<string | number>): string {
  return values
    .map((value) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    })
    .join(",");
}

async function fetchData<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: T } | null;
  if (!res.ok || json?.ok === false || !json?.data) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json.data;
}

export default function InstallationsWorkspace({ embedded = false }: Props) {
  const [projectCode, setProjectCode] = useState("A27");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [latestImportedDate, setLatestImportedDate] = useState<string | null>(null);
  const [projectCodes, setProjectCodes] = useState<string[]>(["A27"]);
  const [allDates, setAllDates] = useState<string[]>([]);

  const [monthData, setMonthData] = useState<MonthPayload | null>(null);
  const [dayData, setDayData] = useState<DayPayload | null>(null);
  const [rangeRows, setRangeRows] = useState<DayRow[]>([]);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [authGateError, setAuthGateError] = useState<string | null>(null);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingRange, setLoadingRange] = useState(false);
  const [autoDaySyncing, setAutoDaySyncing] = useState(false);
  const [autoDaySyncError, setAutoDaySyncError] = useState<string | null>(null);
  const autoSyncInFlightRef = useRef(false);
  const autoDaySyncInFlightRef = useRef(false);
  const lastAutoDaySyncKeyRef = useRef<string>("");
  const calendarPointerStartX = useRef<number | null>(null);
  const calendarPointerId = useRef<number | null>(null);
  const calendarWheelAccumulatorRef = useRef(0);
  const calendarWheelResetTimerRef = useRef<number | null>(null);
  const calendarDragResetTimerRef = useRef<number | null>(null);
  const [calendarDragX, setCalendarDragX] = useState(0);
  const [calendarDragging, setCalendarDragging] = useState(false);

  const [monthError, setMonthError] = useState<string | null>(null);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [showPersonnelMismatchDetails, setShowPersonnelMismatchDetails] = useState(false);

  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [budgetFilter, setBudgetFilter] = useState("ALL");
  const [orientationFilter, setOrientationFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/field-installation/me", { cache: "no-store" });
        if (!alive) return;
        if (res.status === 401) {
          setAuthed(false);
          return;
        }
        if (!res.ok) {
          setAuthed(true);
          setAuthGateError(`Module auth check failed (${res.status}).`);
          return;
        }
        setAuthed(true);
      } catch {
        if (!alive) return;
        setAuthed(true);
        setAuthGateError("Module auth check failed. Keeping workspace available.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadDates = useCallback(async () => {
    setLoadingDates(true);
    setDatesError(null);
    try {
      const params = new URLSearchParams({ projectCode });
      const data = await fetchData<DatesPayload>(`/api/field-installation/dates?${params.toString()}`);
      if (data.projectCodes.length) setProjectCodes(data.projectCodes);
      setAllDates(data.dates);
      setLatestImportedDate(data.latestImportedDate);
      if (data.latestImportedDate) {
        setSelectedDate(data.latestImportedDate);
      } else if (data.dates.length) {
        setSelectedDate(data.dates[0]);
      }
    } catch (error) {
      setDatesError(error instanceof Error ? error.message : "Failed to load dates.");
      setAllDates([]);
    } finally {
      setLoadingDates(false);
    }
  }, [projectCode]);

  const loadMonth = useCallback(async () => {
    const effectiveMonth = selectedDate ? selectedDate.slice(0, 7) : currentMonth();
    setLoadingMonth(true);
    setMonthError(null);
    try {
      const params = new URLSearchParams({ projectCode, month: effectiveMonth });
      const data = await fetchData<MonthPayload>(`/api/field-installation/month?${params.toString()}`);
      setMonthData(data);
    } catch (error) {
      setMonthError(error instanceof Error ? error.message : "Failed to load month.");
      setMonthData(null);
    } finally {
      setLoadingMonth(false);
    }
  }, [projectCode, selectedDate]);

  const loadDay = useCallback(
    async (date: string) => {
      if (!date) return;
      setLoadingDay(true);
      setDayError(null);
      try {
        const params = new URLSearchParams({ projectCode, date });
        const data = await fetchData<DayPayload>(`/api/field-installation/day?${params.toString()}`);
        setDayData(data);
      } catch (error) {
        setDayError(error instanceof Error ? error.message : "Failed to load day.");
        setDayData(null);
      } finally {
        setLoadingDay(false);
      }
    },
    [projectCode]
  );

  const loadRange = useCallback(
    async (from: string, to: string) => {
      if (!from || !to) return;
      setLoadingRange(true);
      setRangeError(null);
      try {
        const params = new URLSearchParams({ projectCode, from, to });
        const data = await fetchData<RangePayload>(`/api/field-installation/range?${params.toString()}`);
        setRangeRows(data.rows || []);
      } catch (error) {
        setRangeError(error instanceof Error ? error.message : "Failed to load cumulative rows.");
        setRangeRows([]);
      } finally {
        setLoadingRange(false);
      }
    },
    [projectCode]
  );

  useEffect(() => {
    if (!authed) return;
    void loadDates();
  }, [authed, loadDates]);

  useEffect(() => {
    if (!authed) return;
    void loadMonth();
  }, [authed, loadMonth]);

  useEffect(() => {
    if (!authed || embedded) return;
    void loadDay(selectedDate);
  }, [authed, embedded, loadDay, selectedDate]);

  useEffect(() => {
    if (!authed || !embedded) return;
    if (!allDates.length || !latestImportedDate) return;
    const firstDate = allDates[allDates.length - 1];
    if (!firstDate) return;
    void loadRange(firstDate, latestImportedDate);
  }, [allDates, authed, embedded, latestImportedDate, loadRange]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDates(), loadMonth(), !embedded ? loadDay(selectedDate) : Promise.resolve()]);
  }, [embedded, loadDates, loadDay, loadMonth, selectedDate]);

  const refreshIndex = useCallback(async (silent = false) => {
    if (!silent) setActionInfo(null);
    try {
      const params = new URLSearchParams({ projectCode });
      const res = await fetch(`/api/field-installation/sync?${params.toString()}`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Refresh failed (${res.status})`);
      }
      if (!silent) setActionInfo("File index refreshed from storage.");
      await refreshAll();
    } catch (error) {
      if (!silent) setActionInfo(error instanceof Error ? error.message : "Failed to refresh file index.");
    }
  }, [projectCode, refreshAll]);

  const autoIngestMissing = useCallback(async (silent = false) => {
    if (!silent) setActionInfo(null);
    try {
      const res = await fetch("/api/jobs/field-installation-auto-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectCode }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        data?: { scanned?: number; skipped?: number; ingested?: number; failed?: number };
      } | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Auto-ingest failed (${res.status})`);
      }
      if (!silent) {
        setActionInfo(
          `Auto-ingest complete. Scanned ${payload?.data?.scanned ?? 0}, skipped ${payload?.data?.skipped ?? 0}, ingested ${payload?.data?.ingested ?? 0}, failed ${payload?.data?.failed ?? 0}.`
        );
      }
      await refreshAll();
    } catch (error) {
      if (!silent) setActionInfo(error instanceof Error ? error.message : "Auto-ingest failed.");
    }
  }, [projectCode, refreshAll]);

  useEffect(() => {
    if (!authed) return;

    let cancelled = false;
    const runAutoSync = async () => {
      if (cancelled || autoSyncInFlightRef.current) return;
      autoSyncInFlightRef.current = true;
      try {
        await refreshIndex(true);
        await autoIngestMissing(true);
      } finally {
        autoSyncInFlightRef.current = false;
      }
    };

    void runAutoSync();
    const timer = window.setInterval(() => {
      void runAutoSync();
    }, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authed, autoIngestMissing, refreshIndex]);

  const selectableDates = useMemo(() => allDates, [allDates]);

  useEffect(() => {
    if (!selectableDates.length) return;
    if (!selectableDates.includes(selectedDate)) {
      setSelectedDate(selectableDates[0]);
    }
  }, [selectableDates, selectedDate]);
  const hasDaySummary = Boolean(dayData?.summary?.id);

  const changeMonth = useCallback(
    (deltaMonths: number) => {
      setSelectedDate((currentDate) => shiftMonthDate(currentDate, deltaMonths, selectableDates));
    },
    [selectableDates]
  );

  const handleCalendarPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-calendar-day-button="true"]')) return;
    calendarPointerStartX.current = event.clientX;
    calendarPointerId.current = event.pointerId;
    setCalendarDragging(true);
    setCalendarDragX(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleCalendarPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (calendarPointerId.current !== event.pointerId) return;
    const startX = calendarPointerStartX.current;
    if (startX === null) return;
    const deltaX = event.clientX - startX;
    const limited = Math.max(-160, Math.min(160, deltaX));
    setCalendarDragX(limited);
  }, []);

  const handleCalendarPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (calendarPointerId.current !== event.pointerId) return;
      const startX = calendarPointerStartX.current;
      calendarPointerStartX.current = null;
      calendarPointerId.current = null;
      setCalendarDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (startX === null) {
        setCalendarDragX(0);
        return;
      }

      const deltaX = event.clientX - startX;
      if (Math.abs(deltaX) < 40) {
        setCalendarDragX(0);
        return;
      }

      const direction = deltaX < 0 ? 1 : -1;
      setCalendarDragX(direction > 0 ? -120 : 120);
      if (calendarDragResetTimerRef.current !== null) {
        window.clearTimeout(calendarDragResetTimerRef.current);
      }
      calendarDragResetTimerRef.current = window.setTimeout(() => {
        changeMonth(direction);
        setCalendarDragX(0);
        calendarDragResetTimerRef.current = null;
      }, 120);
    },
    [changeMonth]
  );

  const handleCalendarPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (calendarPointerId.current !== event.pointerId) return;
    calendarPointerStartX.current = null;
    calendarPointerId.current = null;
    setCalendarDragging(false);
    setCalendarDragX(0);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const handleCalendarWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.deltaY === 0) return;
      event.preventDefault();

      calendarWheelAccumulatorRef.current += event.deltaY;
      const threshold = 90;
      const accumulated = calendarWheelAccumulatorRef.current;

      if (calendarWheelResetTimerRef.current !== null) {
        window.clearTimeout(calendarWheelResetTimerRef.current);
      }
      calendarWheelResetTimerRef.current = window.setTimeout(() => {
        calendarWheelAccumulatorRef.current = 0;
        calendarWheelResetTimerRef.current = null;
      }, 260);

      if (Math.abs(accumulated) >= threshold) {
        const deltaMonths = accumulated > 0 ? 1 : -1;
        calendarWheelAccumulatorRef.current = 0;
        setCalendarDragX(deltaMonths > 0 ? -120 : 120);
        if (calendarDragResetTimerRef.current !== null) {
          window.clearTimeout(calendarDragResetTimerRef.current);
        }
        calendarDragResetTimerRef.current = window.setTimeout(() => {
          changeMonth(deltaMonths);
          setCalendarDragX(0);
          calendarDragResetTimerRef.current = null;
        }, 120);
        return;
      }

      setCalendarDragX(event.deltaY > 0 ? -42 : 42);
      if (calendarDragResetTimerRef.current !== null) {
        window.clearTimeout(calendarDragResetTimerRef.current);
      }
      calendarDragResetTimerRef.current = window.setTimeout(() => {
        setCalendarDragX(0);
        calendarDragResetTimerRef.current = null;
      }, 140);
    },
    [changeMonth]
  );

  useEffect(() => {
    return () => {
      if (calendarWheelResetTimerRef.current !== null) {
        window.clearTimeout(calendarWheelResetTimerRef.current);
      }
      if (calendarDragResetTimerRef.current !== null) {
        window.clearTimeout(calendarDragResetTimerRef.current);
      }
    };
  }, []);

  const calendarDragScale = useMemo(() => {
    const distance = Math.abs(calendarDragX);
    return 1 - Math.min(distance / 950, 0.085);
  }, [calendarDragX]);
  const calendarDragOffset = useMemo(() => calendarDragX * 0.18, [calendarDragX]);
  const calendarDragDistance = useMemo(() => Math.abs(calendarDragX), [calendarDragX]);
  const calendarLiftY = useMemo(() => Math.min(calendarDragDistance * 0.08, 12), [calendarDragDistance]);

  useEffect(() => {
    if (!authed || embedded) return;
    if (!selectedDate) return;
    if (!dayData?.file?.id) return;
    if (dayData.file.work_date !== selectedDate) return;

    const hasFileInMonth = Boolean(monthData?.days?.find((day) => day.date === selectedDate && day.hasFile));
    const hasFile = hasFileInMonth || Boolean(dayData?.file);
    if (!hasFile) return;
    const fileId = dayData.file.id;

    const fileUpdatedAt = dayData?.file?.updated_at || "na";
    const summaryUpdatedAt = dayData?.summary?.updated_at || "na";
    const syncKey = `${projectCode}|${selectedDate}|${fileUpdatedAt}|${summaryUpdatedAt}`;
    const needsSync =
      !hasDaySummary ||
      !dayData?.rows?.length ||
      (dayData?.file?.updated_at && dayData?.summary?.updated_at && dayData.file.updated_at > dayData.summary.updated_at);
    if (!needsSync) return;
    if (lastAutoDaySyncKeyRef.current === syncKey || autoDaySyncInFlightRef.current) return;

    lastAutoDaySyncKeyRef.current = syncKey;
    autoDaySyncInFlightRef.current = true;
    setAutoDaySyncing(true);
    setAutoDaySyncError(null);

    (async () => {
      try {
        const res = await fetch("/api/field-installation/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId }),
        });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || payload?.ok === false) {
          throw new Error(payload?.error || `Auto day sync failed (${res.status})`);
        }
        setActionInfo(`Auto synced ${selectedDate}.`);
        await Promise.all([loadDay(selectedDate), loadMonth()]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Auto day sync failed.";
        setAutoDaySyncError(message);
        setActionInfo(message);
      } finally {
        autoDaySyncInFlightRef.current = false;
        setAutoDaySyncing(false);
      }
    })();
  }, [
    authed,
    dayData?.file,
    dayData?.file?.id,
    dayData?.rows?.length,
    hasDaySummary,
    dayData?.summary?.updated_at,
    embedded,
    loadDay,
    loadMonth,
    monthData?.days,
    projectCode,
    selectedDate,
  ]);

  const rows = useMemo(() => (embedded ? rangeRows : dayData?.rows || []), [dayData?.rows, embedded, rangeRows]);

  const zoneOptions = useMemo(() => Array.from(new Set(rows.map((r) => (r.zone || "").trim()).filter(Boolean))).sort(), [rows]);
  const floorOptions = useMemo(() => Array.from(new Set(rows.map((r) => (r.floor || "").trim()).filter(Boolean))).sort(), [rows]);
  const budgetOptions = useMemo(() => Array.from(new Set(rows.map((r) => (r.budget_code || "").trim()).filter(Boolean))).sort(), [rows]);
  const orientationOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => (r.orientation || "").trim().toUpperCase()).filter(Boolean))).sort(),
    [rows]
  );
  const monthOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => (r.work_date || "").slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [rows]
  );
  const cumulativeDateRange = useMemo(() => {
    if (!embedded) return { start: null as string | null, end: null as string | null };

    const rowDates = Array.from(
      new Set(
        rangeRows
          .map((row) => (row.work_date || "").trim())
          .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      )
    ).sort();

    const indexedDates = Array.from(new Set(allDates.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))).sort();

    const start = rowDates[0] || indexedDates[0] || null;
    const end = latestImportedDate || rowDates[rowDates.length - 1] || indexedDates[indexedDates.length - 1] || null;
    return { start, end };
  }, [allDates, embedded, latestImportedDate, rangeRows]);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (zoneFilter !== "ALL" && (row.zone || "") !== zoneFilter) return false;
      if (floorFilter !== "ALL" && (row.floor || "") !== floorFilter) return false;
      if (budgetFilter !== "ALL" && (row.budget_code || "") !== budgetFilter) return false;
      if (orientationFilter !== "ALL" && (row.orientation || "").toUpperCase() !== orientationFilter) return false;
      if (monthFilter !== "ALL" && !(row.work_date || "").startsWith(`${monthFilter}-`)) return false;
      if (!q) return true;
      const line = `${row.zone || ""} ${row.floor || ""} ${row.budget_code || ""} ${row.activity_code || ""} ${row.description || ""}`.toLowerCase();
      return line.includes(q);
    });
  }, [budgetFilter, floorFilter, monthFilter, orientationFilter, rows, search, zoneFilter]);

  const monthTotals = useMemo(() => {
    if (embedded) {
      return {
        month: null as string | null,
        qty: rows.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        manhours: rows.reduce((sum, row) => sum + Number(row.manhours || 0), 0),
      };
    }
    return {
      month: selectedDate ? selectedDate.slice(0, 7) : null,
      qty: rows.reduce((sum, row) => sum + Number(row.qty || 0), 0),
      manhours: rows.reduce((sum, row) => sum + Number(row.manhours || 0), 0),
    };
  }, [embedded, monthFilter, rows, selectedDate]);

  const pivotRows = useMemo(() => {
    const map = new Map<string, { budget_code: string; activity_code: string; description: string; qty: number; manhours: number }>();
    for (const row of filteredRows) {
      const budget = row.budget_code || "-";
      const activity = row.activity_code || "-";
      const description = row.description || "-";
      const key = `${budget}|${activity}|${description}`;
      const prev = map.get(key) || { budget_code: budget, activity_code: activity, description, qty: 0, manhours: 0 };
      prev.qty += Number(row.qty || 0);
      prev.manhours += Number(row.manhours || 0);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.manhours - a.manhours);
  }, [filteredRows]);

  const summary = useMemo(() => {
    const materialMh = dayData?.summary?.material_total_mh ?? rows.reduce((sum, row) => sum + Number(row.manhours || 0), 0);
    const peopleMh = dayData?.summary?.people_total_mh ?? null;
    const deltaMh = dayData?.summary?.delta_mh ?? (peopleMh === null ? null : materialMh - peopleMh);
    const mhMatchOk = dayData?.summary?.mh_match_ok ?? (peopleMh === null ? null : Math.abs(materialMh - peopleMh) <= 0.5);
    const attendanceMatchOk = dayData?.summary?.attendance_match_ok ?? null;
    const mismatchReasons = (dayData?.summary?.mismatch_reasons || []).filter(Boolean);
    const normalizedWarnings = (dayData?.summary?.warnings || []).filter((item) => {
      const message = String(item?.message || "").trim();
      if (!message) return false;
      return !isLegacyPeopleMismatchWarning(message);
    });
    const directPersonnelWarning = normalizedWarnings.find((item) => String(item.code || "").trim().toLowerCase() === "direct_personnel_mismatch") || null;
    const warnings = normalizedWarnings.filter((item) => String(item.code || "").trim().toLowerCase() !== "direct_personnel_mismatch");
    return {
      materialMh,
      peopleMh,
      deltaMh,
      mhMatchOk,
      attendanceMatchOk,
      mismatchReasons,
      warnings,
      directPersonnelWarning,
      isMismatch: mismatchReasons.length > 0,
    };
  }, [dayData?.summary, rows]);

  const personnelColumns = useMemo(() => extractPersonnelColumns(summary.directPersonnelWarning?.details || null), [summary.directPersonnelWarning]);

  const exportCsv = useCallback(() => {
    const headers = [
      "Date",
      "Budget Code",
      "Activity Code",
      "Description",
      "Qty",
      "Unit",
      "Manhours",
      "WorkersCount",
      "Zone",
      "Floor",
      "Orientation",
    ];

    const lines = [csvLine(headers)];
    for (const row of filteredRows) {
      const manhours = Number(row.manhours || 0);
      lines.push(
        csvLine([
          row.work_date || selectedDate,
          row.budget_code || "",
          row.activity_code || "",
          row.description || "",
          row.qty ?? "",
          row.unit || "",
          row.manhours ?? "",
          Number((manhours / 10).toFixed(2)),
          row.zone || "",
          row.floor || "",
          row.orientation || "",
        ])
      );
    }

    const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${projectCode}-Gunluk-Rapor-${selectedDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [filteredRows, projectCode, selectedDate]);

  if (authed === false) {
    return (
        <Card className="border-white/20 bg-black/35 text-zinc-100">
        <CardHeader>
          <CardTitle>Daily Installation Report</CardTitle>
          <CardDescription className="text-zinc-300">Please sign in to view this module.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="inline-flex items-center rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/5">
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div className="rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,#0d1119_0%,#06080e_100%)] p-4 text-zinc-100 shadow-[0_24px_50px_rgba(0,0,0,0.45)] md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold">Daily Installation Report</h1>
              <p className="mt-1 text-sm text-zinc-300">Field installation ingestion, validation, and day-level follow-up.</p>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="min-w-[120px] space-y-1 text-xs text-zinc-400">
                  Project
                  <select value={projectCode} onChange={(event) => setProjectCode(event.target.value)} className="h-9 min-w-[120px] rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100">
                    {projectCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 text-xs text-zinc-400">Select day directly from the calendar.</div>
              {latestImportedDate ? <div className="mt-2 text-xs text-zinc-400">Last imported file date: {latestImportedDate}</div> : null}
              {actionInfo ? <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200">{actionInfo}</div> : null}
              {datesError ? <div className="mt-2 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{datesError}</div> : null}
            </div>

            <div
              className="w-full max-w-[330px] touch-pan-y select-none rounded-2xl border border-white/20 bg-black/35 p-3 will-change-transform"
              onPointerDown={handleCalendarPointerDown}
              onPointerMove={handleCalendarPointerMove}
              onPointerUp={handleCalendarPointerUp}
              onPointerCancel={handleCalendarPointerCancel}
              onWheel={handleCalendarWheel}
              style={{
                transform: `translateX(${calendarDragOffset}px) translateY(${-calendarLiftY}px) scale(${calendarDragScale})`,
                transition: calendarDragging
                  ? "transform 90ms linear"
                  : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {loadingDates || loadingMonth ? (
                <div className="py-8 text-sm text-zinc-300">Loading month...</div>
              ) : monthError ? (
                <div className="py-8 text-sm text-red-300">{monthError}</div>
              ) : (
                <FieldInstallationCalendar
                  monthToken={selectedDate ? selectedDate.slice(0, 7) : currentMonth()}
                  days={monthData?.days || []}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[110px] space-y-1 text-xs text-zinc-400">
            Project
            <select value={projectCode} onChange={(event) => setProjectCode(event.target.value)} className="h-9 min-w-[110px] rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100">
              {projectCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[150px] space-y-1 text-xs text-zinc-400">
            Month filter
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="h-9 min-w-[150px] rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100">
              <option value="ALL">All months</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {embedded && actionInfo ? <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200">{actionInfo}</div> : null}
      {embedded && datesError ? <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{datesError}</div> : null}
      {embedded && latestImportedDate ? <div className="text-xs text-zinc-400">Last imported file date: {latestImportedDate}</div> : null}
      {authGateError ? <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{authGateError}</div> : null}

      <div className="grid gap-4 grid-cols-1">
        <Card className="gap-3 rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,#0d1119_0%,#06080e_100%)] py-4 text-zinc-100 shadow-[0_24px_50px_rgba(0,0,0,0.45)]">
          <CardHeader className="px-4 pb-0 md:px-5">
            <CardTitle className="text-base">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-400" />
                {embedded
                  ? `Cumulative Reports${cumulativeDateRange.start && cumulativeDateRange.end ? ` (${formatDateLabel(cumulativeDateRange.start)} - ${formatDateLabel(cumulativeDateRange.end)})` : ""}`
                  : formatDateLabel(selectedDate)}
              </span>
            </CardTitle>
            <CardDescription className="text-zinc-300">
              {embedded
                ? "All installation reports from first indexed file to latest indexed file."
                : dayData?.file
                  ? `File: ${dayData.file.file_name}${dayData.file.revision ? ` â€¢ ${dayData.file.revision}` : ""}`
                  : "No report uploaded for this date"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-4 md:px-5">
            {!embedded && !loadingDay && !dayError && !dayData?.file ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
                <div>No report uploaded for this date yet.</div>
                <div className="mt-2 text-xs text-zinc-400">Storage indexing runs automatically every 2 minutes.</div>
              </div>
            ) : null}

            {!embedded && !loadingDay && !dayError && dayData?.file && rows.length === 0 ? (
              <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  File exists but it has not been ingested yet.
                </div>
                <div className="mt-2 text-xs text-amber-100/80">
                  {autoDaySyncing ? "Automatic ingestion is in progress." : autoDaySyncError || "Waiting for automatic ingestion retry."}
                </div>
              </div>
            ) : null}

            {!embedded ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <KpiCard label="Material MH" value={formatNum(summary.materialMh)} />
                <KpiCard label="People MH" value={formatNum(summary.peopleMh)} />
                <KpiCard label="Delta" value={formatNum(summary.deltaMh)} />
              </div>
            ) : null}

            {!embedded && dayData?.summary ? (
              <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-zinc-400">Validation checks</div>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                      summary.isMismatch ? "border-rose-300/35 bg-rose-500/18 text-rose-100" : "border-emerald-300/35 bg-emerald-500/18 text-emerald-100"
                    }`}
                  >
                    {summary.isMismatch ? "Mismatch detected" : "All checks OK"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-zinc-300">MH Material vs Direct</div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${checkBadgeClass(summary.mhMatchOk)}`}>
                        {checkLabel(summary.mhMatchOk)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                      Material {formatNum(summary.materialMh)} vs Direct {formatNum(dayData.summary.direct_total_mh ?? summary.peopleMh)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (summary.attendanceMatchOk === false) {
                        setShowPersonnelMismatchDetails((prev) => !prev);
                      }
                    }}
                    className={`rounded-lg border border-white/10 bg-black/30 p-2 text-left ${
                      summary.attendanceMatchOk === false ? "transition hover:border-rose-300/35 hover:bg-rose-500/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-zinc-300">Direct Personnel vs Attendance</div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${checkBadgeClass(summary.attendanceMatchOk)}`}>
                        {checkLabel(summary.attendanceMatchOk)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400">Installation direct names vs Daily Personal Reports (Electrical-Direct).</div>
                    {summary.attendanceMatchOk === false ? (
                      <div className="mt-1 text-[11px] text-rose-200 underline underline-offset-2">
                        {showPersonnelMismatchDetails ? "Hide mismatch details" : "Show mismatch details"}
                      </div>
                    ) : null}
                  </button>
                </div>

                {summary.attendanceMatchOk === false && showPersonnelMismatchDetails ? (
                  <div className="mt-3 rounded-md border border-rose-300/25 bg-rose-500/10 p-2">
                    <div className="mb-2 text-xs text-rose-100">Personnel comparison</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-white/10 bg-black/30 p-2">
                        <div className="text-[11px] font-medium text-zinc-200">Daily Installation Reports</div>
                        <ul className="mt-1 space-y-1 text-xs text-zinc-200">
                          {personnelColumns.installation.length ? (
                            personnelColumns.installation.map((name, index) => (
                              <li key={`inst-${name}-${index}`} className="rounded border border-white/10 bg-black/20 px-2 py-1">
                                {name}
                              </li>
                            ))
                          ) : (
                            <li className="text-zinc-400">No names in warning payload.</li>
                          )}
                        </ul>
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/30 p-2">
                        <div className="text-[11px] font-medium text-zinc-200">Daily Personal Reports</div>
                        <ul className="mt-1 space-y-1 text-xs text-zinc-200">
                          {personnelColumns.personal.length ? (
                            personnelColumns.personal.map((name, index) => (
                              <li key={`pers-${name}-${index}`} className="rounded border border-white/10 bg-black/20 px-2 py-1">
                                {name}
                              </li>
                            ))
                          ) : (
                            <li className="text-zinc-400">No names in warning payload.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                    {personnelColumns.isPartial ? <div className="mt-2 text-[11px] text-zinc-400">Legacy warning payload detected; showing available mismatch names.</div> : null}
                  </div>
                ) : null}

                {summary.mismatchReasons.length ? (
                  <div className="mt-3">
                    <div className="text-xs text-zinc-400">Mismatch reasons</div>
                    <ul className="mt-1 space-y-1 text-xs text-rose-100">
                      {summary.mismatchReasons.map((reason, index) => (
                        <li key={`${reason}-${index}`} className="rounded-md border border-rose-300/25 bg-rose-500/10 px-2 py-1">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summary.warnings.length ? (
                  <div className="mt-3">
                    <div className="text-xs text-zinc-400">Parser/import warnings</div>
                    <ul className="mt-1 space-y-1 text-xs text-amber-100">
                      {summary.warnings.map((warning, index) => (
                        <li key={`${warning.code}-${index}`} className="rounded-md border border-amber-300/25 bg-amber-500/10 px-2 py-1">
                          {warning.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <KpiCard label="Total Qty" value={formatNum(monthTotals.qty)} />
              <KpiCard label="Total Manhours" value={formatNum(monthTotals.manhours)} />
            </div>

            {loadingDay || loadingRange ? (
              <div className="py-10 text-sm text-zinc-300">Loading day details...</div>
            ) : dayError || rangeError ? (
              <div className="py-10 text-sm text-red-300">{dayError || rangeError}</div>
            ) : (
              <Tabs defaultValue="rows" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TabsList className="rounded-lg border border-white/15 bg-black/35 p-1 text-zinc-300">
                    <TabsTrigger value="rows">Rows</TabsTrigger>
                    <TabsTrigger value="pivot">Pivot</TabsTrigger>
                  </TabsList>
                  <Button onClick={exportCsv} className="h-9 gap-2 border-white/20 bg-black/45 text-zinc-100 hover:bg-black/60" disabled={!filteredRows.length}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>

                <TabsContent value="rows" className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="h-9 rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100">
                      <option value="ALL">All zones</option>
                      {zoneOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="h-9 rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100">
                      <option value="ALL">All floors</option>
                      {floorOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select value={budgetFilter} onChange={(e) => setBudgetFilter(e.target.value)} className="h-9 rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100">
                      <option value="ALL">All budget codes</option>
                      {budgetOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select value={orientationFilter} onChange={(e) => setOrientationFilter(e.target.value)} className="h-9 rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100">
                      <option value="ALL">All orientation</option>
                      {orientationOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 border-white/20 bg-black/45 text-zinc-100" />
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[1700px] text-sm">
                      <thead className="bg-black/40 text-xs uppercase tracking-[0.08em] text-zinc-400">
                        <tr>
                          <th className="px-3 py-2 text-right">No</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">M/D</th>
                          <th className="px-3 py-2 text-left">Location</th>
                          <th className="px-3 py-2 text-left">Zone</th>
                          <th className="px-3 py-2 text-center">Floor</th>
                          <th className="px-3 py-2 text-center">Elevation</th>
                          <th className="px-3 py-2 text-center">Team</th>
                          <th className="px-3 py-2 text-left">Budget</th>
                          <th className="px-3 py-2 text-center">Activity</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Mh</th>
                          <th className="px-3 py-2 text-center">Project Name</th>
                          <th className="px-3 py-2 text-center">Orientation</th>
                          <th className="px-3 py-2 text-left">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => (
                          <tr key={row.id} className="border-t border-white/10">
                            <td className="px-3 py-2 text-right">{row.row_no ?? "-"}</td>
                            <td className="px-3 py-2">{row.work_date ? formatDateLabel(row.work_date) : "-"}</td>
                            <td className="px-3 py-2">{row.install_action || "-"}</td>
                            <td className="px-3 py-2">{row.location || "-"}</td>
                            <td className="px-3 py-2">{row.zone || "-"}</td>
                            <td className="px-3 py-2 text-center">{row.floor || "-"}</td>
                            <td className="px-3 py-2 text-center">{row.elevation || "-"}</td>
                            <td className="px-3 py-2 text-center">{row.team_no ?? "-"}</td>
                            <td className="px-3 py-2">{row.budget_code || "-"}</td>
                            <td className="px-3 py-2 text-center">{row.activity_code || "-"}</td>
                            <td className="px-3 py-2">{row.description || "-"}</td>
                            <td className="px-3 py-2">{row.unit || "-"}</td>
                            <td className="px-3 py-2 text-right">{formatNum(row.qty)}</td>
                            <td className="px-3 py-2 text-right">{formatNum(row.manhours)}</td>
                            <td className="px-3 py-2 text-center">{displayProjectName(row.project_name)}</td>
                            <td className="px-3 py-2 text-center">{row.orientation || "-"}</td>
                            <td className="px-3 py-2">{row.comment || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="pivot" className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead className="bg-black/40 text-xs uppercase tracking-[0.08em] text-zinc-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Budget Code</th>
                          <th className="px-3 py-2 text-left">Activity Code</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Total Qty</th>
                          <th className="px-3 py-2 text-right">Total Manhours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pivotRows.map((row) => (
                          <tr key={`${row.budget_code}|${row.activity_code}|${row.description}`} className="border-t border-white/10">
                            <td className="px-3 py-2">{row.budget_code}</td>
                            <td className="px-3 py-2">{row.activity_code}</td>
                            <td className="px-3 py-2">{row.description}</td>
                            <td className="px-3 py-2 text-right">{formatNum(row.qty)}</td>
                            <td className="px-3 py-2 text-right">{formatNum(row.manhours)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "bad" ? "border-rose-300/25 bg-rose-500/10" : tone === "good" ? "border-emerald-300/25 bg-emerald-500/10" : "border-white/10 bg-black/30"}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
