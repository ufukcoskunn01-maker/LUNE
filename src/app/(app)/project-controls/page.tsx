"use client";

import { useMemo, useState } from "react";
import { DataCard, PageHeading } from "@/components/apex/blocks";
import { DonutChart, SimpleBars, StackedBars, TrendLines } from "@/components/apex/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  buildProjectControlsDashboard,
  createDefaultProjectControlsFilters,
  type ProjectControlsFilters,
  type ProjectControlsRow,
  type ProjectControlsStatus,
} from "@/lib/project-controls-follow-up";

type SortKey = "project" | "packageCode" | "manager" | "spi" | "cpi" | "riskScore" | "status";

const HEADERS: Array<{ key: SortKey; label: string }> = [
  { key: "project", label: "Project" },
  { key: "packageCode", label: "Package" },
  { key: "manager", label: "Manager" },
  { key: "spi", label: "SPI" },
  { key: "cpi", label: "CPI" },
  { key: "riskScore", label: "Risk" },
  { key: "status", label: "Status" },
];

export default function ProjectControlsPage() {
  const [filters, setFilters] = useState<ProjectControlsFilters>(() => createDefaultProjectControlsFilters());
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<ProjectControlsRow | null>(null);

  const dashboard = useMemo(() => buildProjectControlsDashboard(filters), [filters]);

  const rows = useMemo(() => {
    const values = [...dashboard.rows];
    values.sort((left, right) => {
      const factor = direction === "asc" ? 1 : -1;
      return compare(left, right, sortKey) * factor;
    });
    return values;
  }, [dashboard.rows, direction, sortKey]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeading
        title="Project Controls Follow-Up"
        description="Integrated package control across progress, SPI/CPI, material readiness, document readiness, and sync health."
        badge={`${dashboard.filterOptions.projects.length} projects in controls scope`}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {dashboard.kpis.map((kpi) => (
          <article key={kpi.key} className={`rounded-2xl border bg-card p-4 shadow-sm ${kpiClass(kpi.severity)}`}>
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
            label="Manager"
            value={filters.manager}
            options={dashboard.filterOptions.managers}
            onChange={(value) => setFilters((prev) => ({ ...prev, manager: value }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={dashboard.filterOptions.statuses}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          />
          <FilterSelect
            label="Risk Level"
            value={filters.riskLevel}
            options={dashboard.filterOptions.riskLevels}
            onChange={(value) => setFilters((prev) => ({ ...prev, riskLevel: value }))}
          />
          <div className="md:col-span-2 xl:col-span-2">
            <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Search</label>
            <Input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Project, package, discipline"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-3 xl:col-span-2 flex items-end gap-2">
            <Button type="button" className={toggleClass(filters.criticalOnly)} onClick={() => setFilters((prev) => ({ ...prev, criticalOnly: !prev.criticalOnly }))}>
              Critical only
            </Button>
            <Button type="button" className={toggleClass(filters.blockedOnly)} onClick={() => setFilters((prev) => ({ ...prev, blockedOnly: !prev.blockedOnly }))}>
              Blocked only
            </Button>
            <Button type="button" className="bg-primary text-primary-foreground" onClick={() => exportCsv(rows)}>
              Export CSV
            </Button>
            <Button type="button" onClick={() => setFilters(createDefaultProjectControlsFilters())}>
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataCard title="SPI/CPI by Project" description="Average schedule and cost performance per project.">
          <TrendLines
            data={dashboard.charts.performanceByProject.map((item) => ({ project: item.name, spi: item.spi, cpi: item.cpi }))}
            xKey="project"
            series={[
              { key: "spi", color: "#0284c7", name: "SPI" },
              { key: "cpi", color: "#16a34a", name: "CPI" },
            ]}
          />
        </DataCard>

        <DataCard title="Readiness Balance" description="Material and document readiness by project.">
          <StackedBars
            data={dashboard.charts.readinessByProject.map((item) => ({ project: item.project, material: item.material, documents: item.documents }))}
            xKey="project"
            bars={[
              { key: "material", color: "#f97316", name: "Material Readiness" },
              { key: "documents", color: "#2563eb", name: "Document Readiness" },
            ]}
          />
        </DataCard>

        <DataCard title="Blocked Reasons" description="Current blocker source split.">
          <DonutChart
            data={dashboard.charts.blockedByReason.map((item) => ({ name: item.name, value: item.value }))}
            dataKey="value"
            nameKey="name"
          />
        </DataCard>

        <DataCard title="Risk by Manager" description="Aggregated risk score by responsible manager.">
          <SimpleBars
            data={dashboard.charts.riskByManager.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#ef4444"
          />
        </DataCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <DataCard title="Package Control Register" description="Cross-module package controls with readiness, variance, and sync context.">
          {rows.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[1700px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  <tr>
                    {HEADERS.map((header) => (
                      <th key={header.key} className="px-3 py-2 font-medium">
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort(header.key, sortKey, direction, setSortKey, setDirection)}>
                          {header.label}
                          {sortKey === header.key ? <span>{direction === "asc" ? "▲" : "▼"}</span> : null}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Package Name</th>
                    <th className="px-3 py-2 font-medium">Discipline</th>
                    <th className="px-3 py-2 font-medium">Planned %</th>
                    <th className="px-3 py-2 font-medium">Actual %</th>
                    <th className="px-3 py-2 font-medium">Mat. Ready</th>
                    <th className="px-3 py-2 font-medium">Doc. Ready</th>
                    <th className="px-3 py-2 font-medium">Shortages</th>
                    <th className="px-3 py-2 font-medium">Overdue Docs</th>
                    <th className="px-3 py-2 font-medium">Sync</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-3 py-2">{row.project}</td>
                      <td className="px-3 py-2">{row.packageCode}</td>
                      <td className="px-3 py-2">{row.manager}</td>
                      <td className="px-3 py-2">{row.spi.toFixed(2)}</td>
                      <td className="px-3 py-2">{row.cpi.toFixed(2)}</td>
                      <td className="px-3 py-2">{row.riskScore}</td>
                      <td className="px-3 py-2">
                        <Badge className={statusClass(row.status)}>{row.status}</Badge>
                      </td>
                      <td className="px-3 py-2">{row.packageName}</td>
                      <td className="px-3 py-2">{row.discipline}</td>
                      <td className="px-3 py-2">{row.plannedProgress}%</td>
                      <td className="px-3 py-2">{row.actualProgress}%</td>
                      <td className="px-3 py-2">{row.materialReadiness}%</td>
                      <td className="px-3 py-2">{row.documentReadiness}%</td>
                      <td className="px-3 py-2">{row.shortageItems}</td>
                      <td className="px-3 py-2">{row.overdueDocuments}</td>
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
            <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No package rows for the selected filters.</div>
          )}
        </DataCard>

        <div className="space-y-6">
          <DataCard title="Urgent Control Actions" description="Blocked packages, SPI/CPI drops, and sync failures.">
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {dashboard.alerts.length ? (
                dashboard.alerts.map((alert) => (
                  <article key={alert.id} className={`rounded-xl border p-3 ${alertClass(alert.severity)}`}>
                    <div className="text-xs uppercase tracking-[0.08em]">{alert.title}</div>
                    <p className="mt-1 text-sm">{alert.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alert.project} / {alert.packageCode}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No urgent actions.</div>
              )}
            </div>
          </DataCard>

          <DataCard title="Business Metrics" description="Readiness, shortage, and blocked package indicators.">
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
                  {selected.project} / {selected.packageCode}
                </SheetTitle>
                <SheetDescription>{selected.packageName}</SheetDescription>
              </SheetHeader>
              <div className="space-y-3 overflow-y-auto px-4 pb-6 text-sm">
                <InfoCard label="Discipline" value={selected.discipline} />
                <InfoCard label="Manager" value={selected.manager} />
                <InfoCard label="Baseline / Forecast Finish" value={`${selected.baselineFinish} / ${selected.forecastFinish}`} />
                <InfoCard label="Progress" value={`Planned ${selected.plannedProgress}% / Actual ${selected.actualProgress}%`} />
                <InfoCard label="Performance" value={`SPI ${selected.spi.toFixed(2)} / CPI ${selected.cpi.toFixed(2)} / Cost Var ${selected.costVarianceM.toFixed(2)}M`} />
                <InfoCard label="Schedule Variance" value={`${selected.scheduleVarianceDays} days`} />
                <InfoCard label="Readiness" value={`Material ${selected.materialReadiness}% / Documents ${selected.documentReadiness}%`} />
                <InfoCard label="Blockers" value={`Material: ${selected.blockedByMaterial ? "Yes" : "No"} / Documents: ${selected.blockedByDocuments ? "Yes" : "No"}`} />
                <InfoCard label="Shortages / Overdue Docs" value={`${selected.shortageItems} / ${selected.overdueDocuments}`} />
                <InfoCard label="Sync Fields" value={`${selected.oneCReferenceId} | ${selected.externalSyncId} | ${selected.syncStatus}`} />
                <InfoCard label="Source / Last Sync" value={`${selected.sourceSystem} / ${selected.lastSyncTime}`} />
                {selected.syncErrorMessage ? <InfoCard label="Sync Error" value={selected.syncErrorMessage} /> : null}
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
  setDirection(key === "project" || key === "packageCode" || key === "manager" || key === "status" ? "asc" : "desc");
}

function compare(left: ProjectControlsRow, right: ProjectControlsRow, key: SortKey): number {
  const l = left[key];
  const r = right[key];
  if (typeof l === "number" && typeof r === "number") return l - r;
  return String(l || "").localeCompare(String(r || ""));
}

function statusClass(status: ProjectControlsStatus): string {
  if (status === "Blocked" || status === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (status === "Watch") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (status === "On Track" || status === "Completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-sky-500/30 bg-sky-500/10 text-sky-300";
}

function kpiClass(severity: "critical" | "warning" | "ok" | "neutral") {
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

function exportCsv(rows: ProjectControlsRow[]) {
  const headers = [
    "Project",
    "PackageCode",
    "PackageName",
    "Discipline",
    "Manager",
    "BaselineFinish",
    "ForecastFinish",
    "PlannedProgress",
    "ActualProgress",
    "SPI",
    "CPI",
    "CostVarianceM",
    "ScheduleVarianceDays",
    "MaterialReadiness",
    "DocumentReadiness",
    "Status",
    "StatusTags",
    "RiskScore",
    "RiskLevel",
    "ShortageItems",
    "OverdueDocuments",
    "OneCReferenceId",
    "ExternalSyncId",
    "SyncStatus",
    "SourceSystem",
    "LastSyncTime",
    "SyncErrorMessage",
  ];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        row.project,
        row.packageCode,
        row.packageName,
        row.discipline,
        row.manager,
        row.baselineFinish,
        row.forecastFinish,
        row.plannedProgress,
        row.actualProgress,
        row.spi,
        row.cpi,
        row.costVarianceM,
        row.scheduleVarianceDays,
        row.materialReadiness,
        row.documentReadiness,
        row.status,
        row.statusTags.join(" | "),
        row.riskScore,
        row.riskLevel,
        row.shortageItems,
        row.overdueDocuments,
        row.oneCReferenceId,
        row.externalSyncId,
        row.syncStatus,
        row.sourceSystem,
        row.lastSyncTime,
        row.syncErrorMessage,
      ]
        .map((cell) => csvCell(cell))
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "project-controls-follow-up.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
