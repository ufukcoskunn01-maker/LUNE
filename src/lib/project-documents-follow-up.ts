import { diffCalendarDays, parseIsoDate } from "@/lib/date-risk";

export type DocumentWorkflowStatus = "Draft" | "Submitted" | "In Review" | "Approved" | "Rejected";

export type ProjectDocumentStatus =
  | "Blocked"
  | "Overdue"
  | "Missing Info"
  | "Rejected"
  | "In Review"
  | "Submitted"
  | "Issued for Construction"
  | "Approved"
  | "Draft";

export type Severity = "critical" | "warning" | "ok" | "neutral";
export type AlertSeverity = "critical" | "warning" | "info";

export interface ProjectDocumentFilters {
  project: string;
  packageCode: string;
  discipline: string;
  status: string;
  criticalOnly: boolean;
  overdueOnly: boolean;
  blockedOnly: boolean;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export interface ProjectDocumentRow {
  id: string;
  documentCode: string;
  title: string;
  type: string;
  discipline: string;
  project: string;
  packageCode: string;
  revision: number;
  workflowStatus: DocumentWorkflowStatus;
  status: ProjectDocumentStatus;
  statusTags: ProjectDocumentStatus[];
  requiredDate: string;
  reviewDueDate: string;
  approvedDate: string;
  issuedForConstructionDate: string;
  supplier: string;
  responsible: string;
  linkedMaterialCode: string;
  blockedByMaterial: boolean;
  overdue: boolean;
  missingInfo: boolean;
  critical: boolean;
  packageReadiness: number;
  lastUpdate: string;
  notes: string;
  oneCReferenceId: string;
  externalSyncId: string;
  syncStatus: string;
  externalStatus: string;
  lastSyncTime: string;
  sourceSystem: string;
  syncErrorMessage: string;
}

export interface ProjectDocumentsDashboard {
  rows: ProjectDocumentRow[];
  kpis: Array<{ key: string; title: string; value: string; description: string; severity: Severity }>;
  metrics: Array<{ label: string; value: string }>;
  alerts: Array<{ id: string; severity: AlertSeverity; title: string; detail: string; documentCode: string; projectCode: string; packageCode: string }>;
  charts: {
    statusDistribution: Array<{ name: string; value: number }>;
    overdueByProject: Array<{ name: string; value: number }>;
    documentsByDiscipline: Array<{ name: string; value: number }>;
    approvalsTrend: Array<{ period: string; submitted: number; approved: number }>;
  };
  filterOptions: {
    projects: string[];
    packages: string[];
    disciplines: string[];
    statuses: ProjectDocumentStatus[];
  };
}

interface RawDoc {
  id: string;
  documentCode: string;
  title: string;
  type: string;
  discipline: string;
  project: string;
  packageCode: string;
  revision: number;
  workflowStatus: DocumentWorkflowStatus;
  requiredDate: string;
  reviewDueDate: string;
  approvedDate: string;
  issuedForConstructionDate: string;
  supplier: string;
  responsible: string;
  linkedMaterialCode: string;
  blockedByMaterial: boolean;
  packageReadiness: number;
  lastUpdate: string;
  notes: string;
  oneCReferenceId: string;
  externalSyncId: string;
  syncStatus: string;
  externalStatus: string;
  lastSyncTime: string;
  sourceSystem: string;
  syncErrorMessage: string;
}

const RAW_DOCS: RawDoc[] = [
  {
    id: "DOC-001",
    documentCode: "A27-CIV-DRG-101",
    title: "Pile Cap Reinforcement Layout",
    type: "Drawing",
    discipline: "Civil",
    project: "A27 Transit Hub",
    packageCode: "CIV-01",
    revision: 4,
    workflowStatus: "In Review",
    requiredDate: "2026-02-27",
    reviewDueDate: "2026-02-25",
    approvedDate: "",
    issuedForConstructionDate: "",
    supplier: "Aksa Steel",
    responsible: "O. Yildirim",
    linkedMaterialCode: "REB-T16",
    blockedByMaterial: true,
    packageReadiness: 56,
    lastUpdate: "2026-02-26",
    notes: "Waiting for vendor mill certificate.",
    oneCReferenceId: "1C-DOC-001",
    externalSyncId: "DOCSYNC-7001",
    syncStatus: "Synced",
    externalStatus: "InReview",
    lastSyncTime: "2026-02-28 08:12",
    sourceSystem: "Pilot-BIM",
    syncErrorMessage: "",
  },
  {
    id: "DOC-002",
    documentCode: "A27-MEP-SUB-220",
    title: "HV Cable Technical Submittal",
    type: "Submittal",
    discipline: "Electrical",
    project: "A27 Transit Hub",
    packageCode: "MEP-04",
    revision: 3,
    workflowStatus: "Submitted",
    requiredDate: "2026-03-01",
    reviewDueDate: "2026-02-29",
    approvedDate: "",
    issuedForConstructionDate: "",
    supplier: "Voltis Energy",
    responsible: "B. Aksoy",
    linkedMaterialCode: "HV-CBL-240",
    blockedByMaterial: true,
    packageReadiness: 42,
    lastUpdate: "2026-02-27",
    notes: "Cable drum test certificates pending.",
    oneCReferenceId: "1C-DOC-002",
    externalSyncId: "DOCSYNC-7002",
    syncStatus: "Synced",
    externalStatus: "Submitted",
    lastSyncTime: "2026-02-28 08:12",
    sourceSystem: "Pilot-BIM",
    syncErrorMessage: "",
  },
  {
    id: "DOC-003",
    documentCode: "A27-MEP-DRG-442",
    title: "Switchgear Room Single Line Diagram",
    type: "Drawing",
    discipline: "Electrical",
    project: "A27 Transit Hub",
    packageCode: "ELE-07",
    revision: 5,
    workflowStatus: "Rejected",
    requiredDate: "2026-02-23",
    reviewDueDate: "2026-02-21",
    approvedDate: "",
    issuedForConstructionDate: "",
    supplier: "Gridline Systems",
    responsible: "B. Aksoy",
    linkedMaterialCode: "SWG-400A",
    blockedByMaterial: true,
    packageReadiness: 33,
    lastUpdate: "2026-02-25",
    notes: "Returned for revision due to earthing mismatch.",
    oneCReferenceId: "1C-DOC-004",
    externalSyncId: "DOCSYNC-7004",
    syncStatus: "Error",
    externalStatus: "RevisionRequired",
    lastSyncTime: "2026-02-28 08:13",
    sourceSystem: "Pilot-BIM",
    syncErrorMessage: "Revision payload rejected by external API.",
  },
  {
    id: "DOC-004",
    documentCode: "A29-MEP-DRG-110",
    title: "Fire Pump Room Layout",
    type: "Drawing",
    discipline: "Mechanical",
    project: "A29 Logistics Center",
    packageCode: "MEP-02",
    revision: 2,
    workflowStatus: "Approved",
    requiredDate: "2026-02-19",
    reviewDueDate: "2026-02-16",
    approvedDate: "2026-02-14",
    issuedForConstructionDate: "",
    supplier: "HidroTek",
    responsible: "E. Koc",
    linkedMaterialCode: "FP-SET-50HZ",
    blockedByMaterial: false,
    packageReadiness: 74,
    lastUpdate: "2026-02-15",
    notes: "Approved, awaiting authority stamp.",
    oneCReferenceId: "1C-DOC-006",
    externalSyncId: "DOCSYNC-7006",
    syncStatus: "Synced",
    externalStatus: "Approved",
    lastSyncTime: "2026-02-28 08:14",
    sourceSystem: "Pilot-BIM",
    syncErrorMessage: "",
  },
  {
    id: "DOC-005",
    documentCode: "A29-MEP-SUB-118",
    title: "Chiller Unit Product Data",
    type: "Submittal",
    discipline: "Mechanical",
    project: "A29 Logistics Center",
    packageCode: "MEP-10",
    revision: 2,
    workflowStatus: "Approved",
    requiredDate: "2026-02-28",
    reviewDueDate: "2026-02-23",
    approvedDate: "2026-02-22",
    issuedForConstructionDate: "2026-02-23",
    supplier: "Thermoline",
    responsible: "E. Koc",
    linkedMaterialCode: "CHL-500TR",
    blockedByMaterial: false,
    packageReadiness: 92,
    lastUpdate: "2026-02-23",
    notes: "Approved and released.",
    oneCReferenceId: "1C-DOC-011",
    externalSyncId: "DOCSYNC-7011",
    syncStatus: "Synced",
    externalStatus: "Approved",
    lastSyncTime: "2026-02-28 08:17",
    sourceSystem: "Pilot-BIM",
    syncErrorMessage: "",
  },
  {
    id: "DOC-006",
    documentCode: "A30-MEC-RFI-012",
    title: "Pump Skid Baseplate Elevation RFI",
    type: "RFI",
    discipline: "Mechanical",
    project: "A30 Energy Plant",
    packageCode: "MEC-05",
    revision: 1,
    workflowStatus: "In Review",
    requiredDate: "2026-02-24",
    reviewDueDate: "2026-02-20",
    approvedDate: "",
    issuedForConstructionDate: "",
    supplier: "",
    responsible: "E. Koc",
    linkedMaterialCode: "PMP-BASE-01",
    blockedByMaterial: true,
    packageReadiness: 29,
    lastUpdate: "2026-02-18",
    notes: "No reviewer assigned.",
    oneCReferenceId: "1C-DOC-010",
    externalSyncId: "DOCSYNC-7010",
    syncStatus: "Error",
    externalStatus: "InReview",
    lastSyncTime: "2026-02-28 08:16",
    sourceSystem: "Pilot-BIM",
    syncErrorMessage: "Reviewer mapping mismatch during sync.",
  },
];

const ALL_STATUSES: ProjectDocumentStatus[] = [
  "Blocked",
  "Overdue",
  "Missing Info",
  "Rejected",
  "In Review",
  "Submitted",
  "Issued for Construction",
  "Approved",
  "Draft",
];

const EMPTY_FILTERS: ProjectDocumentFilters = {
  project: "",
  packageCode: "",
  discipline: "",
  status: "",
  criticalOnly: false,
  overdueOnly: false,
  blockedOnly: false,
  dateFrom: "",
  dateTo: "",
  search: "",
};

export function createDefaultProjectDocumentFilters(): ProjectDocumentFilters {
  return { ...EMPTY_FILTERS };
}

export function buildProjectDocumentsDashboard(filters: ProjectDocumentFilters, now = new Date()): ProjectDocumentsDashboard {
  const allRows = RAW_DOCS.map((raw) => deriveRow(raw, now));
  const rows = applyFilters(allRows, filters);
  return {
    rows,
    kpis: buildKpis(rows),
    metrics: buildMetrics(rows),
    alerts: buildAlerts(rows, now),
    charts: buildCharts(rows),
    filterOptions: {
      projects: distinct(allRows.map((row) => row.project)),
      packages: distinct(allRows.map((row) => row.packageCode)),
      disciplines: distinct(allRows.map((row) => row.discipline)),
      statuses: ALL_STATUSES,
    },
  };
}

function deriveRow(raw: RawDoc, now: Date): ProjectDocumentRow {
  const reviewDue = parseDate(raw.reviewDueDate);
  const approved = parseDate(raw.approvedDate);
  const overdue = Boolean(reviewDue && !approved && reviewDue.getTime() < now.getTime());
  const missingInfo = !raw.supplier || !raw.reviewDueDate;

  const statusTags: ProjectDocumentStatus[] = [];
  if (raw.blockedByMaterial) statusTags.push("Blocked");
  if (overdue) statusTags.push("Overdue");
  if (missingInfo) statusTags.push("Missing Info");

  if (raw.workflowStatus === "Rejected") statusTags.push("Rejected");
  if (raw.workflowStatus === "In Review") statusTags.push("In Review");
  if (raw.workflowStatus === "Submitted") statusTags.push("Submitted");
  if (raw.workflowStatus === "Draft") statusTags.push("Draft");
  if (raw.workflowStatus === "Approved") statusTags.push(raw.issuedForConstructionDate ? "Issued for Construction" : "Approved");

  const status = statusTags[0] ?? "Draft";
  return {
    ...raw,
    status,
    statusTags,
    overdue,
    missingInfo,
    critical: overdue || raw.blockedByMaterial || missingInfo || raw.workflowStatus === "Rejected",
  };
}

function applyFilters(rows: ProjectDocumentRow[], filters: ProjectDocumentFilters): ProjectDocumentRow[] {
  const search = filters.search.trim().toLowerCase();
  const from = parseDate(filters.dateFrom);
  const to = parseDate(filters.dateTo);
  return rows
    .filter((row) => !filters.project || row.project === filters.project)
    .filter((row) => !filters.packageCode || row.packageCode === filters.packageCode)
    .filter((row) => !filters.discipline || row.discipline === filters.discipline)
    .filter((row) => !filters.status || row.statusTags.includes(filters.status as ProjectDocumentStatus))
    .filter((row) => !filters.criticalOnly || row.critical)
    .filter((row) => !filters.overdueOnly || row.overdue)
    .filter((row) => !filters.blockedOnly || row.blockedByMaterial)
    .filter((row) => {
      if (!from && !to) return true;
      const date = parseDate(row.reviewDueDate) ?? parseDate(row.requiredDate);
      if (!date) return false;
      if (from && date.getTime() < from.getTime()) return false;
      if (to && date.getTime() > to.getTime()) return false;
      return true;
    })
    .filter((row) => {
      if (!search) return true;
      return `${row.documentCode} ${row.title} ${row.project} ${row.packageCode} ${row.linkedMaterialCode}`.toLowerCase().includes(search);
    });
}

function buildKpis(rows: ProjectDocumentRow[]) {
  const total = rows.length;
  const pending = rows.filter((row) => row.workflowStatus === "Submitted" || row.workflowStatus === "In Review").length;
  const overdue = rows.filter((row) => row.overdue).length;
  const blocked = distinct(rows.filter((row) => row.blockedByMaterial).map((row) => `${row.project}-${row.packageCode}`)).length;
  const syncErrors = rows.filter((row) => row.syncStatus === "Error").length;
  return [
    kpi("total", "Total Documents", String(total), "Controlled records in active scope.", "neutral"),
    kpi("pending", "Pending Review", String(pending), "Submitted or in review.", pending > 2 ? "warning" : "ok"),
    kpi("overdue", "Overdue Reviews", String(overdue), "Past due review dates.", overdue > 0 ? "critical" : "ok"),
    kpi("blocked", "Blocked Packages", String(blocked), "Material-linked document blockers.", blocked > 0 ? "warning" : "ok"),
    kpi("ifc", "Issued for Construction", String(rows.filter((row) => row.statusTags.includes("Issued for Construction")).length), "Approved docs released to site.", "ok"),
    kpi("sync", "Sync Errors", String(syncErrors), "Pilot-BIM/1C sync exceptions.", syncErrors > 0 ? "critical" : "ok"),
  ];
}

function buildMetrics(rows: ProjectDocumentRow[]) {
  const approved = rows.filter((row) => row.approvedDate && row.reviewDueDate);
  const onTime = approved.filter((row) => {
    const a = parseDate(row.approvedDate);
    const d = parseDate(row.reviewDueDate);
    return Boolean(a && d && a.getTime() <= d.getTime());
  }).length;
  const avgReadiness = rows.length ? rows.reduce((sum, row) => sum + row.packageReadiness, 0) / rows.length : 0;
  return [
    { label: "On-Time Delivery Rate", value: `${approved.length ? ((onTime / approved.length) * 100).toFixed(1) : "0.0"}%` },
    { label: "Critical Documents", value: String(rows.filter((row) => row.critical).length) },
    { label: "Missing Metadata", value: String(rows.filter((row) => row.missingInfo).length) },
    { label: "Average Package Readiness", value: `${avgReadiness.toFixed(1)}%` },
  ];
}

function buildAlerts(rows: ProjectDocumentRow[], now: Date) {
  const alerts: ProjectDocumentsDashboard["alerts"] = [];
  rows.forEach((row) => {
    if (row.overdue) {
      alerts.push({
        id: `${row.id}-overdue`,
        severity: "critical",
        title: "Overdue Review",
        detail: `${row.documentCode} review due ${row.reviewDueDate}.`,
        documentCode: row.documentCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    }
    if (row.blockedByMaterial) {
      alerts.push({
        id: `${row.id}-blocked`,
        severity: "critical",
        title: "Blocked By Material",
        detail: `${row.documentCode} tied to shortage on ${row.linkedMaterialCode}.`,
        documentCode: row.documentCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    }
    if (row.missingInfo) {
      alerts.push({
        id: `${row.id}-missing`,
        severity: "warning",
        title: "Missing Supplier/Date",
        detail: `${row.documentCode} has incomplete metadata.`,
        documentCode: row.documentCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    }
    const update = parseDate(row.lastUpdate);
    if (update && diffCalendarDays(now, update) > 10) {
      alerts.push({
        id: `${row.id}-stale`,
        severity: "warning",
        title: "No Recent Update",
        detail: `${row.documentCode} has stale updates.`,
        documentCode: row.documentCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    }
    if (row.syncStatus === "Error") {
      alerts.push({
        id: `${row.id}-sync`,
        severity: "critical",
        title: "Sync Error",
        detail: row.syncErrorMessage || `${row.documentCode} sync failed.`,
        documentCode: row.documentCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    }
  });
  return alerts.slice(0, 20);
}

function buildCharts(rows: ProjectDocumentRow[]) {
  return {
    statusDistribution: summarize(rows, (row) => row.status, () => 1),
    overdueByProject: summarize(rows.filter((row) => row.overdue), (row) => row.project, () => 1),
    documentsByDiscipline: summarize(rows, (row) => row.discipline, () => 1),
    approvalsTrend: [
      { period: "W-4", submitted: 1, approved: 0 },
      { period: "W-3", submitted: 1, approved: 1 },
      { period: "W-2", submitted: 2, approved: 1 },
      { period: "W-1", submitted: 1, approved: 0 },
      { period: "W0", submitted: 1, approved: 1 },
    ],
  };
}

function summarize(rows: ProjectDocumentRow[], keyFn: (row: ProjectDocumentRow) => string, valueFn: (row: ProjectDocumentRow) => number) {
  return Object.values(
    rows.reduce<Record<string, { name: string; value: number }>>((acc, row) => {
      const key = keyFn(row);
      const entry = acc[key] ?? { name: key, value: 0 };
      entry.value += valueFn(row);
      acc[key] = entry;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);
}

function parseDate(value: string): Date | null {
  return parseIsoDate(value);
}

function distinct(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function kpi(key: string, title: string, value: string, description: string, severity: Severity) {
  return { key, title, value, description, severity };
}
