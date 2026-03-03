"use client";

import { useEffect, useMemo, useState } from "react";
import { DataCard, PageHeading } from "@/components/apex/blocks";
import { DonutChart, SimpleBars, StackedBars, TrendLines } from "@/components/apex/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  buildWarehouseDashboard,
  createDefaultWarehouseFilters,
  type WarehouseFilters,
  type WarehouseOperationalRow,
  type WarehouseStatus,
} from "@/lib/warehouse-follow-up";

type SortKey =
  | "materialCode"
  | "category"
  | "warehouse"
  | "currentStock"
  | "availableStock"
  | "pendingDeliveryQuantity"
  | "shortageQuantity"
  | "expectedDeliveryDate"
  | "project"
  | "lastTransactionDate"
  | "status";

const SORT_HEADERS: Array<{ key: SortKey; label: string }> = [
  { key: "materialCode", label: "Material" },
  { key: "category", label: "Category" },
  { key: "warehouse", label: "Warehouse" },
  { key: "currentStock", label: "Current" },
  { key: "availableStock", label: "Available" },
  { key: "pendingDeliveryQuantity", label: "Pending Delivery" },
  { key: "shortageQuantity", label: "Shortage" },
  { key: "expectedDeliveryDate", label: "Expected Delivery" },
  { key: "project", label: "Project" },
  { key: "lastTransactionDate", label: "Last Tx" },
  { key: "status", label: "Status" },
];

const PAGE_NOW = new Date("2026-02-28T09:00:00Z");

