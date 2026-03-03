"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Camera,
  Car,
  ChevronDown,
  Download,
  Loader2,
  Plus,
  RefreshCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useFiles } from "@/features/files/useFiles";
import { DEFAULT_PROJECT_CODE } from "@/lib/transportation/common";
import { supabaseBrowser } from "@/lib/supabase/browser";

type ShiftCell = {
  id: string;
  trips: number;
  photo_file_id: string | null;
  comment: string | null;
  reported_at: string;
  reported_by: string;
};

type DayBoardRow = {
  plate: string;
  morning: ShiftCell | null;
  evening: ShiftCell | null;
};

type DayResponse = {
  projectCode: string;
  date: string;
  plates: string[];
  board: DayBoardRow[];
};

type MonthlyDaily = {
  date: string;
  day: string;
  totalTrips: number;
  morningTrips: number;
  eveningTrips: number;
};

type MonthlyPlate = {
  plate: string;
  totalTrips: number;
  morningTrips: number;
  eveningTrips: number;
  days: Record<string, number>;
};

type MonthResponse = {
  month: string;
  daysInMonth: number;
  dailyTotals: MonthlyDaily[];
  byPlate: MonthlyPlate[];
  totals: {
    totalTrips: number;
    totalPlates: number;
    totalEntries: number;
  };
};

type MeResponse = {
  isReporter: boolean;
  user: { id: string; email: string | null };
};

type ReportFormState = {
  workDate: string;
  shift: "morning" | "evening";
  plate: string;
  trips: number;
  comment: string;
  file: File | null;
};

type TransportWorkspaceProps = {
  initialDate: string;
  initialProjectCode?: string;
};

function formatReportedAt(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: T } | null;
  if (!res.ok || payload?.ok === false || !payload?.data) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return payload.data;
}

