"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, Download, Loader2, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Segment = "Indirect" | "Direct" | "Mobilization";
type Discipline = "Electrical" | "Mechanical" | "Shared" | "Total";
type DisciplineNoTotal = Exclude<Discipline, "Total">;
type Status = "Present" | "Absent" | "All";
type SegmentFilter = Segment | "All";

type CellCounts = { present: number; absent: number; total: number };
type Selection = { segment: SegmentFilter; discipline: Discipline; status: Status } | null;

type Person = {
  employee_id: string;
  full_name: string;
  company: string | null;
  segment: Segment;
  discipline: DisciplineNoTotal;
  status: Exclude<Status, "All">;
  absence_reason?: string | null;
  profession_actual: string | null;
  profession_official: string | null;
  profession_grouped: string | null;
};

type PivotRow = { profession: string; present: number; absent: number; total: number };

const SEGMENTS: Segment[] = ["Indirect", "Direct", "Mobilization"];
const DISCIPLINES: Discipline[] = ["Electrical", "Mechanical", "Shared", "Total"];

type ApiCell = { present: number; absent: number; total: number };
type ApiMatrix = Record<string, Record<string, ApiCell>>;
type SummaryResponse = {
  ok: boolean;
  error?: string;
  data: {
    matrix: ApiMatrix;
    hasData?: boolean;
    rowCount?: number;
  };
};
type DetailsResponse = {
  ok?: boolean;
  error?: string;
  data?: {
    rows?: Person[];
    hasData?: boolean;
    rowCount?: number;
  };
};
type ProfessionsResponse = {
  ok?: boolean;
  error?: string;
  data?: {
    rows?: PivotRow[];
    hasData?: boolean;
    rowCount?: number;
  };
};
type DatesResponse = { ok?: boolean; error?: string; data?: { dates?: string[] } };
type AvailableStorageFile = {
  storagePath: string;
  fileName: string;
  sourceRoot: string;
  detectedDate: string | null;
  alreadyImported: boolean;
};
type AvailableFilesResponse = {
  ok?: boolean;
  error?: string;
  data?: {
    hasImportedFileForDate?: boolean;
    hasImportJobForDate?: boolean;
    filesForDate?: AvailableStorageFile[];
    files?: AvailableStorageFile[];
    monthDatesWithData?: string[];
  };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DEFAULT_REPORT_DATE = new Date().toISOString().slice(0, 10);

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

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
  if (monthDates.length === 0) return preferredIso;
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

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseSegment(value: string | null): SegmentFilter | null {
  if (!value) return null;
  if (value === "All") return "All";
  if ((SEGMENTS as readonly string[]).includes(value)) return value as Segment;
  return null;
}

function parseDiscipline(value: string | null): Discipline | null {
  if (!value) return null;
  if ((DISCIPLINES as readonly string[]).includes(value)) return value as Discipline;
  return null;
}

function parseStatus(value: string | null): Status | null {
  if (!value) return null;
  if (value === "Present" || value === "Absent" || value === "All") return value;
  return null;
}

function parseRevisionRank(fileName: string): number {
  const m = fileName.match(/(?:_|-)rev(\d{1,3})/i);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

export default function AttendanceWorkspace(): React.ReactElement {
  const PROJECT_CODE = "A27";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialParamsRef = useRef<{
    date: string;
    selection: Selection;
    search: string;
    company: string;
    professionChip: string | null;
  } | null>(null);

  if (!initialParamsRef.current) {
    const queryDate = searchParams.get("date");
    const segment = parseSegment(searchParams.get("segment"));
    const discipline = parseDiscipline(searchParams.get("discipline"));
    const status = parseStatus(searchParams.get("status"));
    initialParamsRef.current = {
      date: queryDate && isIsoDate(queryDate) ? queryDate : DEFAULT_REPORT_DATE,
      selection:
        segment && discipline && status
          ? {
              segment,
              discipline,
              status,
            }
          : null,
      search: searchParams.get("q") || "",
      company: searchParams.get("company") || "All",
      professionChip: searchParams.get("profession") || null,
    };
  }

  const [date, setDate] = useState<string>(initialParamsRef.current.date);
  const [refreshKey, setRefreshKey] = useState(0);

  const calendarPointerStartX = useRef<number | null>(null);
  const calendarPointerId = useRef<number | null>(null);
  const autoImportAttemptRef = useRef<string>("");
  const [calendarDragX, setCalendarDragX] = useState(0);
  const [calendarDragging, setCalendarDragging] = useState(false);
  const [importingFromStorage, setImportingFromStorage] = useState(false);
  const [monthlyExportOpen, setMonthlyExportOpen] = useState(false);
  const [monthlyExporting, setMonthlyExporting] = useState(false);
  const [monthlyExportProjectCode, setMonthlyExportProjectCode] = useState(PROJECT_CODE);
  const [monthlyExportMonth, setMonthlyExportMonth] = useState(date.slice(0, 7));
  const [monthlyExportErr, setMonthlyExportErr] = useState<string | null>(null);
  const [importOkMsg, setImportOkMsg] = useState<string | null>(null);
  const [importErrMsg, setImportErrMsg] = useState<string | null>(null);

  const [selection, setSelection] = useState<Selection>(initialParamsRef.current.selection);
  const [tab, setTab] = useState<"people" | "pivot">("people");

  const [search, setSearch] = useState(initialParamsRef.current.search);
  const [company, setCompany] = useState<string>(initialParamsRef.current.company);
  const [professionChip, setProfessionChip] = useState<string | null>(initialParamsRef.current.professionChip);

  const [summaryMatrix, setSummaryMatrix] = useState<ApiMatrix | null>(null);
  const [summaryHasData, setSummaryHasData] = useState(false);
  const [summaryRowCount, setSummaryRowCount] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  const [pivotRows, setPivotRows] = useState<PivotRow[]>([]);
  const [companies, setCompanies] = useState<string[]>(["All"]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableFilesForDate, setAvailableFilesForDate] = useState<AvailableStorageFile[]>([]);
  const [hasImportedFileForDate, setHasImportedFileForDate] = useState(false);
  const [hasImportJobForDate, setHasImportJobForDate] = useState(false);

  const lastUrlRef = useRef<string>("");

  useEffect(() => {
    autoImportAttemptRef.current = "";
  }, [date]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("date", date);
    if (selection) {
      params.set("segment", selection.segment);
      params.set("discipline", selection.discipline);
      params.set("status", selection.status);
    }
    if (company && company !== "All") params.set("company", company);
    if (search.trim()) params.set("q", search.trim());
    if (professionChip) params.set("profession", professionChip);

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (lastUrlRef.current === href) return;
    lastUrlRef.current = href;
    router.replace(href, { scroll: false });
  }, [pathname, router, date, selection, company, search, professionChip]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const json = await api<SummaryResponse>(
          `/api/daily-personal-reports/summary?projectCode=A27&date=${encodeURIComponent(date)}`
        );
        if (!json.ok) throw new Error(json.error || "Failed to load summary");
        if (!cancelled) {
          setSummaryMatrix(json.data.matrix);
          setSummaryHasData(Boolean(json.data.hasData));
          setSummaryRowCount(Number(json.data.rowCount || 0));
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setSummaryError(getErrorMessage(e, "Failed to load summary"));
          setSummaryHasData(false);
          setSummaryRowCount(0);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  const matrix = useMemo((): Record<string, CellCounts> => {
    const m: Record<string, CellCounts> = {};
    for (const s of SEGMENTS) {
      for (const d of DISCIPLINES) {
        const cell = summaryMatrix?.[s]?.[d] ?? { present: 0, absent: 0, total: 0 };
        m[`${s}|${d}`] = cell;
      }
    }
    return m;
  }, [summaryMatrix]);

  const matrixTotals = useMemo((): Record<Discipline, CellCounts> => {
    const totals: Record<Discipline, CellCounts> = {
      Electrical: { present: 0, absent: 0, total: 0 },
      Mechanical: { present: 0, absent: 0, total: 0 },
      Shared: { present: 0, absent: 0, total: 0 },
      Total: { present: 0, absent: 0, total: 0 },
    };

    for (const seg of SEGMENTS) {
      for (const d of DISCIPLINES) {
        const c = matrix[`${seg}|${d}`] ?? { present: 0, absent: 0, total: 0 };
        totals[d].present += c.present;
        totals[d].absent += c.absent;
        totals[d].total += c.total;
      }
    }

    return totals;
  }, [matrix]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selection) return;

      setPeopleLoading(true);
      try {
        const url =
          `/api/daily-personal-reports/details?projectCode=A27&date=${encodeURIComponent(date)}` +
          `&segment=${encodeURIComponent(selection.segment)}` +
          `&discipline=${encodeURIComponent(selection.discipline)}` +
          `&status=${encodeURIComponent(selection.status)}` +
          `&q=${encodeURIComponent(search)}` +
          `&company=${encodeURIComponent(company === "All" ? "" : company)}` +
          "&professionMode=grouped" +
          `&profession=${encodeURIComponent(professionChip ?? "")}` +
          "&page=1&pageSize=500";

        const details = await api<DetailsResponse>(url);
        if (details.ok === false) throw new Error(details.error || "Failed to load details");
        if (!cancelled) setPeople(details.data?.rows ?? []);
      } catch {
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setPeopleLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [selection, date, search, company, professionChip, refreshKey]);

  useEffect(() => {
    setSelection(null);
    setPeople([]);
    setPivotRows([]);
  }, [date]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selection) return;

      const pivot = await api<ProfessionsResponse>(
        `/api/daily-personal-reports/professions?projectCode=A27&date=${encodeURIComponent(date)}` +
          `&segment=${encodeURIComponent(selection.segment)}` +
          `&discipline=${encodeURIComponent(selection.discipline)}` +
          `&status=${encodeURIComponent(selection.status)}` +
          "&mode=grouped"
      );

      const all = await api<DetailsResponse>(
        `/api/daily-personal-reports/details?projectCode=A27&date=${encodeURIComponent(date)}` +
          `&segment=${encodeURIComponent(selection.segment)}` +
          `&discipline=${encodeURIComponent(selection.discipline)}` +
          `&status=${encodeURIComponent(selection.status)}` +
          "&q=&company=&professionMode=grouped&profession=" +
          "&page=1&pageSize=500"
      );

      const rows = all.data?.rows ?? [];
      const set = new Set<string>();
      for (const r of rows) {
        if (r.company) set.add(r.company);
      }

      if (!cancelled) {
        setPivotRows(pivot.data?.rows ?? []);
        setCompanies(["All", ...Array.from(set).sort()]);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selection, date, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const json = await api<DatesResponse>(
          `/api/daily-personal-reports/dates?projectCode=${encodeURIComponent(PROJECT_CODE)}&limit=370`
        );
        if (!cancelled) setAvailableDates(json.data?.dates ?? []);
      } catch {
        if (!cancelled) setAvailableDates([]);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [PROJECT_CODE, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const json = await api<AvailableFilesResponse>(
          `/api/daily-personal-reports/available-files?projectCode=${encodeURIComponent(PROJECT_CODE)}&date=${encodeURIComponent(date)}`
        );
        const forDate = json.data?.filesForDate ?? [];
        if (cancelled) return;
        setAvailableFilesForDate(forDate);
        setHasImportedFileForDate(Boolean(json.data?.hasImportedFileForDate));
        setHasImportJobForDate(Boolean(json.data?.hasImportJobForDate));
      } catch {
        if (cancelled) return;
        setAvailableFilesForDate([]);
        setHasImportedFileForDate(false);
        setHasImportJobForDate(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [PROJECT_CODE, date, refreshKey]);

  const changeMonth = useCallback(
    (deltaMonths: number) => {
      setDate((currentDate) => shiftMonthDate(currentDate, deltaMonths, availableDates));
      setSelection(null);
    },
    [availableDates]
  );

  const handleCalendarPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
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
      window.setTimeout(() => {
        changeMonth(direction);
        setCalendarDragX(0);
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

  const calendarDragScale = useMemo(() => {
    const distance = Math.abs(calendarDragX);
    return 1 - Math.min(distance / 950, 0.085);
  }, [calendarDragX]);

  const calendarDragOffset = useMemo(() => calendarDragX * 0.18, [calendarDragX]);
  const calendarDragDistance = useMemo(() => Math.abs(calendarDragX), [calendarDragX]);
  const calendarLiftY = useMemo(() => Math.min(calendarDragDistance * 0.08, 12), [calendarDragDistance]);

  const calendarModel = useMemo(() => {
    const [yearStr, monthStr, selectedDayStr] = date.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const selectedDay = Number(selectedDayStr);

    const firstDayWeekIndex = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const datesSet = new Set(availableDates);

    const cells: Array<{ iso: string; day: number; hasData: boolean; selected: boolean } | null> = [];

    for (let i = 0; i < firstDayWeekIndex; i += 1) cells.push(null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
      cells.push({
        iso,
        day,
        hasData: datesSet.has(iso),
        selected: day === selectedDay,
      });
    }

    while (cells.length % 7 !== 0) cells.push(null);

    const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const reportCount = cells.reduce((count, cell) => count + (cell?.hasData ? 1 : 0), 0);

    return { cells, monthLabel, reportCount };
  }, [availableDates, date]);

  const noDataImported = useMemo(() => {
    const matrixTotal = matrixTotals.Total?.total ?? 0;
    const hasEvidence = hasImportedFileForDate || hasImportJobForDate || availableFilesForDate.some((item) => item.alreadyImported);
    return !summaryLoading && !summaryError && !summaryHasData && summaryRowCount === 0 && matrixTotal === 0 && !hasEvidence;
  }, [
    availableFilesForDate,
    hasImportJobForDate,
    hasImportedFileForDate,
    matrixTotals.Total,
    summaryError,
    summaryHasData,
    summaryLoading,
    summaryRowCount,
  ]);

  const importFromStorage = useCallback(
    async (storagePath: string, importDate: string) => {
      if (!storagePath) return;
      setImportingFromStorage(true);
      setImportErrMsg(null);
      setImportOkMsg(null);
      try {
        const res = await fetch("/api/daily-personal-reports/import-from-storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectCode: PROJECT_CODE,
            date: importDate,
            storagePath,
          }),
        });
        const json = (await res.json().catch(() => null)) as
          | {
              ok?: boolean;
              error?: string;
              data?: { parsedRows?: number; upsertedRows?: number };
            }
          | null;

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `Import failed (${res.status})`);
        }
        setImportOkMsg(
          `Storage import done: parsed ${json?.data?.parsedRows ?? "?"}, upserted ${json?.data?.upsertedRows ?? "?"}.`
        );
        setRefreshKey((prev) => prev + 1);
      } catch (error) {
        setImportErrMsg(getErrorMessage(error, "Storage import failed"));
      } finally {
        setImportingFromStorage(false);
      }
    },
    [PROJECT_CODE]
  );

  useEffect(() => {
    if (summaryLoading || summaryError) return;
    if (summaryHasData || summaryRowCount > 0 || hasImportedFileForDate || hasImportJobForDate) return;
    if (importingFromStorage) return;

    const candidates = availableFilesForDate
      .filter((item) => item.detectedDate === date)
      .sort((a, b) => {
        const revDiff = parseRevisionRank(b.fileName) - parseRevisionRank(a.fileName);
        if (revDiff !== 0) return revDiff;
        return b.fileName.localeCompare(a.fileName);
      });

    const target = candidates[0];
    if (!target) return;

    const attemptKey = `${date}|${target.storagePath}`;
    if (autoImportAttemptRef.current === attemptKey) return;
    autoImportAttemptRef.current = attemptKey;
    setImportOkMsg(`Auto-sync started for ${formatDisplayDate(date)} from ${target.fileName}.`);
    void importFromStorage(target.storagePath, date);
  }, [
    availableFilesForDate,
    date,
    hasImportJobForDate,
    hasImportedFileForDate,
    importFromStorage,
    importingFromStorage,
    summaryError,
    summaryHasData,
    summaryLoading,
    summaryRowCount,
  ]);

  const openMonthlyHoursExport = useCallback(() => {
    setMonthlyExportProjectCode(PROJECT_CODE);
    setMonthlyExportMonth(date.slice(0, 7));
    setMonthlyExportErr(null);
    setMonthlyExportOpen(true);
  }, [PROJECT_CODE, date]);

  const runMonthlyHoursExport = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(monthlyExportMonth)) {
      setMonthlyExportErr("Please select a valid month (YYYY-MM).");
      return;
    }
    if (!monthlyExportProjectCode.trim()) {
      setMonthlyExportErr("Project is required.");
      return;
    }

    setMonthlyExporting(true);
    setMonthlyExportErr(null);
    try {
      const qs = new URLSearchParams({
        projectCode: monthlyExportProjectCode.trim(),
        month: monthlyExportMonth,
      });
      const res = await fetch(`/api/attendance/export-monthly-hours?${qs.toString()}`, { method: "GET" });

      if (res.status === 401) {
        setMonthlyExportErr("Sign in required to export.");
        return;
      }

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || `Export failed (${res.status}).`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      const fileName = match ? decodeURIComponent(match[1].replace(/"/g, "")) : `${monthlyExportProjectCode}-MonthlyHours-${monthlyExportMonth}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMonthlyExportOpen(false);
    } catch (error) {
      setMonthlyExportErr(getErrorMessage(error, "Monthly hours export failed."));
    } finally {
      setMonthlyExporting(false);
    }
  }, [monthlyExportMonth, monthlyExportProjectCode]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,#0d1119_0%,#06080e_100%)] p-4 text-zinc-100 shadow-[0_24px_50px_rgba(0,0,0,0.45)] md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold">Personal Reports</h1>
                <p className="mt-1 text-sm text-zinc-300">Daily matrix and drill-down reports (live data).</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <a
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/35 px-3 py-1.5 text-sm hover:bg-black/55"
                  href={`/api/daily-personal-reports/export?projectCode=${encodeURIComponent(PROJECT_CODE)}&date=${encodeURIComponent(date)}`}
                >
                  <Download className="h-4 w-4" />
                  Export
                </a>

                <button
                  type="button"
                  disabled={importingFromStorage}
                  onClick={openMonthlyHoursExport}
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-300/30 bg-sky-500/15 px-3 py-1.5 text-sm text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export Monthly Hours
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="relative inline-flex min-w-[196px] items-center gap-2 rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-lg font-medium">
                <Calendar className="h-4 w-4 text-zinc-400" />
                <span>{formatDisplayDate(date)}</span>
                <input
                  type="date"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelection(null);
                  }}
                />
              </label>
            </div>

            {(importOkMsg || importErrMsg) && (
              <div className="mt-3 text-xs">
                {importOkMsg ? <div className="text-green-400">{importOkMsg}</div> : null}
                {importErrMsg ? <div className="text-red-400">{importErrMsg}</div> : null}
              </div>
            )}
            <div className="mt-3 text-xs text-zinc-400">
              Matrix values come from database rows. Missing dates are imported from storage automatically in the background.
            </div>
          </div>

          <div
            className="w-full max-w-[330px] touch-pan-y select-none rounded-2xl border border-white/20 bg-black/35 p-3 will-change-transform"
            onPointerDown={handleCalendarPointerDown}
            onPointerMove={handleCalendarPointerMove}
            onPointerUp={handleCalendarPointerUp}
            onPointerCancel={handleCalendarPointerCancel}
            style={{
              transform: `translateX(${calendarDragOffset}px) translateY(${-calendarLiftY}px) scale(${calendarDragScale})`,
              transition: calendarDragging
                ? "transform 90ms linear"
                : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300">{calendarModel.monthLabel}</div>
              <div className="text-xs text-zinc-400">{calendarModel.reportCount} ready</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-1 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">
                  {day}
                </div>
              ))}

              {calendarModel.cells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="h-9 rounded-md border border-transparent" />;
                }

                const styleClass = cell.selected
                  ? "border-white bg-zinc-950 text-zinc-100"
                  : cell.hasData
                    ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                    : "border-white/15 bg-zinc-900/70 text-zinc-300";

                return (
                  <button
                    key={cell.iso}
                    className={`relative h-9 rounded-md border text-center text-xs transition hover:border-white/70 ${styleClass}`}
                    onClick={() => {
                      setDate(cell.iso);
                      setSelection(null);
                    }}
                    title={cell.hasData ? "Report ready" : "No report data"}
                  >
                    <span className="font-medium">{cell.day}</span>
                    {cell.hasData ? <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {summaryLoading && <div className="mt-3 text-xs text-zinc-400">Loading personal reports...</div>}
        {summaryError && <div className="mt-3 text-xs text-red-400">{summaryError}</div>}
        {noDataImported ? (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="font-medium">No attendance imported for {date}.</div>
            <div className="mt-1 text-xs text-amber-200/90">
              Waiting for automatic storage sync for this date.
            </div>
          </div>
        ) : null}
      </div>

      {monthlyExportOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close monthly export modal"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMonthlyExportOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Export Monthly Hours</h2>
                <p className="mt-1 text-xs text-zinc-400">Generate XLSX from daily personnel attendance records.</p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                className="rounded-lg border border-white/15 bg-black/35 p-1.5 text-zinc-300 hover:bg-black/55"
                onClick={() => setMonthlyExportOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1 text-xs text-zinc-400">
                Project
                <select
                  value={monthlyExportProjectCode}
                  onChange={(event) => setMonthlyExportProjectCode(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm text-zinc-100 outline-none"
                >
                  <option value={PROJECT_CODE}>{PROJECT_CODE}</option>
                </select>
              </label>

              <label className="block space-y-1 text-xs text-zinc-400">
                Month
                <input
                  type="month"
                  value={monthlyExportMonth}
                  onChange={(event) => setMonthlyExportMonth(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
              </label>
              <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-400">
                Daily hours are fixed to 10 for present records.
              </p>
            </div>

            {monthlyExportErr ? <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs text-red-200">{monthlyExportErr}</div> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm hover:bg-black/55"
                onClick={() => setMonthlyExportOpen(false)}
                disabled={monthlyExporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-sky-300/30 bg-sky-500/20 px-3 py-2 text-sm text-sky-100 hover:bg-sky-500/30 disabled:opacity-50"
                onClick={() => void runMonthlyHoursExport()}
                disabled={monthlyExporting}
              >
                {monthlyExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download XLSX
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">Summary Matrix</div>
          <div className="text-xs text-muted-foreground">Click P / A / T</div>
        </div>

        <div className="grid grid-cols-5 gap-2 text-sm">
          <HeaderCell>Segment</HeaderCell>
          {DISCIPLINES.map((d) => (
            <HeaderCell key={d}>{d}</HeaderCell>
          ))}

          {SEGMENTS.map((seg) => (
            <React.Fragment key={seg}>
              <Cell className="font-medium">{seg}</Cell>
              {DISCIPLINES.map((d) => {
                const c = matrix[`${seg}|${d}`] ?? { present: 0, absent: 0, total: 0 };
                return (
                  <MetricCell
                    key={`${seg}-${d}`}
                    counts={c}
                    onClick={(status) => {
                      setSelection({ segment: seg, discipline: d, status });
                      setTab("people");
                      setSearch("");
                      setCompany("All");
                      setProfessionChip(null);
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}

          <Cell className="font-semibold bg-muted/35">Total</Cell>
          {DISCIPLINES.map((d) => {
            const counts = matrixTotals[d];
            return (
              <MetricCell
                key={`total-${d}`}
                counts={counts}
                className="bg-muted/35"
                onClick={(status) => {
                  setSelection({ segment: "All", discipline: d, status });
                  setTab("people");
                  setSearch("");
                  setCompany("All");
                  setProfessionChip(null);
                }}
              />
            );
          })}
        </div>
      </div>

      {selection && (
        <RightDrawer title="Personal Reports" onClose={() => setSelection(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-3 text-sm">
              <div className="font-medium">
                {selection.segment === "All" ? "All Segments" : selection.segment} | {selection.discipline} | {selection.status}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Rows: {people.length}</div>
            </div>

            <div className="flex gap-2">
              <button
                className={`rounded-xl border px-3 py-2 text-sm ${
                  tab === "people" ? "bg-accent" : "bg-background hover:bg-accent/40"
                }`}
                onClick={() => setTab("people")}
              >
                People
              </button>
              <button
                className={`rounded-xl border px-3 py-2 text-sm ${
                  tab === "pivot" ? "bg-accent" : "bg-background hover:bg-accent/40"
                }`}
                onClick={() => setTab("pivot")}
              >
                Profession Pivot
              </button>
            </div>

            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              placeholder="Search name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {professionChip && (
              <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
                <div>
                  Profession: <span className="font-medium">{professionChip}</span>
                </div>
                <button
                  className="rounded-lg border bg-background px-2 py-1 text-xs hover:bg-accent/40"
                  onClick={() => setProfessionChip(null)}
                >
                  Clear
                </button>
              </div>
            )}

            {tab === "people" ? (
              <div className="max-h-[52vh] overflow-y-auto scrollbar-thin rounded-2xl border bg-card">
                <div className="grid grid-cols-12 gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-3">Profession</div>
                  <div className="col-span-3">Company</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {peopleLoading && <div className="px-3 py-3 text-sm text-muted-foreground">Loading...</div>}

                {!peopleLoading &&
                  people.map((p) => (
                    <div
                      key={p.employee_id}
                      className="grid grid-cols-12 gap-2 px-3 py-2 text-sm hover:bg-accent/20"
                    >
                      <div className="col-span-4">{p.full_name}</div>
                      <div className="col-span-3 text-muted-foreground">
                        {p.profession_grouped ?? p.profession_official ?? p.profession_actual ?? "-"}
                      </div>
                      <div className="col-span-3 text-muted-foreground">{p.company ?? "-"}</div>
                      <div className="col-span-2 text-right">
                        <div className="text-xs">{p.status}</div>
                        {p.status === "Absent" && p.absence_reason ? (
                          <div className="text-xs text-muted-foreground">{p.absence_reason}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}

                {!peopleLoading && people.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground">No results.</div>
                )}
              </div>
            ) : (
              <div className="max-h-[52vh] overflow-y-auto scrollbar-thin rounded-2xl border bg-card">
                <div className="grid grid-cols-12 gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-6">Profession</div>
                  <div className="col-span-2 text-right">P</div>
                  <div className="col-span-2 text-right">A</div>
                  <div className="col-span-2 text-right">T</div>
                </div>

                {pivotRows.map((r) => (
                  <button
                    key={r.profession}
                    className="grid w-full grid-cols-12 gap-2 px-3 py-2 text-sm text-left hover:bg-accent/20"
                    onClick={() => {
                      setProfessionChip(r.profession);
                      setTab("people");
                    }}
                  >
                    <div className="col-span-6 font-medium">{r.profession}</div>
                    <div className="col-span-2 text-right tabular-nums">{r.present}</div>
                    <div className="col-span-2 text-right tabular-nums">{r.absent}</div>
                    <div className="col-span-2 text-right tabular-nums">{r.total}</div>
                  </button>
                ))}

                {pivotRows.length === 0 && <div className="px-3 py-4 text-sm text-muted-foreground">No data.</div>}
              </div>
            )}
          </div>
        </RightDrawer>
      )}
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="rounded-xl border bg-muted px-3 py-2 font-medium">{children}</div>;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return <div className={`rounded-xl border bg-background px-3 py-2 ${className}`}>{children}</div>;
}

function MetricCell({
  counts,
  onClick,
  className = "",
}: {
  counts: CellCounts;
  onClick: (status: Status) => void;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`rounded-xl border bg-background px-3 py-2 ${className}`}>
      <div className="flex items-center gap-3">
        <button className="text-left hover:underline" onClick={() => onClick("Present")}>
          <div className="text-xs text-muted-foreground">P</div>
          <div className="font-medium tabular-nums">{counts.present}</div>
        </button>

        <button className="text-left hover:underline" onClick={() => onClick("Absent")}>
          <div className="text-xs text-muted-foreground">A</div>
          <div className="font-medium tabular-nums">{counts.absent}</div>
        </button>

        <button className="ml-auto text-left hover:underline" onClick={() => onClick("All")}>
          <div className="text-xs text-muted-foreground">T</div>
          <div className="font-medium tabular-nums">{counts.total}</div>
        </button>
      </div>
    </div>
  );
}

function RightDrawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-[520px] flex-col bg-background shadow-xl">
        <div className="flex h-14 items-center justify-between border-b px-5">
          <div className="text-sm font-semibold">{title}</div>
          <button className="rounded-xl border bg-card px-3 py-1.5 text-sm hover:bg-accent/40" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-5">{children}</div>
      </div>
    </div>
  );
}
