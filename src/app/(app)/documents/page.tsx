"use client";

import { useMemo, useState } from "react";
import { DataCard, PageHeading } from "@/components/apex/blocks";
import { DonutChart, SimpleBars, TrendLines } from "@/components/apex/charts";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  buildProjectDocumentsDashboard,
  createDefaultProjectDocumentFilters,
  type ProjectDocumentFilters,
  type ProjectDocumentRow,
  type ProjectDocumentStatus,
} from "@/lib/project-documents-follow-up";

type SortKey = "documentCode" | "type" | "discipline" | "project" | "reviewDueDate" | "revision" | "status";

const SORT_HEADERS: Array<{ key: SortKey; label: string }> = [
  { key: "documentCode", label: "Document" },
  { key: "type", label: "Type" },
  { key: "discipline", label: "Discipline" },
  { key: "project", label: "Project" },
  { key: "revision", label: "Revision" },
  { key: "reviewDueDate", label: "Review Due" },
  { key: "status", label: "Status" },
];

const PAGE_NOW = new Date("2026-02-28T09:00:00Z");

export default function DocumentsPage() {
  const [filters, setFilters] = useState<ProjectDocumentFilters>(() => createDefaultProjectDocumentFilters());
  const [sortKey, setSortKey] = useState<SortKey>("reviewDueDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<ProjectDocumentRow | null>(null);

  const dashboard = useMemo(() => buildProjectDocumentsDashboard(filters, PAGE_NOW), [filters]);

  const rows = useMemo(() => {
    const values = [...dashboard.rows];
    values.sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      return compareRows(left, right, sortKey) * direction;
    });
    return values;
  }, [dashboard.rows, sortDirection, sortKey]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeading
        title="Project Documents Follow-Up"
        description="Pilot-BIM document control with package readiness, material-linked blockers, and 1C integration status."
        badge={`${dashboard.filterOptions.projects.length} active projects`}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {dashboard.kpis.map((kpi) => (
          <article key={kpi.key} className={`rounded-2xl border bg-card p-4 shadow-sm ${kpiBorderClass(kpi.severity)}`}>
            <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{kpi.title}</div>
            <div className="mt-2 text-2xl font-semibold">{kpi.value}</div>
            <p className="mt-2 text-xs text-muted-foreground">{kpi.description}</p>
          </article>
        ))}
      </section>

      <section className="sticky top-2 z-20 rounded-2xl border bg-background/95 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <FilterSelect
            label="Project"
            value={filters.project}
            options={dashboard.filterOptions.projects}
            onChange={(value) => setFilters((prev) => ({ ...prev, project: value }))}
          />
          <FilterSelect
            label="Package"
            value={filters.packageCode}
            options={dashboard.filterOptions.packages}
            onChange={(value) => setFilters((prev) => ({ ...prev, packageCode: value }))}
          />
          <FilterSelect
            label="Discipline"
            value={filters.discipline}
            options={dashboard.filterOptions.disciplines}
            onChange={(value) => setFilters((prev) => ({ ...prev, discipline: value }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={dashboard.filterOptions.statuses}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          />
          <FilterDate label="Date From" value={filters.dateFrom} onChange={(value) => setFilters((prev) => ({ ...prev, dateFrom: value }))} />
          <FilterDate label="Date To" value={filters.dateTo} onChange={(value) => setFilters((prev) => ({ ...prev, dateTo: value }))} />
          <div className="md:col-span-3 xl:col-span-2">
            <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Search</label>
            <Input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Code, title, package, material"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-3 xl:col-span-4 flex items-end gap-2">
            <Button type="button" className={toggleClass(filters.criticalOnly)} onClick={() => setFilters((prev) => ({ ...prev, criticalOnly: !prev.criticalOnly }))}>
              Critical only
            </Button>
            <Button type="button" className={toggleClass(filters.overdueOnly)} onClick={() => setFilters((prev) => ({ ...prev, overdueOnly: !prev.overdueOnly }))}>
              Overdue only
            </Button>
            <Button type="button" className={toggleClass(filters.blockedOnly)} onClick={() => setFilters((prev) => ({ ...prev, blockedOnly: !prev.blockedOnly }))}>
              Blocked only
            </Button>
            <Button type="button" className="bg-primary text-primary-foreground" onClick={() => exportCsv(rows)}>
              Export CSV
            </Button>
            <Button type="button" onClick={() => setFilters(createDefaultProjectDocumentFilters())}>
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Status Distribution" description="Document workflow and derived status mix.">
          <DonutChart
            data={dashboard.charts.statusDistribution.map((item) => ({ name: item.name, value: item.value }))}
            dataKey="value"
            nameKey="name"
          />
        </DataCard>
        <DataCard title="Overdue by Project" description="Review-delayed documents by project.">
          <SimpleBars
            data={dashboard.charts.overdueByProject.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#ef4444"
          />
        </DataCard>
        <DataCard title="Documents by Discipline" description="Discipline concentration for current filter scope.">
          <SimpleBars
            data={dashboard.charts.documentsByDiscipline.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#0284c7"
          />
        </DataCard>
        <DataCard title="Approvals Trend" description="Submitted versus approved documents by week.">
          <TrendLines
            data={dashboard.charts.approvalsTrend.map((item) => ({ period: item.period, submitted: item.submitted, approved: item.approved }))}
            xKey="period"
            series={[
              { key: "submitted", color: "#f59e0b", name: "Submitted" },
              { key: "approved", color: "#16a34a", name: "Approved" },
            ]}
          />
        </DataCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <DataCard title="Operational Document Register" description="Package-level document follow-up with sync and blocker context.">
          {rows.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[1600px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  <tr>
                    {SORT_HEADERS.map((header) => (
                      <th key={header.key} className="px-3 py-2 font-medium">
                        <button
                          type="button"
                          className="flex items-center gap-1"
                          onClick={() => toggleSort(header.key, sortKey, sortDirection, setSortKey, setSortDirection)}
                        >
                          {header.label}
                          {sortKey === header.key ? <span>{sortDirection === "asc" ? "▲" : "▼"}</span> : null}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Package</th>
                    <th className="px-3 py-2 font-medium">Required</th>
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 font-medium">Material</th>
                    <th className="px-3 py-2 font-medium">Sync</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.documentCode}</div>
                        <div className="text-xs text-muted-foreground">{row.title}</div>
                      </td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">{row.discipline}</td>
                      <td className="px-3 py-2">{row.project}</td>
                      <td className="px-3 py-2">{row.revision}</td>
                      <td className="px-3 py-2">{row.reviewDueDate || "-"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={row.status} tone={statusTone(row.status)} />
                      </td>
                      <td className="px-3 py-2">{row.packageCode}</td>
                      <td className="px-3 py-2">{row.requiredDate || "-"}</td>
                      <td className="px-3 py-2">{row.supplier || "Missing"}</td>
                      <td className="px-3 py-2">{row.linkedMaterialCode}</td>
                      <td className="px-3 py-2">{row.syncStatus}</td>
                      <td className="px-3 py-2">
                        <Button type="button" onClick={() => setSelected(row)}>
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No documents match current filters.</div>
          )}
        </DataCard>

        <div className="space-y-6">
          <DataCard title="Urgent Actions" description="Overdue, blocked, stale, and sync-error records requiring action.">
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {dashboard.alerts.length ? (
                dashboard.alerts.map((alert) => (
                  <article key={alert.id} className={`rounded-xl border p-3 ${alertClass(alert.severity)}`}>
                    <div className="text-xs uppercase tracking-[0.08em]">{alert.title}</div>
                    <p className="mt-1 text-sm">{alert.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alert.projectCode} / {alert.packageCode} / {alert.documentCode}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active alerts.</div>
              )}
            </div>
          </DataCard>

          <DataCard title="Business Metrics" description="Document control performance and readiness indicators.">
            <div className="space-y-2">
              {dashboard.metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border p-3">
                  <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</div>
                  <div className="mt-1 text-xl font-semibold">{metric.value}</div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-[640px]">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.documentCode} - {selected.title}
                </SheetTitle>
                <SheetDescription>
                  {selected.project} / {selected.packageCode} / {selected.discipline}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 overflow-y-auto px-4 pb-6 text-sm">
                <InfoCard label="Status Tags" value={selected.statusTags.join(", ")} />
                <InfoCard label="Responsible" value={selected.responsible || "Unassigned"} />
                <InfoCard label="Supplier" value={selected.supplier || "Missing"} />
                <InfoCard label="Linked Material" value={selected.linkedMaterialCode} />
                <InfoCard label="Package Readiness" value={`${selected.packageReadiness.toFixed(1)}%`} />
                <InfoCard label="Workflow Dates" value={`Required: ${selected.requiredDate || "-"} / Review Due: ${selected.reviewDueDate || "-"} / Approved: ${selected.approvedDate || "-"}`} />
                <InfoCard label="Sync Fields" value={`${selected.oneCReferenceId} | ${selected.externalSyncId} | ${selected.syncStatus} | ${selected.externalStatus}`} />
                <InfoCard label="Last Sync" value={selected.lastSyncTime || "-"} />
                <InfoCard label="Source System" value={selected.sourceSystem || "-"} />
                {selected.syncErrorMessage ? <InfoCard label="Sync Error" value={selected.syncErrorMessage} /> : null}
                <InfoCard label="Notes" value={selected.notes || "-"} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</label>
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1" />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function toggleSort(
  key: SortKey,
  currentKey: SortKey,
  currentDirection: "asc" | "desc",
  setKey: (key: SortKey) => void,
  setDirection: (direction: "asc" | "desc") => void
) {
  if (key === currentKey) {
    setDirection(currentDirection === "asc" ? "desc" : "asc");
    return;
  }

  setKey(key);
  setDirection(key === "documentCode" || key === "type" || key === "discipline" || key === "project" || key === "status" ? "asc" : "desc");
}

function compareRows(left: ProjectDocumentRow, right: ProjectDocumentRow, key: SortKey): number {
  const leftValue = left[key];
  const rightValue = right[key];

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }

  if (key === "reviewDueDate") {
    return new Date(leftValue || "1970-01-01").getTime() - new Date(rightValue || "1970-01-01").getTime();
  }

  return String(leftValue || "").localeCompare(String(rightValue || ""));
}

function statusTone(status: ProjectDocumentStatus): StatusTone {
  if (status === "Issued for Construction") return "blue";
  if (status === "Approved") return "green";
  if (status === "Blocked" || status === "Overdue" || status === "Rejected") return "red";
  if (status === "Missing Info" || status === "In Review" || status === "Submitted") return "yellow";
  return "neutral";
}

function kpiBorderClass(severity: "critical" | "warning" | "ok" | "neutral") {
  if (severity === "critical") return "border-l-4 border-l-red-500";
  if (severity === "warning") return "border-l-4 border-l-amber-500";
  if (severity === "ok") return "border-l-4 border-l-emerald-500";
  return "border-l-4 border-l-sky-500";
}

function alertClass(severity: "critical" | "warning" | "info") {
  if (severity === "critical") return "border-red-500/40 bg-red-500/10";
  if (severity === "warning") return "border-amber-500/40 bg-amber-500/10";
  return "border-sky-500/30 bg-sky-500/10";
}

function toggleClass(active: boolean) {
  return active ? "bg-primary text-primary-foreground" : "";
}

function exportCsv(rows: ProjectDocumentRow[]) {
  const headers = [
    "DocumentCode",
    "Title",
    "Type",
    "Discipline",
    "Project",
    "PackageCode",
    "Revision",
    "Status",
    "StatusTags",
    "RequiredDate",
    "ReviewDueDate",
    "ApprovedDate",
    "Supplier",
    "LinkedMaterialCode",
    "Responsible",
    "PackageReadiness",
    "OneCReferenceId",
    "ExternalSyncId",
    "SyncStatus",
    "ExternalStatus",
    "LastSyncTime",
    "SourceSystem",
    "SyncErrorMessage",
    "Notes",
  ];

  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const values = [
      row.documentCode,
      row.title,
      row.type,
      row.discipline,
      row.project,
      row.packageCode,
      row.revision,
      row.status,
      row.statusTags.join(" | "),
      row.requiredDate,
      row.reviewDueDate,
      row.approvedDate,
      row.supplier,
      row.linkedMaterialCode,
      row.responsible,
      row.packageReadiness,
      row.oneCReferenceId,
      row.externalSyncId,
      row.syncStatus,
      row.externalStatus,
      row.lastSyncTime,
      row.sourceSystem,
      row.syncErrorMessage,
      row.notes,
    ]
      .map((value) => csvCell(value))
      .join(",");
    lines.push(values);
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "project-documents-follow-up.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const output = String(value ?? "");
  if (output.includes(",") || output.includes("\n") || output.includes('"')) {
    return `"${output.replaceAll('"', '""')}"`;
  }
  return output;
}
