"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase/browser";

type FileRow = {
  id: string;
  project_id: string;
  report_date: string | null;
  original_filename: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  parse_error: string | null;
  created_at: string;
  updated_at: string;
  uploaded_by: string | null;
  report: {
    id: string;
    report_title: string | null;
    contractor_name: string | null;
    zone: string | null;
    floor: string | null;
    summary_json: Record<string, unknown> | null;
  } | null;
};

type ListPayload = {
  projectId: string;
  rows: FileRow[];
};

type DetailPayload = {
  file: FileRow;
  report: {
    id: string;
    report_title: string | null;
    contractor_name: string | null;
    zone: string | null;
    floor: string | null;
    summary_json: Record<string, unknown> | null;
  } | null;
  items: Array<{
    id: string;
    sort_order: number;
    category: string | null;
    item_code: string | null;
    item_name: string;
    unit: string | null;
    planned_qty: number | null;
    actual_qty: number | null;
    cumulative_qty: number | null;
    remarks: string | null;
  }>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: T } | null;
  if (!res.ok || payload?.ok === false || !payload?.data) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return payload.data;
}

function statusClass(status: FileRow["status"]): string {
  if (status === "ready") return "border-emerald-300/35 bg-emerald-500/18 text-emerald-100";
  if (status === "processing") return "border-sky-300/35 bg-sky-500/18 text-sky-100";
  if (status === "failed") return "border-red-300/35 bg-red-500/18 text-red-100";
  return "border-amber-300/35 bg-amber-500/18 text-amber-100";
}

function fmtDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString();
}