export default function WarehousePage() {
  const [filters, setFilters] = useState<WarehouseFilters>(() => createDefaultWarehouseFilters());
  const [sortKey, setSortKey] = useState<SortKey>("shortageQuantity");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedRow, setSelectedRow] = useState<WarehouseOperationalRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 240);
    return () => window.clearTimeout(timer);
  }, []);

  const dashboard = useMemo(() => buildWarehouseDashboard(filters, PAGE_NOW), [filters]);

  const sortedRows = useMemo(() => {
    const rows = [...dashboard.rows];
    rows.sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      return compare(left, right, sortKey) * direction;
    });
    return rows;
  }, [dashboard.rows, sortDirection, sortKey]);

  const hasRows = sortedRows.length > 0;

  return (
    <div className="space-y-6 pb-8">
      <PageHeading
        title="1C Warehouse Follow-Up"
        description="Enterprise-grade material operations control with stock, reservations, deliveries, package readiness, and 1C sync visibility."
        badge={`${dashboard.filterOptions.warehouses.length} warehouse locations`}
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
          <FilterSelect label="Warehouse" value={filters.warehouse} options={dashboard.filterOptions.warehouses} onChange={(value) => setFilters((prev) => ({ ...prev, warehouse: value }))} />
          <FilterSelect label="Category" value={filters.category} options={dashboard.filterOptions.categories} onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))} />
          <FilterSelect label="Project" value={filters.project} options={dashboard.filterOptions.projects} onChange={(value) => setFilters((prev) => ({ ...prev, project: value }))} />
          <FilterSelect label="Package" value={filters.packageCode} options={dashboard.filterOptions.packages} onChange={(value) => setFilters((prev) => ({ ...prev, packageCode: value }))} />
          <FilterSelect label="Supplier" value={filters.supplier} options={dashboard.filterOptions.suppliers} onChange={(value) => setFilters((prev) => ({ ...prev, supplier: value }))} />
          <FilterSelect label="Status" value={filters.status} options={dashboard.filterOptions.statuses} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} />
          <FilterDate label="Date From" value={filters.dateFrom} onChange={(value) => setFilters((prev) => ({ ...prev, dateFrom: value }))} />
          <FilterDate label="Date To" value={filters.dateTo} onChange={(value) => setFilters((prev) => ({ ...prev, dateTo: value }))} />
          <div className="md:col-span-2 xl:col-span-2">
            <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Search</label>
            <Input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Code, material, project, package"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-3 xl:col-span-2 flex items-end gap-2">
            <Button type="button" className={toggleClass(filters.criticalOnly)} onClick={() => setFilters((prev) => ({ ...prev, criticalOnly: !prev.criticalOnly }))}>Critical only</Button>
            <Button type="button" className={toggleClass(filters.shortageOnly)} onClick={() => setFilters((prev) => ({ ...prev, shortageOnly: !prev.shortageOnly }))}>Shortage only</Button>
            <Button type="button" className={toggleClass(filters.delayedOnly)} onClick={() => setFilters((prev) => ({ ...prev, delayedOnly: !prev.delayedOnly }))}>Delayed only</Button>
            <Button type="button" className={toggleClass(filters.reservedOnly)} onClick={() => setFilters((prev) => ({ ...prev, reservedOnly: !prev.reservedOnly }))}>Reserved only</Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" className="bg-primary text-primary-foreground" onClick={() => exportCsv(sortedRows)}>
            Export CSV
          </Button>
          <Button type="button" onClick={() => setFilters(createDefaultWarehouseFilters())}>Reset Filters</Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Stock by Category" description="Available stock grouped by material category.">
          <SimpleBars
            data={dashboard.charts.stockByCategory.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#0284c7"
          />
        </DataCard>

        <DataCard title="Shortages by Project" description="Open shortage volume by project.">
          <SimpleBars
            data={dashboard.charts.shortagesByProject.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#ef4444"
          />
        </DataCard>

        <DataCard title="Delayed Deliveries by Supplier" description="Late delivery count by supplier.">
          <SimpleBars
            data={dashboard.charts.delayedBySupplier.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#f59e0b"
          />
        </DataCard>

        <DataCard title="Material Movement Trend" description="Incoming and outgoing movement by week.">
          <TrendLines
            data={dashboard.charts.movementTrend.map((item) => ({ period: item.period, incoming: item.incoming, outgoing: item.outgoing }))}
            xKey="period"
            series={[
              { key: "incoming", color: "#10b981", name: "Incoming" },
              { key: "outgoing", color: "#0284c7", name: "Outgoing" },
            ]}
          />
        </DataCard>

        <DataCard title="Reservation vs Available" description="Current reserved and available stock balance.">
          <DonutChart
            data={dashboard.charts.reservationVsAvailable.map((item) => ({ name: item.name, value: item.value }))}
            dataKey="value"
            nameKey="name"
          />
        </DataCard>

        <DataCard title="Top Critical Materials" description="Highest shortage quantities requiring immediate action.">
          <SimpleBars
            data={dashboard.charts.topCriticalMaterials.map((item) => ({ name: item.name, value: item.value }))}
            xKey="name"
            barKey="value"
            color="#dc2626"
          />
        </DataCard>

        <DataCard title="Warehouse Balance Overview" description="Current, reserved and available stock by warehouse." className="xl:col-span-2">
          <StackedBars
            data={dashboard.charts.warehouseBalance.map((item) => ({ warehouse: item.warehouse, current: item.current, reserved: item.reserved, available: item.available }))}
            xKey="warehouse"
            bars={[
              { key: "current", color: "#2563eb", name: "Current" },
              { key: "reserved", color: "#f97316", name: "Reserved" },
              { key: "available", color: "#16a34a", name: "Available" },
            ]}
          />
        </DataCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <DataCard title="Operational Material Register" description="Sortable package-level warehouse operations table with status logic and sync context.">
          {loading ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Loading warehouse operations...</div>
          ) : hasRows ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[2000px] text-left text-sm">
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
                    <th className="px-3 py-2 font-medium">Reserved</th>
                    <th className="px-3 py-2 font-medium">Incoming</th>
                    <th className="px-3 py-2 font-medium">Outgoing</th>
                    <th className="px-3 py-2 font-medium">Issued</th>
                    <th className="px-3 py-2 font-medium">Excess</th>
                    <th className="px-3 py-2 font-medium">Reorder</th>
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 font-medium">Package</th>
                    <th className="px-3 py-2 font-medium">Responsible</th>
                    <th className="px-3 py-2 font-medium">Last Sync</th>
                    <th className="px-3 py-2 font-medium">1C Ref</th>
                    <th className="px-3 py-2 font-medium">Quick Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.materialCode}</div>
                        <div className="text-xs text-muted-foreground">{row.materialName}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.category}</div>
                        <div className="text-xs text-muted-foreground">{row.subcategory}</div>
                      </td>
                      <td className="px-3 py-2">{row.warehouse}</td>
                      <td className="px-3 py-2">{row.currentStock}</td>
                      <td className="px-3 py-2">{row.availableStock}</td>
                      <td className="px-3 py-2 text-red-400">{row.shortageQuantity}</td>
                      <td className="px-3 py-2">{row.expectedDeliveryDate || "-"}</td>
                      <td className="px-3 py-2">{row.project}</td>
                      <td className="px-3 py-2">
                        <Badge className={statusBadgeClass(row.status)}>{row.status}</Badge>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.statusTags.slice(1).map((status) => (
                            <Badge key={`${row.id}-${status}`} className={secondaryBadgeClass(status)}>
                              {status}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">{row.reservedStock}</td>
                      <td className="px-3 py-2">{row.incomingQuantity}</td>
                      <td className="px-3 py-2">{row.outgoingQuantity}</td>
                      <td className="px-3 py-2">{row.issuedToSiteQuantity}</td>
                      <td className="px-3 py-2">{row.excessQuantity}</td>
                      <td className="px-3 py-2">{row.reorderStatus}</td>
                      <td className="px-3 py-2">{row.supplier || "Unassigned"}</td>
                      <td className="px-3 py-2">{row.packageCode}</td>
                      <td className="px-3 py-2">{row.responsiblePerson}</td>
                      <td className="px-3 py-2">{row.lastSyncTime || "-"}</td>
                      <td className="px-3 py-2">{row.oneCReferenceId || "-"}</td>
                      <td className="px-3 py-2">
                        <Button type="button" onClick={() => setSelectedRow(row)}>
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No records match current filters.</div>
          )}
        </DataCard>

        <div className="space-y-6">
          <DataCard title="Urgent Actions" description="Critical shortages, delayed deliveries, blocked packages, stale items and sync errors.">
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {dashboard.alerts.length ? (
                dashboard.alerts.map((alert) => (
                  <article key={alert.id} className={`rounded-xl border p-3 ${alertClass(alert.severity)}`}>
                    <div className="text-xs uppercase tracking-[0.08em]">{alert.title}</div>
                    <p className="mt-1 text-sm">{alert.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alert.projectCode} / {alert.packageCode} / {alert.materialCode}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active alerts.</div>
              )}
            </div>
          </DataCard>

          <DataCard title="Business Metrics" description="Coverage, shortages, delivery reliability and readiness indicators.">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
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

      <Sheet open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-[760px]">
          {selectedRow ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selectedRow.materialCode} - {selectedRow.materialName}
                </SheetTitle>
                <SheetDescription>
                  {selectedRow.project} / {selectedRow.packageCode} / {selectedRow.warehouse}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 overflow-y-auto px-4 pb-6 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <InfoCard label="Material" value={selectedRow.detail.materialInfo} />
                  <InfoCard label="Status" value={selectedRow.statusTags.join(", ")} />
                  <InfoCard label="Stock" value={`Current ${selectedRow.currentStock} / Reserved ${selectedRow.reservedStock} / Available ${selectedRow.availableStock}`} />
                  <InfoCard label="1C Sync" value={`${selectedRow.syncStatus} (${selectedRow.externalStatus || "-"})`} />
                  <InfoCard label="External IDs" value={`${selectedRow.oneCReferenceId} / ${selectedRow.externalSyncId}`} />
                  <InfoCard label="Last Sync" value={selectedRow.lastSyncTime || "-"} />
                </div>

                <SubTable
                  title="Transaction History"
                  headers={["Date", "Type", "Qty", "Warehouse", "Project", "Package"]}
                  rows={selectedRow.detail.transactionHistory.map((item) => [
                    item.date,
                    item.type,
                    String(item.quantity),
                    item.warehouse,
                    item.project,
                    item.packageCode,
                  ])}
                />

                <SubTable
                  title="Stock by Warehouse"
                  headers={["Warehouse", "Current", "Reserved", "Available"]}
                  rows={selectedRow.detail.stockByWarehouse.map((item) => [
                    item.warehouse,
                    String(item.current),
                    String(item.reserved),
                    String(item.available),
                  ])}
                />

                <SubTable
                  title="Linked Projects / Packages"
                  headers={["Project", "Package", "Required", "Issued", "Status"]}
                  rows={selectedRow.detail.linkedPackages.map((item) => [
                    item.project,
                    item.packageCode,
                    String(item.requiredQuantity),
                    String(item.issuedQuantity),
                    item.status,
                  ])}
                />

                <SubTable
                  title="Reservations"
                  headers={["Reservation", "Reserved", "Required", "Needed By", "Status"]}
                  rows={selectedRow.detail.reservations.map((item) => [
                    item.id,
                    String(item.reservedQuantity),
                    String(item.requiredQuantity),
                    item.neededBy,
                    item.status,
                  ])}
                />

                <SubTable
                  title="Expected Deliveries"
                  headers={["Delivery", "Supplier", "Ordered", "Received", "Expected", "Status"]}
                  rows={selectedRow.detail.deliveries.map((item) => [
                    item.id,
                    item.supplier,
                    String(item.orderedQuantity),
                    String(item.receivedQuantity),
                    item.expectedDate || "-",
                    item.status,
                  ])}
                />

                <div className="rounded-xl border p-3">
                  <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Notes</div>
                  <p className="mt-1 text-sm">{selectedRow.detail.notes}</p>
                  {selectedRow.syncErrorMessage ? (
                    <p className="mt-2 text-xs text-red-400">Sync Error: {selectedRow.syncErrorMessage}</p>
                  ) : null}
                </div>
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

function SubTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border">
      <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-muted/30">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="border-t">
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  setDirection(key === "materialCode" || key === "category" || key === "warehouse" || key === "project" || key === "status" ? "asc" : "desc");
}

function compare(left: WarehouseOperationalRow, right: WarehouseOperationalRow, key: SortKey): number {
  const leftValue = left[key];
  const rightValue = right[key];

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }

  if (key === "expectedDeliveryDate" || key === "lastTransactionDate") {
    return new Date(leftValue || "1970-01-01").getTime() - new Date(rightValue || "1970-01-01").getTime();
  }

  return String(leftValue || "").localeCompare(String(rightValue || ""));
}

function statusBadgeClass(status: WarehouseStatus): string {
  if (status === "Shortage" || status === "Out of Stock" || status === "Delayed Delivery" || status === "Blocked") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (status === "Low Stock" || status === "Pending Delivery") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (status === "In Stock" || status === "Excess" || status === "Closed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  return "border-sky-500/30 bg-sky-500/10 text-sky-300";
}

function secondaryBadgeClass(status: WarehouseStatus): string {
  if (status === "Issued to Site") return "border-sky-500/25 bg-sky-500/10 text-sky-300";
  if (status === "Reserved") return "border-indigo-500/25 bg-indigo-500/10 text-indigo-300";
  return "border-muted-foreground/20 bg-muted/20 text-muted-foreground";
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

function exportCsv(rows: WarehouseOperationalRow[]) {
  const headers = [
    "MaterialCode",
    "MaterialName",
    "Category",
    "Subcategory",
    "Warehouse",
    "Unit",
    "CurrentStock",
    "ReservedStock",
    "AvailableStock",
    "IncomingQuantity",
    "OutgoingQuantity",
    "IssuedToSiteQuantity",
    "PendingDeliveryQuantity",
    "ShortageQuantity",
    "ExcessQuantity",
    "ReorderStatus",
    "ExpectedDeliveryDate",
    "Supplier",
    "Project",
    "Package",
    "ResponsiblePerson",
    "LastTransactionDate",
    "LastSyncTime",
    "Status",
    "OneCReferenceId",
    "ExternalSyncId",
    "ExternalStatus",
    "SyncStatus",
    "SourceSystem",
    "SyncErrorMessage",
    "Notes",
  ];

  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const values = [
      row.materialCode,
      row.materialName,
      row.category,
      row.subcategory,
      row.warehouse,
      row.unit,
      row.currentStock,
      row.reservedStock,
      row.availableStock,
      row.incomingQuantity,
      row.outgoingQuantity,
      row.issuedToSiteQuantity,
      row.pendingDeliveryQuantity,
      row.shortageQuantity,
      row.excessQuantity,
      row.reorderStatus,
      row.expectedDeliveryDate,
      row.supplier,
      row.project,
      row.packageCode,
      row.responsiblePerson,
      row.lastTransactionDate,
      row.lastSyncTime,
      row.statusTags.join(" | "),
      row.oneCReferenceId,
      row.externalSyncId,
      row.externalStatus,
      row.syncStatus,
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
  link.download = "warehouse-follow-up.csv";
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
