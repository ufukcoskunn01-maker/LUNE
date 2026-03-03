"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthPayload = {
  ok: boolean;
  user: { id: string; email?: string | null } | null;
};

type MonthDateRow = {
  date: string;
  hasFile: boolean;
  parseStatus: "MISSING" | "PENDING" | "OK" | "FAILED";
  fileName: string | null;
  revision: string | null;
  summary: Record<string, unknown>;
};

type MonthPayload = {
  projectCode: string;
  month: string;
  dates: MonthDateRow[];
};

type DayItem = {
  id: string;
  row_no: number;
  zone: string | null;
  floor: string | null;
  system: string | null;
  activity_code: string | null;
  material_code: string | null;
  item_name: string | null;
  unit: string | null;
  qty: number | null;
  notes: string | null;
};

type DayPayload = {
  projectCode: string;
  date: string;
  meta: {
    id: string;
    file_name: string;
    revision: string | null;
    storage_bucket: string;
    storage_path: string;
    file_size: number | null;
    last_modified: string | null;
    parse_status: "PENDING" | "OK" | "FAILED";
    parse_error: string | null;
  } | null;
  summary: Record<string, unknown>;
  totals: {
    itemCount: number;
    totalQty: number;
    distinctZones: number;
    distinctFloors: number;
    distinctMaterials: number;
  };
  items: DayItem[];
  attendance: {
    matrix: Record<string, Record<string, { present: number; absent: number; total: number }>>;
    presentCount: number;
    totalCount: number;
    peoplePreview: Array<{ employee_id: string; full_name: string; company: string | null; profession_grouped: string | null }>;
  };
};

type AttendanceSummaryPayload = {
  matrix: Record<string, Record<string, { present: number; absent: number; total: number }>>;
  totals: Record<string, { present: number; absent: number; total: number }>;
  grandTotal: { present: number; absent: number; total: number };
  hasData: boolean;
  rowCount: number;
};