function fmtNumber(value: unknown): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function DailyInstallationReportsWorkspace() {
  const [projectId, setProjectId] = useState("A27");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [realtimeSyncing, setRealtimeSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  const selected = useMemo(() => files.find((row) => row.id === selectedFileId) || null, [files, selectedFileId]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setActionError(null);
    try {
      const data = await api<ListPayload>(`/api/daily-installation-reports?projectId=${encodeURIComponent(projectId)}&limit=80`);
      setFiles(data.rows || []);
      if (!selectedFileId && data.rows?.length) setSelectedFileId(data.rows[0].id);
      if (selectedFileId && !data.rows.some((row) => row.id === selectedFileId)) {
        setSelectedFileId(data.rows[0]?.id || null);
      }
    } catch (error) {
      setFiles([]);
      setActionError(error instanceof Error ? error.message : "Failed to load file history.");
    } finally {
      setLoadingList(false);
    }
  }, [projectId, selectedFileId]);

  const loadDetail = useCallback(async () => {
    if (!selectedFileId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const data = await api<DetailPayload>(`/api/daily-installation-reports/${selectedFileId}`);
      setDetail(data);
    } catch (error) {
      setDetail(null);
      setActionError(error instanceof Error ? error.message : "Failed to load report detail.");
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedFileId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`daily-installation-reports:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_installation_report_files", filter: `project_id=eq.${projectId}` },
        () => {
          setRealtimeSyncing(true);
          void loadList().finally(() => setRealtimeSyncing(false));
          if (selectedFileId) {
            void loadDetail();
          }
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [loadDetail, loadList, projectId, selectedFileId]);

  const onUpload = useCallback(async () => {
    if (!file) {
      setActionError("Choose a file before uploading.");
      return;
    }
    setUploading(true);
    setActionError(null);
    setActionInfo(null);
    try {
      const form = new FormData();
      form.set("projectId", projectId);
      form.set("file", file);
      const data = await api<{ fileId: string; status: string; itemCount: number }>("/api/daily-installation-reports", {
        method: "POST",
        body: form,
      });
      setSelectedFileId(data.fileId);
      setActionInfo(`Upload completed. Status: ${data.status}. Parsed items: ${data.itemCount}.`);
      setFile(null);
      await loadList();
      await loadDetail();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [file, loadDetail, loadList, projectId]);

  const openFile = useCallback(async (fileId: string) => {
    try {
      const data = await api<{ url: string }>(`/api/daily-installation-reports/${fileId}/signed-url`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to open file.");
    }
  }, []);

  const retryParse = useCallback(
    async (fileId: string) => {
      setActionError(null);
      setActionInfo(null);
      try {
        await api<{ status: string; itemCount: number }>(`/api/daily-installation-reports/${fileId}/retry`, { method: "POST" });
        setActionInfo("Reprocess started and completed.");
        await loadList();
        if (fileId === selectedFileId) await loadDetail();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Retry failed.");
      }
    },
    [loadDetail, loadList, selectedFileId]
  );

  const deleteReport = useCallback(
    async (fileId: string) => {
      setActionError(null);
      setActionInfo(null);
      try {
        const res = await fetch(`/api/daily-installation-reports/${fileId}`, { method: "DELETE" });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || payload?.ok === false) {
          throw new Error(payload?.error || `Delete failed (${res.status})`);
        }
        setActionInfo("Report deleted.");
        if (selectedFileId === fileId) setSelectedFileId(null);
        await loadList();
        await loadDetail();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Delete failed.");
      }
    },
    [loadDetail, loadList, selectedFileId]
  );

  const summary = (detail?.report?.summary_json || {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <Card className="border-white/20 bg-black/35 text-zinc-100">
        <CardHeader>
          <CardTitle>Daily Installation Reports</CardTitle>
          <CardDescription className="text-zinc-300">
            Single DB-first pipeline: upload file, parse server-side, persist normalized rows, render from database only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[120px] space-y-1 text-xs text-zinc-400">
              Project
              <Input value={projectId} onChange={(event) => setProjectId(event.target.value.toUpperCase())} className="h-9 border-white/20 bg-black/45 text-zinc-100" />
            </label>
            <label className="min-w-[320px] space-y-1 text-xs text-zinc-400">
              Report file (.xlsx/.xlsm)
              <Input type="file" accept=".xlsx,.xlsm" onChange={(event) => setFile(event.target.files?.[0] || null)} className="h-9 border-white/20 bg-black/45 text-zinc-100" />
            </label>
            <Button onClick={() => void onUpload()} className="h-9 gap-2 border-white/20 bg-black/45 hover:bg-black/60" disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload & Process
            </Button>
            <Button onClick={() => void loadList()} className="h-9 gap-2 border-white/20 bg-black/45 hover:bg-black/60" disabled={loadingList}>
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </Button>
            {realtimeSyncing ? <span className="text-xs text-zinc-400">Realtime syncing...</span> : null}
          </div>
          {actionInfo ? <div className="text-xs text-emerald-200">{actionInfo}</div> : null}
          {actionError ? <div className="text-xs text-red-300">{actionError}</div> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-white/20 bg-black/35 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-base">File History</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="py-8 text-sm text-zinc-300">Loading...</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/25">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-black/45 text-zinc-300">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Uploaded</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Report Date</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">File Name</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Zone/Floor</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Status</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((row) => (
                      <tr key={row.id} className={`border-t border-white/10 ${selectedFileId === row.id ? "bg-white/5" : ""}`}>
                        <td className="px-3 py-2">{fmtDateTime(row.created_at)}</td>
                        <td className="px-3 py-2">{row.report_date || "-"}</td>
                        <td className="px-3 py-2">{row.original_filename}</td>
                        <td className="px-3 py-2">{row.report?.zone || "-"} / {row.report?.floor || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button onClick={() => setSelectedFileId(row.id)} className="h-7 border-white/20 bg-black/40 px-2 text-xs hover:bg-black/60">
                              View
                            </Button>
                            <Button onClick={() => void openFile(row.id)} className="h-7 border-white/20 bg-black/40 px-2 text-xs hover:bg-black/60">
                              Open
                            </Button>
                            {row.status === "failed" ? (
                              <Button onClick={() => void retryParse(row.id)} className="h-7 border-white/20 bg-black/40 px-2 text-xs hover:bg-black/60">
                                Retry
                              </Button>
                            ) : null}
                            <Button onClick={() => void deleteReport(row.id)} className="h-7 border-red-300/30 bg-red-500/15 px-2 text-xs text-red-100 hover:bg-red-500/25">
                              <Trash2 className="mr-1 h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!files.length ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-zinc-400" colSpan={6}>
                          No uploaded reports yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/20 bg-black/35 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-base">Selected Report</CardTitle>
            <CardDescription className="text-zinc-300">{selected ? selected.original_filename : "No report selected"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDetail ? (
              <div className="py-8 text-sm text-zinc-300">Loading details...</div>
            ) : !selected ? (
              <div className="py-8 text-sm text-zinc-400">Choose a file row to view details.</div>
            ) : selected.status === "failed" ? (
              <div className="rounded-xl border border-red-300/35 bg-red-500/15 p-3 text-sm text-red-100">
                <div className="font-medium">Parse failed</div>
                <div className="mt-1">{selected.parse_error || "Unknown parser error."}</div>
              </div>
            ) : selected.status !== "ready" ? (
              <div className="rounded-xl border border-sky-300/30 bg-sky-500/12 p-3 text-sm text-sky-100">
                Report status is <strong>{selected.status}</strong>. Waiting for parser completion.
              </div>
            ) : (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Report Date</div>
                    <div className="text-lg font-semibold">{selected.report_date || "-"}</div>
                  </div>
                  <div className="rounded-lg border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Item Count</div>
                    <div className="text-lg font-semibold">{detail?.items.length || 0}</div>
                  </div>
                  <div className="rounded-lg border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Actual Qty</div>
                    <div className="text-lg font-semibold">{fmtNumber((summary.totals as Record<string, unknown> | undefined)?.actualQty)}</div>
                  </div>
                  <div className="rounded-lg border border-white/15 bg-black/35 p-3">
                    <div className="text-xs text-zinc-400">Updated</div>
                    <div className="text-sm">{fmtDateTime(selected.updated_at)}</div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/25">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-black/45 text-zinc-300">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">#</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Category</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Code</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Item</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em]">Unit</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-[0.08em]">Plan</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-[0.08em]">Actual</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-[0.08em]">Cumulative</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail?.items || []).map((item) => (
                        <tr key={item.id} className="border-t border-white/10">
                          <td className="px-3 py-2 text-zinc-400">{item.sort_order}</td>
                          <td className="px-3 py-2">{item.category || "-"}</td>
                          <td className="px-3 py-2">{item.item_code || "-"}</td>
                          <td className="px-3 py-2">{item.item_name}</td>
                          <td className="px-3 py-2">{item.unit || "-"}</td>
                          <td className="px-3 py-2 text-right">{fmtNumber(item.planned_qty)}</td>
                          <td className="px-3 py-2 text-right">{fmtNumber(item.actual_qty)}</td>
                          <td className="px-3 py-2 text-right">{fmtNumber(item.cumulative_qty)}</td>
                        </tr>
                      ))}
                      {!(detail?.items || []).length ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-zinc-400" colSpan={8}>
                            No parsed items found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
