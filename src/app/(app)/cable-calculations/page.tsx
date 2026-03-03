"use client";

import { useMemo, useState } from "react";
import { DataCard, PageHeading } from "@/components/apex/blocks";
import { DonutChart, SimpleBars } from "@/components/apex/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  buildCableDashboard,
  createDefaultCableFilters,
  type CableFilters,
  type CableRunRow,
  type CableRunStatus,
} from "@/lib/cable-calculations-dashboard";

type SortKey = "project" | "packageCode" | "feederTag" | "designCurrentA" | "utilizationPercent" | "voltageDropPercent" | "status";

const HEADERS: Array<{ key: SortKey; label: string }> = [
  { key: "project", label: "Project" },
  { key: "packageCode", label: "Package" },
  { key: "feederTag", label: "Feeder" },
  { key: "designCurrentA", label: "Design I (A)" },
  { key: "utilizationPercent", label: "Utilization %" },
  { key: "voltageDropPercent", label: "Vd %" },
  { key: "status", label: "Status" },
];

export default function CableCalculationsPage() {
  const [filters, setFilters] = useState<CableFilters>(() => createDefaultCableFilters());
  const [sortKey, setSortKey] = useState<SortKey>("voltageDropPercent");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<CableRunRow | null>(null);

  const dashboard = useMemo(() => buildCableDashboard(filters), [filters]);

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
        title="Cable Calculations"
        description="Professional feeder sizing controls with ampacity, voltage-drop checks, and sync-ready outputs for operational execution."
        badge={`${dashboard.filterOptions.projects.length} projects`}
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
            label="Package"
            value={filters.packageCode}
            options={dashboard.filterOptions.packages}
            onChange={(value) => setFilters((prev) => ({ ...prev, packageCode: value }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={dashboard.filterOptions.statuses}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          />
          <div className="md:col-span-2 xl:col-span-3">
            <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Search</label>
            <Input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Feeder, panel, package"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-3 xl:col-span-3 flex items-end gap-2">
            <Button type="button" className={toggleClass(filters.criticalOnly)} onClick={() => setFilters((prev) => ({ ...prev, criticalOnly: !prev.criticalOnly }))}>
              Critical only
            </Button>
            <Button type="button" className="bg-primary text-primary-foreground" onClick={() => exportCsv(rows)}>
              Export CSV
            </Button>
            <Button type="button" onClick={() => setFilters(createDefaultCableFilters())}>
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Status Split" description="Cable run check outcomes for current scope.">
          <DonutChart data={dashboard.charts.statusSplit.map((item) => ({ name: item.name, value: item.value }))} dataKey="value" nameKey="name" />
        </DataCard>
        <DataCard title="Utilization by Project" description="Summed utilization percentages by project.">
          <SimpleBars
            data={dashboard.charts.utilizationByProject.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#f59e0b"
          />
        </DataCard>
        <DataCard title="Top Voltage Drop Runs" description="Highest voltage-drop candidates for re-sizing.">
          <SimpleBars
            data={dashboard.charts.topVoltageDrop.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#ef4444"
          />
        </DataCard>
        <DataCard title="Load by Package" description="Connected load distribution by project/package.">
          <SimpleBars
            data={dashboard.charts.loadByPackage.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#0284c7"
          />
        </DataCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <DataCard title="Cable Run Register" description="Sortable operational table with calculation and sync context.">
          {rows.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[1800px] text-left text-sm">
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
                    <th className="px-3 py-2 font-medium">From</th>
                    <th className="px-3 py-2 font-medium">To</th>
                    <th className="px-3 py-2 font-medium">Length m</th>
                    <th className="px-3 py-2 font-medium">Load kW</th>
                    <th className="px-3 py-2 font-medium">Cable</th>
                    <th className="px-3 py-2 font-medium">Ampacity A</th>
                    <th className="px-3 py-2 font-medium">Breaker</th>
                    <th className="px-3 py-2 font-medium">Sync</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-3 py-2">{row.project}</td>
                      <td className="px-3 py-2">{row.packageCode}</td>
                      <td className="px-3 py-2">{row.feederTag}</td>
                      <td className="px-3 py-2">{row.designCurrentA.toFixed(1)}</td>
                      <td className="px-3 py-2">{row.utilizationPercent.toFixed(1)}%</td>
                      <td className="px-3 py-2">{row.voltageDropPercent.toFixed(2)}%</td>
                      <td className="px-3 py-2">
                        <Badge className={statusClass(row.status)}>{row.status}</Badge>
                      </td>
                      <td className="px-3 py-2">{row.from}</td>
                      <td className="px-3 py-2">{row.to}</td>
                      <td className="px-3 py-2">{row.lengthM}</td>
                      <td className="px-3 py-2">{row.loadKw}</td>
                      <td className="px-3 py-2">{`${row.conductorMaterial} ${row.crossSectionMm2}mm2 x${row.parallelRuns}`}</td>
                      <td className="px-3 py-2">{row.effectiveAmpacityA.toFixed(1)}</td>
                      <td className="px-3 py-2">{row.breaker}</td>
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
            <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No cable runs match current filters.</div>
          )}
        </DataCard>

        <DataCard title="Calculation Alerts" description="Critical runs, near-limit checks, and sync failures.">
          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {dashboard.alerts.length ? (
              dashboard.alerts.map((alert) => (
                <article key={alert.id} className={`rounded-xl border p-3 ${alertClass(alert.severity)}`}>
                  <div className="text-xs uppercase tracking-[0.08em]">{alert.title}</div>
                  <p className="mt-1 text-sm">{alert.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {alert.project} / {alert.run}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active alerts.</div>
            )}
          </div>
        </DataCard>
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-[640px]">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.feederTag} - {selected.project}
                </SheetTitle>
                <SheetDescription>
                  {selected.packageCode} / {selected.from} to {selected.to}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 overflow-y-auto px-4 pb-6 text-sm">
                <InfoCard label="Load and Voltage" value={`${selected.loadKw}kW @ ${selected.voltageV}V (${selected.phaseCount}P)`} />
                <InfoCard label="Cable Selection" value={`${selected.conductorMaterial} ${selected.crossSectionMm2}mm2 x${selected.parallelRuns}, ${selected.installationMethod}`} />
                <InfoCard label="Derating Inputs" value={`Ambient ${selected.ambientTempC}C / Grouping ${selected.groupingFactor}`} />
                <InfoCard label="Current and Ampacity" value={`Design ${selected.designCurrentA.toFixed(1)}A / Effective ${selected.effectiveAmpacityA.toFixed(1)}A`} />
                <InfoCard label="Utilization and Voltage Drop" value={`${selected.utilizationPercent.toFixed(1)}% / ${selected.voltageDropPercent.toFixed(2)}% (limit ${selected.maxVoltageDropPercent}%)`} />
                <InfoCard label="Protection" value={selected.breaker} />
                <InfoCard label="Responsible / Last Update" value={`${selected.responsible} / ${selected.lastUpdate}`} />
                <InfoCard label="Sync Fields" value={`${selected.oneCReferenceId} | ${selected.externalSyncId} | ${selected.syncStatus}`} />
                <InfoCard label="Source / Last Sync" value={`${selected.sourceSystem} / ${selected.lastSyncTime}`} />
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
  setDirection(key === "project" || key === "packageCode" || key === "feederTag" || key === "status" ? "asc" : "desc");
}

function compare(left: CableRunRow, right: CableRunRow, key: SortKey): number {
  const l = left[key];
  const r = right[key];
  if (typeof l === "number" && typeof r === "number") return l - r;
  return String(l || "").localeCompare(String(r || ""));
}

function statusClass(status: CableRunStatus): string {
  if (status === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (status === "Warning") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (status === "Pass") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
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

function exportCsv(rows: CableRunRow[]) {
  const headers = [
    "Project",
    "PackageCode",
    "FeederTag",
    "From",
    "To",
    "LengthM",
    "LoadKw",
    "VoltageV",
    "PhaseCount",
    "Conductor",
    "CrossSectionMm2",
    "ParallelRuns",
    "DesignCurrentA",
    "EffectiveAmpacityA",
    "UtilizationPercent",
    "VoltageDropPercent",
    "Status",
    "Breaker",
    "OneCReferenceId",
    "ExternalSyncId",
    "SyncStatus",
    "LastSyncTime",
    "SyncErrorMessage",
    "Notes",
  ];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(
      [
        row.project,
        row.packageCode,
        row.feederTag,
        row.from,
        row.to,
        row.lengthM,
        row.loadKw,
        row.voltageV,
        row.phaseCount,
        row.conductorMaterial,
        row.crossSectionMm2,
        row.parallelRuns,
        row.designCurrentA,
        row.effectiveAmpacityA,
        row.utilizationPercent,
        row.voltageDropPercent,
        row.status,
        row.breaker,
        row.oneCReferenceId,
        row.externalSyncId,
        row.syncStatus,
        row.lastSyncTime,
        row.syncErrorMessage,
        row.notes,
      ]
        .map((cell) => csvCell(cell))
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cable-calculations.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