type AttendancePeoplePayload = {
  rows: Array<{
    employee_id: string;
    full_name: string;
    company: string | null;
    profession_grouped: string | null;
    segment: string;
    discipline: string;
  }>;
  total: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthFromDate(dateIso: string): string {
  return dateIso.slice(0, 7);
}

function parseMonth(monthToken: string): { year: number; month: number; days: number } | null {
  if (!/^\d{4}-\d{2}$/.test(monthToken)) return null;
  const [year, month] = monthToken.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const days = new Date(year, month, 0).getDate();
  return { year, month, days };
}

function buildCalendar(monthToken: string, dates: MonthDateRow[]) {
  const parsed = parseMonth(monthToken);
  if (!parsed) return [] as Array<{ empty: true } | { empty: false; day: number; date: string; row: MonthDateRow | null }>;

  const firstDay = new Date(parsed.year, parsed.month - 1, 1).getDay();
  const byDate = new Map(dates.map((row) => [row.date, row]));
  const cells: Array<{ empty: true } | { empty: false; day: number; date: string; row: MonthDateRow | null }> = [];

  for (let i = 0; i < firstDay; i += 1) cells.push({ empty: true });
  for (let day = 1; day <= parsed.days; day += 1) {
    const date = `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ empty: false, day, date, row: byDate.get(date) || null });
  }
  return cells;
}

function statusBadgeClass(status: "MISSING" | "PENDING" | "OK" | "FAILED"): string {
  if (status === "OK") return "border-emerald-300/35 bg-emerald-500/18 text-emerald-100";
  if (status === "FAILED") return "border-red-300/35 bg-red-500/18 text-red-100";
  if (status === "PENDING") return "border-amber-300/35 bg-amber-500/18 text-amber-100";
  return "border-white/15 bg-black/30 text-zinc-400";
}

function statusLabel(status: "MISSING" | "PENDING" | "OK" | "FAILED"): string {
  if (status === "MISSING") return "Missing";
  if (status === "PENDING") return "Pending";
  if (status === "FAILED") return "Failed";
  return "OK";
}

function formatNumber(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function fetchData<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: T } | null;
  if (!res.ok || json?.ok === false || !json?.data) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json.data;
}

export default function DailyInstallationReportsWorkspace() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [projectCode, setProjectCode] = useState("A27");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [monthToken, setMonthToken] = useState(monthFromDate(todayIso()));

  const [monthData, setMonthData] = useState<MonthPayload | null>(null);
  const [dayData, setDayData] = useState<DayPayload | null>(null);

  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryPayload | null>(null);
  const [attendancePeople, setAttendancePeople] = useState<AttendancePeoplePayload | null>(null);

  const [monthLoading, setMonthLoading] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState<null | "csv" | "xlsx">(null);

  const [monthError, setMonthError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [floorFilter, setFloorFilter] = useState("ALL");
  const [materialFilter, setMaterialFilter] = useState("ALL");

  const fileRef = useRef<HTMLInputElement | null>(null);
  const autoSyncRunningRef = useRef(false);
  const autoRetryAttemptRef = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as AuthPayload | null;
      setAuthed(Boolean(payload?.user?.id));
    } catch {
      setAuthed(false);
    }
  }, []);

  const loadMonth = useCallback(async () => {
    setMonthLoading(true);
    setMonthError(null);
    try {
      const params = new URLSearchParams({ projectCode, month: monthToken });
      const data = await fetchData<MonthPayload>(`/api/field-reports/month?${params.toString()}`);
      setMonthData(data);
    } catch (error) {
      setMonthError(error instanceof Error ? error.message : "Failed to load month status.");
      setMonthData(null);
    } finally {
      setMonthLoading(false);
    }
  }, [monthToken, projectCode]);

  const loadDay = useCallback(async () => {
    setDayLoading(true);
    setDayError(null);
    try {
      const params = new URLSearchParams({ projectCode, date: selectedDate });
      const data = await fetchData<DayPayload>(`/api/field-reports/day?${params.toString()}`);
      setDayData(data);
    } catch (error) {
      setDayError(error instanceof Error ? error.message : "Failed to load day details.");
      setDayData(null);
    } finally {
      setDayLoading(false);
    }
  }, [projectCode, selectedDate]);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const summary = await fetchData<AttendanceSummaryPayload>(
        `/api/attendance/summary?projectCode=${encodeURIComponent(projectCode)}&date=${encodeURIComponent(selectedDate)}`
      );
      const details = await fetchData<AttendancePeoplePayload>(
        `/api/attendance/details?projectCode=${encodeURIComponent(projectCode)}&date=${encodeURIComponent(selectedDate)}&status=Present&page=1&pageSize=500`
      );
      setAttendanceSummary(summary);
      setAttendancePeople(details);
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "Failed to load attendance data.");
      setAttendanceSummary(null);
      setAttendancePeople(null);
    } finally {
      setAttendanceLoading(false);
    }
  }, [projectCode, selectedDate]);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    if (!authed) return;
    void loadMonth();
  }, [authed, loadMonth]);

  useEffect(() => {
    if (!monthData?.dates?.length) return;
    const selected = monthData.dates.find((row) => row.date === selectedDate);
    if (selected && selected.hasFile) return;
    const best = monthData.dates.find((row) => row.hasFile)?.date || monthData.dates[0]?.date;
    if (best && best !== selectedDate) setSelectedDate(best);
  }, [monthData?.dates, selectedDate]);

  useEffect(() => {
    if (!authed) return;
    void loadDay();
    void loadAttendance();
  }, [authed, loadAttendance, loadDay]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMonth(), loadDay(), loadAttendance()]);
  }, [loadAttendance, loadDay, loadMonth]);

  const runSync = useCallback(async (silent = false) => {
    if (autoSyncRunningRef.current) return;
    autoSyncRunningRef.current = true;
    if (!silent) setActionInfo(null);
    if (!silent) setSyncing(true);
    try {
      const res = await fetch("/api/daily-installation-reports/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectCode, missingOnly: true }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        data?: { scanned?: number; considered?: number; registered?: number; processed?: number; bucket?: string; rootPrefix?: string };
        errors?: string[];
      } | null;

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Sync failed (${res.status})`);
      }

      const scanned = payload?.data?.scanned ?? 0;
      const considered = payload?.data?.considered ?? 0;
      const registered = payload?.data?.registered ?? 0;
      const processed = payload?.data?.processed ?? 0;
      const source = payload?.data?.bucket && payload?.data?.rootPrefix ? ` ${payload.data.bucket}/${payload.data.rootPrefix}` : "";
      const warns = payload?.errors?.length ? ` (${payload.errors.length} warning)` : "";
      if (!silent) {
        setActionInfo(`Sync complete: scanned ${scanned}, considered ${considered}, registered ${registered}, processed ${processed}.${warns}${source ? ` Source:${source}` : ""}`);
      }
      await refreshAll();
    } catch (error) {
      if (!silent) setActionInfo(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      autoSyncRunningRef.current = false;
      if (!silent) setSyncing(false);
    }
  }, [projectCode, refreshAll]);

  const retryImport = useCallback(async (silent = false) => {
    if (!selectedDate) return;
    if (!silent) setActionInfo(null);
    try {
      const res = await fetch("/api/field-reports/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectCode, workDate: selectedDate }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: { parsedItems?: number; upsertedItems?: number } } | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Import failed (${res.status})`);
      }
      if (!silent) setActionInfo(`Import complete: parsed ${payload?.data?.parsedItems ?? 0}, stored ${payload?.data?.upsertedItems ?? 0}.`);
      await refreshAll();
    } catch (error) {
      if (!silent) setActionInfo(error instanceof Error ? error.message : "Import failed.");
    }
  }, [projectCode, refreshAll, selectedDate]);

  useEffect(() => {
    autoRetryAttemptRef.current = "";
  }, [projectCode, selectedDate]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;

    const runAutoSync = async () => {
      if (cancelled) return;
      await runSync(true);
    };

    void runAutoSync();
    const timer = window.setInterval(() => {
      void runAutoSync();
    }, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authed, runSync]);

  useEffect(() => {
    if (!authed || !dayData?.meta) return;
    if (dayData.meta.parse_status === "OK") return;

    const retryKey = `${projectCode}|${selectedDate}|${dayData.meta.id}|${dayData.meta.parse_status}`;
    if (autoRetryAttemptRef.current === retryKey) return;
    autoRetryAttemptRef.current = retryKey;
    void retryImport(true);
  }, [authed, dayData?.meta, projectCode, retryImport, selectedDate]);

  const uploadAndImport = useCallback(
    async (file: File) => {
      setUploading(true);
      setActionInfo(null);
      try {
        const form = new FormData();
        form.set("projectCode", projectCode);
        form.set("workDate", selectedDate);
        form.set("file", file);

        const res = await fetch("/api/field-reports/import", {
          method: "POST",
          body: form,
        });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: { parsedItems?: number; upsertedItems?: number } } | null;
        if (!res.ok || payload?.ok === false) {
          throw new Error(payload?.error || `Upload/import failed (${res.status})`);
        }

        setActionInfo(`Upload import complete: parsed ${payload?.data?.parsedItems ?? 0}, stored ${payload?.data?.upsertedItems ?? 0}.`);
        await refreshAll();
      } catch (error) {
        setActionInfo(error instanceof Error ? error.message : "Upload/import failed.");
      } finally {
        setUploading(false);
      }
    },
    [projectCode, refreshAll, selectedDate]
  );

  const exportMonth = useCallback(
    async (format: "csv" | "xlsx") => {
      setExporting(format);
      try {
        const params = new URLSearchParams({ projectCode, month: monthToken, format });
        const res = await fetch(`/api/field-reports/export?${params.toString()}`, { method: "GET" });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error || `Export failed (${res.status})`);
        }

        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") || "";
        const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
        const fallback = `${projectCode}-DailyInstallationReports-${monthToken}.${format}`;
        const fileName = match ? decodeURIComponent(match[1].replace(/"/g, "")) : fallback;

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        setActionInfo(error instanceof Error ? error.message : "Export failed.");
      } finally {
        setExporting(null);
      }
    },
    [monthToken, projectCode]
  );

  const calendarCells = useMemo(() => buildCalendar(monthToken, monthData?.dates || []), [monthData?.dates, monthToken]);

  const zoneOptions = useMemo(
    () => Array.from(new Set((dayData?.items || []).map((item) => (item.zone || "").trim()).filter(Boolean))).sort(),
    [dayData?.items]
  );
  const floorOptions = useMemo(
    () => Array.from(new Set((dayData?.items || []).map((item) => (item.floor || "").trim()).filter(Boolean))).sort(),
    [dayData?.items]
  );
  const materialOptions = useMemo(
    () =>
      Array.from(new Set((dayData?.items || []).map((item) => (item.material_code || "").trim()).filter(Boolean))).sort(),
    [dayData?.items]
  );

  const filteredItems = useMemo(() => {
    return (dayData?.items || []).filter((item) => {
      if (zoneFilter !== "ALL" && (item.zone || "") !== zoneFilter) return false;
      if (floorFilter !== "ALL" && (item.floor || "") !== floorFilter) return false;
      if (materialFilter !== "ALL" && (item.material_code || "") !== materialFilter) return false;
      if (!search) return true;
      const haystack = [item.item_name, item.material_code, item.activity_code, item.notes, item.zone, item.floor, item.system]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [dayData?.items, floorFilter, materialFilter, search, zoneFilter]);

  const filteredQty = useMemo(
    () => filteredItems.reduce((sum, row) => sum + Number(row.qty || 0), 0),
    [filteredItems]
  );

  const summaryTotalsByZone = useMemo(() => {
    const raw = dayData?.summary?.totalsByZone;
    if (!raw || typeof raw !== "object") return [] as Array<{ key: string; qty: number }>;
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => ({ key, qty: Number(value || 0) }))
      .sort((a, b) => b.qty - a.qty);
  }, [dayData?.summary]);

  if (authed === false) {
    return (
      <Card className="border-white/20 bg-black/35 text-zinc-100">
        <CardHeader>
          <CardTitle>Daily Installation Reports</CardTitle>
          <CardDescription className="text-zinc-300">Please sign in to view Daily Installation Reports.</CardDescription>
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
    <div className="space-y-4">
      <Card className="gap-3 border-white/20 bg-black/35 py-4 text-zinc-100">
        <CardHeader className="px-4 pb-0 md:px-5">
          <CardTitle className="text-lg">Daily Installation Reports</CardTitle>
          <CardDescription className="text-zinc-300">
            Field report import, monthly calendar status, and day-level installation drilldown.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap items-end gap-2 px-4 md:px-5">
          <label className="min-w-[120px] space-y-1 text-xs text-zinc-400">
            Project
            <Input
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value.toUpperCase())}
              className="h-9 border-white/20 bg-black/45 text-zinc-100"
            />
          </label>

          <label className="min-w-[140px] space-y-1 text-xs text-zinc-400">
            Month
            <Input
              type="month"
              value={monthToken}
              onChange={(event) => {
                setMonthToken(event.target.value);
                if (selectedDate.slice(0, 7) !== event.target.value) {
                  setSelectedDate(`${event.target.value}-01`);
                }
              }}
              className="h-9 border-white/20 bg-black/45 text-zinc-100"
            />
          </label>

          <label className="min-w-[160px] space-y-1 text-xs text-zinc-400">
            Day
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 border-white/20 bg-black/45 text-zinc-100"
            />
          </label>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void uploadAndImport(file);
            }}
          />

          <Button
            onClick={() => void runSync(false)}
            className="h-9 gap-2 border-white/20 bg-black/45 text-zinc-100 hover:bg-black/60"
            disabled={syncing}
            aria-label="Sync existing files from storage"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Sync Existing Files
          </Button>

          <Button
            onClick={() => fileRef.current?.click()}
            className="h-9 gap-2 border-white/20 bg-black/45 text-zinc-100 hover:bg-black/60"
            disabled={uploading}
            aria-label="Upload installation report and import"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload & Import
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-9 gap-2 border-white/20 bg-black/45 text-zinc-100 hover:bg-black/60"
                disabled={exporting !== null}
                aria-label="Export monthly installation report"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export month
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="border-white/15 bg-zinc-950 text-zinc-100">
              <DropdownMenuItem onClick={() => void exportMonth("xlsx")}>Export XLSX</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportMonth("csv")}>Export CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {actionInfo ? <div className="w-full text-xs text-zinc-300">{actionInfo}</div> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="gap-3 border-white/20 bg-black/35 py-4 text-zinc-100">
          <CardHeader className="px-4 pb-0 md:px-5">
            <CardTitle className="text-base">Month Calendar</CardTitle>
            <CardDescription className="text-zinc-300">{monthToken}</CardDescription>
          </CardHeader>

          <CardContent className="px-4 md:px-5">
            {monthLoading ? (
              <div className="py-8 text-sm text-zinc-300">Loading month…</div>
            ) : monthError ? (
              <div className="py-8 text-sm text-red-300">{monthError}</div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.08em] text-zinc-400">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, index) =>
                    cell.empty ? (
                      <div key={`empty-${index}`} className="h-20 rounded-lg border border-transparent" />
                    ) : (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => setSelectedDate(cell.date)}
                        className={`h-20 rounded-lg border p-1.5 text-left ${
                          selectedDate === cell.date
                            ? "border-sky-300/70 bg-sky-500/15"
                            : "border-white/10 bg-black/30 hover:bg-black/45"
                        }`}
                      >
                        <div className="text-xs font-medium text-zinc-100">{cell.day}</div>
                        <div className={`mt-1 rounded px-1 py-0.5 text-[10px] ${statusBadgeClass(cell.row?.parseStatus || "MISSING")}`}>
                          {statusLabel(cell.row?.parseStatus || "MISSING")}
                        </div>
                        {cell.row?.fileName ? (
                          <div className="mt-1 line-clamp-2 text-[10px] text-zinc-300">{cell.row.fileName}</div>
                        ) : null}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 border-white/20 bg-black/35 py-4 text-zinc-100">
          <CardHeader className="px-4 pb-0 md:px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-zinc-400" />
              {selectedDate}
            </CardTitle>
            <CardDescription className="text-zinc-300">
              {dayData?.meta
                ? `${dayData.meta.file_name}${dayData.meta.revision ? ` • ${dayData.meta.revision}` : ""}`
                : "No report imported for this day"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-4 md:px-5">
            {dayLoading ? (
              <div className="py-8 text-sm text-zinc-300">Loading day details…</div>
            ) : dayError ? (
              <div className="py-8 text-sm text-red-300">{dayError}</div>
            ) : (
              <>
                <div className="grid gap-2 md:grid-cols-5">
                  <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Items</div>
                    <div className="mt-1 text-3xl font-semibold">{dayData?.totals.itemCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Total Qty</div>
                    <div className="mt-1 text-3xl font-semibold">{formatNumber(dayData?.totals.totalQty ?? 0)}</div>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Zones</div>
                    <div className="mt-1 text-3xl font-semibold">{dayData?.totals.distinctZones ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Floors</div>
                    <div className="mt-1 text-3xl font-semibold">{dayData?.totals.distinctFloors ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Materials</div>
                    <div className="mt-1 text-3xl font-semibold">{dayData?.totals.distinctMaterials ?? 0}</div>
                  </div>
                </div>

                <Tabs defaultValue="summary" className="space-y-3">
                  <TabsList className="w-full justify-start gap-2 rounded-xl border border-white/15 bg-black/35 p-1 text-zinc-300 md:w-auto">
                    <TabsTrigger value="summary" className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900">
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="items" className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900">
                      Items
                    </TabsTrigger>
                    <TabsTrigger value="personnel" className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900">
                      Personnel
                    </TabsTrigger>
                    <TabsTrigger value="errors" className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900">
                      Errors
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-3">
                    <div className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm">
                      <div className="text-xs text-zinc-400">File</div>
                      <div className="mt-1 text-zinc-100">{dayData?.meta?.file_name || "-"}</div>
                      <div className="mt-1 text-xs text-zinc-400">
                        Status: {dayData?.meta?.parse_status || "MISSING"}
                        {dayData?.meta?.revision ? ` • ${dayData.meta.revision}` : ""}
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                        <div className="text-xs text-zinc-400">Totals by Zone</div>
                        <div className="mt-2 space-y-1 text-sm">
                          {summaryTotalsByZone.length ? (
                            summaryTotalsByZone.slice(0, 10).map((row) => (
                              <div key={row.key} className="flex items-center justify-between">
                                <span className="text-zinc-300">{row.key}</span>
                                <span className="font-medium text-zinc-100">{formatNumber(row.qty)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-zinc-500">No zone totals</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/15 bg-black/35 p-3">
                        <div className="text-xs text-zinc-400">Attendance Snapshot ({selectedDate})</div>
                        {attendanceLoading ? (
                          <div className="mt-2 text-sm text-zinc-300">Loading attendance…</div>
                        ) : attendanceError ? (
                          <div className="mt-2 text-sm text-red-300">{attendanceError}</div>
                        ) : (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-white/10 bg-black/35 p-2 text-center">
                              <div className="text-[11px] text-zinc-400">Present</div>
                              <div className="text-lg font-semibold">{attendanceSummary?.grandTotal?.present ?? 0}</div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/35 p-2 text-center">
                              <div className="text-[11px] text-zinc-400">Absent</div>
                              <div className="text-lg font-semibold">{attendanceSummary?.grandTotal?.absent ?? 0}</div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/35 p-2 text-center">
                              <div className="text-[11px] text-zinc-400">Total</div>
                              <div className="text-lg font-semibold">{attendanceSummary?.grandTotal?.total ?? 0}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="items" className="space-y-3">
                    <div className="grid gap-2 lg:grid-cols-4">
                      <Input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search item/code/notes"
                        className="h-9 border-white/20 bg-black/45 text-zinc-100"
                      />

                      <select
                        value={zoneFilter}
                        onChange={(event) => setZoneFilter(event.target.value)}
                        className="h-9 rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100 outline-none"
                      >
                        <option value="ALL">All zones</option>
                        {zoneOptions.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </select>

                      <select
                        value={floorFilter}
                        onChange={(event) => setFloorFilter(event.target.value)}
                        className="h-9 rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100 outline-none"
                      >
                        <option value="ALL">All floors</option>
                        {floorOptions.map((floor) => (
                          <option key={floor} value={floor}>
                            {floor}
                          </option>
                        ))}
                      </select>

                      <select
                        value={materialFilter}
                        onChange={(event) => setMaterialFilter(event.target.value)}
                        className="h-9 rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100 outline-none"
                      >
                        <option value="ALL">All materials</option>
                        {materialOptions.map((material) => (
                          <option key={material} value={material}>
                            {material}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/30">
                      <table className="min-w-full text-sm">
                        <thead className="bg-black/45 text-zinc-300">
                          <tr>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">#</th>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Zone</th>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Floor</th>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">System</th>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Activity</th>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Material</th>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Item</th>
                            <th className="px-3 py-2 text-right text-[11px] uppercase tracking-[0.08em]">Qty</th>
                            <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.length ? (
                            filteredItems.map((item) => (
                              <tr key={item.id} className="border-t border-white/10 text-zinc-100">
                                <td className="px-3 py-2 text-zinc-400">{item.row_no}</td>
                                <td className="px-3 py-2">{item.zone || "-"}</td>
                                <td className="px-3 py-2">{item.floor || "-"}</td>
                                <td className="px-3 py-2">{item.system || "-"}</td>
                                <td className="px-3 py-2">{item.activity_code || "-"}</td>
                                <td className="px-3 py-2">{item.material_code || "-"}</td>
                                <td className="px-3 py-2">{item.item_name || "-"}</td>
                                <td className="px-3 py-2 text-right">{formatNumber(item.qty || 0)}</td>
                                <td className="px-3 py-2">{item.unit || "-"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-3 py-6 text-center text-zinc-400" colSpan={9}>
                                No items for selected filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="border-t border-white/15 bg-black/45 text-zinc-100">
                          <tr>
                            <td className="px-3 py-2 font-medium" colSpan={7}>
                              Filtered totals
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">{formatNumber(filteredQty)}</td>
                            <td className="px-3 py-2" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </TabsContent>

                  <TabsContent value="personnel" className="space-y-3">
                    {attendanceLoading ? (
                      <div className="text-sm text-zinc-300">Loading personnel…</div>
                    ) : attendanceError ? (
                      <div className="text-sm text-red-300">{attendanceError}</div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/30">
                        <table className="min-w-full text-sm">
                          <thead className="bg-black/45 text-zinc-300">
                            <tr>
                              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Employee</th>
                              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Full Name</th>
                              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Company</th>
                              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Profession</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(attendancePeople?.rows || []).length ? (
                              (attendancePeople?.rows || []).map((row) => (
                                <tr key={`${row.employee_id}-${row.full_name}`} className="border-t border-white/10 text-zinc-100">
                                  <td className="px-3 py-2">{row.employee_id}</td>
                                  <td className="px-3 py-2">{row.full_name}</td>
                                  <td className="px-3 py-2">{row.company || "-"}</td>
                                  <td className="px-3 py-2">{row.profession_grouped || "-"}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td className="px-3 py-6 text-center text-zinc-400" colSpan={4}>
                                  No present personnel found for this date.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="errors" className="space-y-3">
                    {dayData?.meta?.parse_status === "FAILED" ? (
                      <div className="rounded-xl border border-red-300/35 bg-red-500/12 p-3 text-sm text-red-100">
                        <div className="font-medium">Parse failed</div>
                        <div className="mt-1 text-red-100/90">{dayData.meta.parse_error || "Unknown parser error."}</div>
                        <div className="mt-2 text-xs text-red-100/85">Automatic retry is running in the background.</div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-zinc-300">
                        No parsing errors for selected date.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