export default function TransportationWorkspace(props: TransportWorkspaceProps) {
  const [projectCode, setProjectCode] = useState(props.initialProjectCode || DEFAULT_PROJECT_CODE);
  const [selectedDate, setSelectedDate] = useState(props.initialDate);
  const [selectedMonth, setSelectedMonth] = useState(props.initialDate.slice(0, 7));

  const [me, setMe] = useState<MeResponse | null>(null);
  const [dayData, setDayData] = useState<DayResponse | null>(null);
  const [monthData, setMonthData] = useState<MonthResponse | null>(null);

  const [loadingMe, setLoadingMe] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "csv" | null>(null);

  const [errorMe, setErrorMe] = useState<string | null>(null);
  const [errorDay, setErrorDay] = useState<string | null>(null);
  const [errorMonth, setErrorMonth] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; plate: string; shift: "morning" | "evening" } | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string | null>>({});

  const [form, setForm] = useState<ReportFormState>({
    workDate: props.initialDate,
    shift: "morning",
    plate: "",
    trips: 1,
    comment: "",
    file: null,
  });

  const plateOptions = useMemo(() => {
    if (!dayData?.plates?.length) return [];
    return [...dayData.plates].sort((a, b) => a.localeCompare(b));
  }, [dayData?.plates]);

  const filesEntityId = `${projectCode}:${selectedDate}`;
  const {
    data: fileRows,
    isLoading: loadingFiles,
    error: filesError,
    refetch: refetchFiles,
  } = useFiles({
    entityType: "transport_day",
    entityId: filesEntityId,
    enabled: Boolean(projectCode && selectedDate),
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSignedUrls() {
      if (!fileRows.length) {
        setFileUrls({});
        return;
      }

      const supabase = supabaseBrowser();
      const byBucket = new Map<string, Array<{ id: string; path: string }>>();
      for (const row of fileRows) {
        if (!row.id || !row.bucket || !row.path) continue;
        const current = byBucket.get(row.bucket) || [];
        current.push({ id: row.id, path: row.path });
        byBucket.set(row.bucket, current);
      }

      const mapped: Record<string, string | null> = {};
      await Promise.all(
        Array.from(byBucket.entries()).map(async ([bucket, items]) => {
          const paths = items.map((item) => item.path);
          const signed = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
          if (signed.error || !signed.data) {
            items.forEach((item) => {
              mapped[item.id] = null;
            });
            return;
          }
          signed.data.forEach((row, index) => {
            const item = items[index];
            if (item) mapped[item.id] = row.signedUrl ?? null;
          });
        })
      );

      if (!cancelled) {
        setFileUrls(mapped);
      }
    }

    void loadSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [fileRows]);

  const loadMe = useCallback(async () => {
    setLoadingMe(true);
    setErrorMe(null);
    try {
      const data = await fetchJson<MeResponse>("/api/transportation/me");
      setMe(data);
    } catch (error) {
      setErrorMe(error instanceof Error ? error.message : "Failed to load transportation permissions.");
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  }, []);

  const loadDay = useCallback(async () => {
    if (!projectCode || !selectedDate) return;
    setLoadingDay(true);
    setErrorDay(null);
    try {
      const qs = new URLSearchParams({ projectCode, date: selectedDate });
      const data = await fetchJson<DayResponse>(`/api/transportation/day?${qs.toString()}`);
      setDayData(data);
    } catch (error) {
      setErrorDay(error instanceof Error ? error.message : "Failed to load daily transportation board.");
      setDayData(null);
    } finally {
      setLoadingDay(false);
    }
  }, [projectCode, selectedDate]);

  const loadMonth = useCallback(async () => {
    if (!projectCode || !selectedMonth) return;
    setLoadingMonth(true);
    setErrorMonth(null);
    try {
      const qs = new URLSearchParams({ projectCode, month: selectedMonth });
      const data = await fetchJson<MonthResponse>(`/api/transportation/month?${qs.toString()}`);
      setMonthData(data);
    } catch (error) {
      setErrorMonth(error instanceof Error ? error.message : "Failed to load monthly transportation analytics.");
      setMonthData(null);
    } finally {
      setLoadingMonth(false);
    }
  }, [projectCode, selectedMonth]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  const onDateChange = useCallback((value: string) => {
    setSelectedDate(value);
    setSelectedMonth(value.slice(0, 7));
    setForm((prev) => ({ ...prev, workDate: value }));
  }, []);

  const onMonthChange = useCallback((value: string) => {
    setSelectedMonth(value);
    if (!selectedDate.startsWith(value)) {
      const nextDate = `${value}-01`;
      setSelectedDate(nextDate);
      setForm((prev) => ({ ...prev, workDate: nextDate }));
    }
  }, [selectedDate]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDay(), loadMonth(), loadMe()]);
  }, [loadDay, loadMe, loadMonth]);

  const submitReport = useCallback(async () => {
    if (!form.file) {
      setSubmitError("Photo is required.");
      return;
    }
    if (!form.plate.trim()) {
      setSubmitError("Plate is required.");
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const body = new FormData();
      body.set("projectCode", projectCode);
      body.set("workDate", form.workDate);
      body.set("shift", form.shift);
      body.set("plate", form.plate.trim());
      body.set("trips", String(form.trips));
      body.set("comment", form.comment.trim());
      body.set("file", form.file);

      const res = await fetch("/api/transportation/report", {
        method: "POST",
        body,
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Report submit failed (${res.status})`);
      }

      setModalOpen(false);
      setForm((prev) => ({
        ...prev,
        plate: "",
        trips: 1,
        comment: "",
        file: null,
      }));
      await Promise.all([loadDay(), loadMonth(), refetchFiles()]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit transportation report.");
    } finally {
      setSaving(false);
    }
  }, [form, loadDay, loadMonth, projectCode, refetchFiles]);

  const runExport = useCallback(
    async (format: "xlsx" | "csv") => {
      setExportingFormat(format);
      try {
        const qs = new URLSearchParams({
          projectCode,
          month: selectedMonth,
          format,
        });
        const res = await fetch(`/api/transportation/export-month?${qs.toString()}`, { method: "GET" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || `Export failed (${res.status})`);
        }

        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") || "";
        const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
        const fallback = `${projectCode}-Transportation-${selectedMonth}.${format}`;
        const fileName = match ? decodeURIComponent(match[1].replace(/"/g, "")) : fallback;

        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
      } catch (error) {
        setErrorMonth(error instanceof Error ? error.message : "Export failed.");
      } finally {
        setExportingFormat(null);
      }
    },
    [projectCode, selectedMonth]
  );

  const chartData = useMemo(
    () =>
      (monthData?.dailyTotals || []).map((row) => ({
        day: row.day,
        total: row.totalTrips,
        morning: row.morningTrips,
        evening: row.eveningTrips,
      })),
    [monthData?.dailyTotals]
  );

  return (
    <div className="space-y-4">
      <Card className="gap-4 border-white/20 bg-black/35 py-4 text-zinc-100">
        <CardHeader className="px-4 pb-0 md:px-5">
          <CardTitle className="text-lg">Transportation Board</CardTitle>
          <CardDescription className="text-zinc-300">
            Shift approvals with photos, reporter traceability, and monthly trip analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 md:px-5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[140px] space-y-1 text-xs text-zinc-400">
              Project
              <Input
                value={projectCode}
                onChange={(event) => setProjectCode(event.target.value.toUpperCase())}
                className="h-9 border-white/20 bg-black/45 text-zinc-100"
              />
            </label>

            <label className="min-w-[160px] space-y-1 text-xs text-zinc-400">
              Date
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => onDateChange(event.target.value)}
                className="h-9 border-white/20 bg-black/45 text-zinc-100"
              />
            </label>

            <label className="min-w-[140px] space-y-1 text-xs text-zinc-400">
              Month
              <Input
                type="month"
                value={selectedMonth}
                onChange={(event) => onMonthChange(event.target.value)}
                className="h-9 border-white/20 bg-black/45 text-zinc-100"
              />
            </label>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-9 gap-2 border-white/20 bg-black/45 text-zinc-100 hover:bg-black/60"
                  aria-label="Export transportation month"
                >
                  {exportingFormat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="border-white/15 bg-zinc-950 text-zinc-100">
                <DropdownMenuItem onClick={() => void runExport("xlsx")}>Export XLSX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void runExport("csv")}>Export CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => void refreshAll()}
              className="h-9 gap-2 border-white/20 bg-black/45 text-zinc-100 hover:bg-black/60"
              aria-label="Refresh transportation data"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>

            {me?.isReporter ? (
              <Button
                onClick={() => {
                  setSubmitError(null);
                  setForm((prev) => ({ ...prev, workDate: selectedDate }));
                  setModalOpen(true);
                }}
                className="h-9 gap-2 border-emerald-300/30 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                aria-label="Add transportation report"
              >
                <Plus className="h-4 w-4" />
                Add report
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {loadingMe ? (
              <Badge className="border-white/20 bg-black/35 text-zinc-200">Checking permissions…</Badge>
            ) : me?.isReporter ? (
              <Badge className="border-emerald-300/40 bg-emerald-500/15 text-emerald-200">Reporter access enabled</Badge>
            ) : (
              <Badge className="border-white/20 bg-black/35 text-zinc-300">Read-only (reporter role required)</Badge>
            )}
            {errorMe ? <span className="text-red-300">{errorMe}</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 border-white/20 bg-black/35 py-4 text-zinc-100">
        <CardHeader className="px-4 pb-0 md:px-5">
          <CardTitle className="text-base">Daily Board</CardTitle>
          <CardDescription className="text-zinc-300">Cars x shifts (Morning 06:30 / Evening 19:00)</CardDescription>
        </CardHeader>
        <CardContent className="px-0 md:px-0">
          {loadingDay ? (
            <div className="px-5 py-8 text-sm text-zinc-300">Loading daily board…</div>
          ) : errorDay ? (
            <div className="px-5 py-8 text-sm text-red-300">{errorDay}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.08em] text-zinc-400">
                    <th className="border-b border-white/10 px-5 py-3 text-left font-medium">Plate</th>
                    <th className="border-b border-white/10 px-5 py-3 text-left font-medium">Morning (06:30)</th>
                    <th className="border-b border-white/10 px-5 py-3 text-left font-medium">Evening (19:00)</th>
                  </tr>
                </thead>
                <tbody>
                  {(dayData?.board || []).map((row) => (
                    <tr key={row.plate} className="align-top">
                      <td className="border-b border-white/10 px-5 py-3 font-medium text-zinc-100">
                        <div className="inline-flex items-center gap-2">
                          <Car className="h-4 w-4 text-zinc-400" />
                          {row.plate}
                        </div>
                      </td>
                      <td className="border-b border-white/10 px-5 py-3">{renderShiftCell(row.plate, "morning", row.morning, fileUrls, setViewer)}</td>
                      <td className="border-b border-white/10 px-5 py-3">{renderShiftCell(row.plate, "evening", row.evening, fileUrls, setViewer)}</td>
                    </tr>
                  ))}
                  {!dayData?.board?.length ? (
                    <tr>
                      <td className="px-5 py-6 text-sm text-zinc-400" colSpan={3}>
                        No active plates found for this project/date.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
          {!loadingFiles && filesError ? <div className="px-5 pb-3 text-xs text-red-300">{filesError.message}</div> : null}
        </CardContent>
      </Card>

      <Card className="gap-4 border-white/20 bg-black/35 py-4 text-zinc-100">
        <CardHeader className="px-4 pb-0 md:px-5">
          <CardTitle className="text-base">Monthly Analytics</CardTitle>
          <CardDescription className="text-zinc-300">Daily totals and per-plate totals for {selectedMonth}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-4 md:px-5 lg:grid-cols-[2fr_1fr]">
          <div className="h-[260px] rounded-xl border border-white/10 bg-black/30 p-3">
            {loadingMonth ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-300">Loading chart…</div>
            ) : errorMonth ? (
              <div className="flex h-full items-center justify-center text-sm text-red-300">{errorMonth}</div>
            ) : chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="day" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#38bdf8" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="morning" fill="#22c55e" name="Morning" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="evening" fill="#f97316" name="Evening" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">No monthly data yet.</div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 text-sm font-semibold">Plate totals</div>
            <div className="max-h-[230px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-zinc-400">
                  <tr>
                    <th className="py-1 text-left font-medium">Plate</th>
                    <th className="py-1 text-right font-medium">Trips</th>
                  </tr>
                </thead>
                <tbody>
                  {(monthData?.byPlate || []).map((row) => (
                    <tr key={row.plate} className="border-b border-white/5">
                      <td className="py-1 text-zinc-200">{row.plate}</td>
                      <td className="py-1 text-right text-zinc-200">{row.totalTrips}</td>
                    </tr>
                  ))}
                  {!monthData?.byPlate?.length ? (
                    <tr>
                      <td className="py-2 text-zinc-400" colSpan={2}>
                        No rows
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/40 p-2">
                <div className="text-zinc-400">Total Trips</div>
                <div className="text-base font-semibold text-zinc-100">{monthData?.totals.totalTrips ?? 0}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/40 p-2">
                <div className="text-zinc-400">Total Entries</div>
                <div className="text-base font-semibold text-zinc-100">{monthData?.totals.totalEntries ?? 0}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {modalOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close transportation report modal"
            onClick={() => setModalOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Add Transportation Report</h3>
                <p className="mt-1 text-xs text-zinc-400">Photo is required. New plate values are auto-created for the project.</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-black/35 p-1.5 text-zinc-300 hover:bg-black/55"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-zinc-400">
                Work date
                <Input
                  type="date"
                  value={form.workDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, workDate: event.target.value }))}
                  className="h-9 border-white/20 bg-black/45 text-zinc-100"
                />
              </label>

              <label className="space-y-1 text-xs text-zinc-400">
                Shift
                <select
                  value={form.shift}
                  onChange={(event) => setForm((prev) => ({ ...prev, shift: event.target.value as "morning" | "evening" }))}
                  className="h-9 w-full rounded-md border border-white/20 bg-black/45 px-3 text-sm text-zinc-100 outline-none"
                >
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </label>

              <label className="space-y-1 text-xs text-zinc-400">
                Plate
                <Input
                  list="transport-plate-options"
                  value={form.plate}
                  onChange={(event) => setForm((prev) => ({ ...prev, plate: event.target.value }))}
                  placeholder="e.g. 34ABC123"
                  className="h-9 border-white/20 bg-black/45 text-zinc-100"
                />
                <datalist id="transport-plate-options">
                  {plateOptions.map((plate) => (
                    <option key={plate} value={plate} />
                  ))}
                </datalist>
              </label>

              <label className="space-y-1 text-xs text-zinc-400">
                Trips
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={String(form.trips)}
                  onChange={(event) => setForm((prev) => ({ ...prev, trips: Number(event.target.value || "0") }))}
                  className="h-9 border-white/20 bg-black/45 text-zinc-100"
                />
              </label>

              <label className="space-y-1 text-xs text-zinc-400 md:col-span-2">
                Photo
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    setForm((prev) => ({ ...prev, file: nextFile }));
                  }}
                  className="h-9 border-white/20 bg-black/45 text-zinc-100"
                />
              </label>

              <label className="space-y-1 text-xs text-zinc-400 md:col-span-2">
                Comment (optional)
                <textarea
                  value={form.comment}
                  onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
                  className="min-h-[80px] w-full rounded-md border border-white/20 bg-black/45 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
              </label>
            </div>

            {submitError ? <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs text-red-200">{submitError}</div> : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => setModalOpen(false)}
                className="h-9 border-white/20 bg-black/35 text-zinc-100 hover:bg-black/55"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void submitReport()}
                className="h-9 gap-2 border-emerald-300/30 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {viewer ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close image viewer"
            className="absolute inset-0 bg-black/70"
            onClick={() => setViewer(null)}
          />
          <div className="absolute left-1/2 top-1/2 w-[min(960px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/20 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-sm text-zinc-200">
              <div>
                {viewer.plate} • {viewer.shift}
              </div>
              <button
                type="button"
                className="rounded-md border border-white/15 bg-black/35 p-1 text-zinc-200 hover:bg-black/55"
                onClick={() => setViewer(null)}
                aria-label="Close photo viewer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Supabase signed URLs vary by host; keep native img for unrestricted rendering. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewer.url} alt={`${viewer.plate} ${viewer.shift}`} className="max-h-[75vh] w-full object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function renderShiftCell(
  plate: string,
  shift: "morning" | "evening",
  cell: ShiftCell | null,
  fileUrls: Record<string, string | null>,
  onOpenViewer: (value: { url: string; plate: string; shift: "morning" | "evening" }) => void
) {
  if (!cell) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <Badge className="border-red-300/30 bg-red-500/10 text-red-200">Missing</Badge>
        <div className="mt-2 text-xs text-zinc-400">No report submitted.</div>
      </div>
    );
  }

  const photoUrl = (cell.photo_file_id && fileUrls[cell.photo_file_id]) || null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-emerald-300/30 bg-emerald-500/15 text-emerald-200">Done</Badge>
        <Badge className="border-sky-300/30 bg-sky-500/15 text-sky-200">{cell.trips} trips</Badge>
      </div>

      {photoUrl ? (
        <button
          type="button"
          className="mt-2 overflow-hidden rounded-lg border border-white/10"
          onClick={() => onOpenViewer({ url: photoUrl, plate, shift })}
          aria-label={`Open ${plate} ${shift} photo`}
        >
          {/* Supabase signed URLs vary by host; keep native img for unrestricted rendering. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={`${plate}-${shift}`} className="h-20 w-32 object-cover" />
        </button>
      ) : (
        <div className="mt-2 text-xs text-zinc-400">Photo URL unavailable.</div>
      )}

      <div className="mt-2 text-[11px] text-zinc-400">
        <div>{cell.reported_by}</div>
        <div>{formatReportedAt(cell.reported_at)}</div>
        {cell.comment ? <div className="mt-1 text-zinc-300">{cell.comment}</div> : null}
      </div>
    </div>
  );
}
