export type ProjectControlsStatus = "On Track" | "Watch" | "Critical" | "Blocked" | "Completed";
export type AlertSeverity = "critical" | "warning" | "info";
export type Severity = "critical" | "warning" | "ok" | "neutral";

export interface ProjectControlsFilters {
  project: string;
  manager: string;
  status: string;
  riskLevel: string;
  criticalOnly: boolean;
  blockedOnly: boolean;
  search: string;
}

export interface ProjectControlsRow {
  id: string;
  project: string;
  packageCode: string;
  packageName: string;
  discipline: string;
  manager: string;
  baselineFinish: string;
  forecastFinish: string;
  plannedProgress: number;
  actualProgress: number;
  spi: number;
  cpi: number;
  costVarianceM: number;
  scheduleVarianceDays: number;
  materialReadiness: number;
  documentReadiness: number;
  blockedByMaterial: boolean;
  blockedByDocuments: boolean;
  shortageItems: number;
  overdueDocuments: number;
  riskScore: number;
  riskLevel: "High" | "Medium" | "Low";
  status: ProjectControlsStatus;
  statusTags: ProjectControlsStatus[];
  lastUpdate: string;
  oneCReferenceId: string;
  externalSyncId: string;
  syncStatus: string;
  sourceSystem: string;
  lastSyncTime: string;
  syncErrorMessage: string;
}

type RawControlsRow = Omit<ProjectControlsRow, "status" | "statusTags" | "riskLevel">;

export interface ProjectControlsDashboard {
  rows: ProjectControlsRow[];
  kpis: Array<{ key: string; title: string; value: string; description: string; severity: Severity }>;
  metrics: Array<{ label: string; value: string }>;
  alerts: Array<{ id: string; severity: AlertSeverity; title: string; detail: string; project: string; packageCode: string }>;
  charts: {
    performanceByProject: Array<{ name: string; spi: number; cpi: number }>;
    readinessByProject: Array<{ project: string; material: number; documents: number }>;
    blockedByReason: Array<{ name: string; value: number }>;
    riskByManager: Array<{ name: string; value: number }>;
  };
  filterOptions: {
    projects: string[];
    managers: string[];
    statuses: ProjectControlsStatus[];
    riskLevels: Array<"High" | "Medium" | "Low">;
  };
}

const RAW_ROWS: RawControlsRow[] = [
  {
    id: "PC-001",
    project: "A27 Transit Hub",
    packageCode: "CIV-01",
    packageName: "Primary Structure",
    discipline: "Civil",
    manager: "O. Yildirim",
    baselineFinish: "2026-03-10",
    forecastFinish: "2026-03-18",
    plannedProgress: 72,
    actualProgress: 61,
    spi: 0.86,
    cpi: 0.94,
    costVarianceM: -0.4,
    scheduleVarianceDays: -8,
    materialReadiness: 58,
    documentReadiness: 74,
    blockedByMaterial: true,
    blockedByDocuments: false,
    shortageItems: 4,
    overdueDocuments: 1,
    riskScore: 78,
    lastUpdate: "2026-02-27",
    oneCReferenceId: "1C-PC-001",
    externalSyncId: "CTRL-9001",
    syncStatus: "Synced",
    sourceSystem: "1C/Pilot-BIM",
    lastSyncTime: "2026-02-28 08:20",
    syncErrorMessage: "",
  },
  {
    id: "PC-002",
    project: "A27 Transit Hub",
    packageCode: "ELE-07",
    packageName: "Switchgear Installation",
    discipline: "Electrical",
    manager: "B. Aksoy",
    baselineFinish: "2026-03-04",
    forecastFinish: "2026-03-20",
    plannedProgress: 64,
    actualProgress: 39,
    spi: 0.71,
    cpi: 0.89,
    costVarianceM: -0.9,
    scheduleVarianceDays: -16,
    materialReadiness: 41,
    documentReadiness: 48,
    blockedByMaterial: true,
    blockedByDocuments: true,
    shortageItems: 6,
    overdueDocuments: 3,
    riskScore: 92,
    lastUpdate: "2026-02-26",
    oneCReferenceId: "1C-PC-002",
    externalSyncId: "CTRL-9002",
    syncStatus: "Error",
    sourceSystem: "1C/Pilot-BIM",
    lastSyncTime: "2026-02-28 08:20",
    syncErrorMessage: "Package sync conflict on document state.",
  },
  {
    id: "PC-003",
    project: "A29 Logistics Center",
    packageCode: "MEP-02",
    packageName: "Fire Pump Room",
    discipline: "Mechanical",
    manager: "E. Koc",
    baselineFinish: "2026-03-01",
    forecastFinish: "2026-03-03",
    plannedProgress: 68,
    actualProgress: 66,
    spi: 0.98,
    cpi: 1.01,
    costVarianceM: 0.1,
    scheduleVarianceDays: -2,
    materialReadiness: 79,
    documentReadiness: 81,
    blockedByMaterial: false,
    blockedByDocuments: false,
    shortageItems: 1,
    overdueDocuments: 0,
    riskScore: 41,
    lastUpdate: "2026-02-27",
    oneCReferenceId: "1C-PC-003",
    externalSyncId: "CTRL-9003",
    syncStatus: "Synced",
    sourceSystem: "1C/Pilot-BIM",
    lastSyncTime: "2026-02-28 08:20",
    syncErrorMessage: "",
  },
  {
    id: "PC-004",
    project: "A29 Logistics Center",
    packageCode: "ARC-09",
    packageName: "Facade Works",
    discipline: "Architectural",
    manager: "D. Eren",
    baselineFinish: "2026-03-15",
    forecastFinish: "2026-03-15",
    plannedProgress: 44,
    actualProgress: 45,
    spi: 1.02,
    cpi: 1.05,
    costVarianceM: 0.2,
    scheduleVarianceDays: 0,
    materialReadiness: 86,
    documentReadiness: 82,
    blockedByMaterial: false,
    blockedByDocuments: false,
    shortageItems: 0,
    overdueDocuments: 0,
    riskScore: 24,
    lastUpdate: "2026-02-28",
    oneCReferenceId: "1C-PC-004",
    externalSyncId: "CTRL-9004",
    syncStatus: "Synced",
    sourceSystem: "1C/Pilot-BIM",
    lastSyncTime: "2026-02-28 08:21",
    syncErrorMessage: "",
  },
  {
    id: "PC-005",
    project: "A30 Energy Plant",
    packageCode: "ELE-01",
    packageName: "MV Cable Route",
    discipline: "Electrical",
    manager: "N. Cinar",
    baselineFinish: "2026-03-08",
    forecastFinish: "2026-03-24",
    plannedProgress: 59,
    actualProgress: 36,
    spi: 0.63,
    cpi: 0.84,
    costVarianceM: -1.2,
    scheduleVarianceDays: -18,
    materialReadiness: 32,
    documentReadiness: 39,
    blockedByMaterial: true,
    blockedByDocuments: true,
    shortageItems: 8,
    overdueDocuments: 2,
    riskScore: 95,
    lastUpdate: "2026-02-25",
    oneCReferenceId: "1C-PC-005",
    externalSyncId: "CTRL-9005",
    syncStatus: "Pending",
    sourceSystem: "1C/Pilot-BIM",
    lastSyncTime: "2026-02-28 08:21",
    syncErrorMessage: "",
  },
];

const ALL_STATUSES: ProjectControlsStatus[] = ["Blocked", "Critical", "Watch", "On Track", "Completed"];

const EMPTY_FILTERS: ProjectControlsFilters = {
  project: "",
  manager: "",
  status: "",
  riskLevel: "",
  criticalOnly: false,
  blockedOnly: false,
  search: "",
};

export function createDefaultProjectControlsFilters(): ProjectControlsFilters {
  return { ...EMPTY_FILTERS };
}

export function buildProjectControlsDashboard(filters: ProjectControlsFilters): ProjectControlsDashboard {
  const allRows = RAW_ROWS.map((row) => deriveStatus(row));
  const rows = applyFilters(allRows, filters);
  return {
    rows,
    kpis: buildKpis(rows),
    metrics: buildMetrics(rows),
    alerts: buildAlerts(rows),
    charts: buildCharts(rows),
    filterOptions: {
      projects: distinct(allRows.map((row) => row.project)),
      managers: distinct(allRows.map((row) => row.manager)),
      statuses: ALL_STATUSES,
      riskLevels: ["High", "Medium", "Low"],
    },
  };
}

function deriveStatus(raw: RawControlsRow): ProjectControlsRow {
  const statusTags: ProjectControlsStatus[] = [];
  if (raw.actualProgress >= 100) statusTags.push("Completed");
  if (raw.blockedByMaterial || raw.blockedByDocuments) statusTags.push("Blocked");
  if (raw.spi < 0.9 || raw.cpi < 0.9 || raw.riskScore >= 80) statusTags.push("Critical");
  if (raw.spi < 0.98 || raw.cpi < 0.98 || raw.scheduleVarianceDays <= -5) statusTags.push("Watch");
  if (!statusTags.length) statusTags.push("On Track");

  const status = statusTags[0];
  const riskLevel = raw.riskScore >= 75 ? "High" : raw.riskScore >= 45 ? "Medium" : "Low";

  return {
    ...raw,
    status,
    statusTags,
    riskLevel,
  };
}

function applyFilters(rows: ProjectControlsRow[], filters: ProjectControlsFilters): ProjectControlsRow[] {
  const search = filters.search.trim().toLowerCase();
  return rows
    .filter((row) => !filters.project || row.project === filters.project)
    .filter((row) => !filters.manager || row.manager === filters.manager)
    .filter((row) => !filters.status || row.statusTags.includes(filters.status as ProjectControlsStatus))
    .filter((row) => !filters.riskLevel || row.riskLevel === filters.riskLevel)
    .filter((row) => !filters.criticalOnly || row.statusTags.includes("Critical"))
    .filter((row) => !filters.blockedOnly || row.statusTags.includes("Blocked"))
    .filter((row) => !search || `${row.project} ${row.packageCode} ${row.packageName} ${row.discipline}`.toLowerCase().includes(search));
}

function buildKpis(rows: ProjectControlsRow[]) {
  const avgSpi = rows.length ? rows.reduce((sum, row) => sum + row.spi, 0) / rows.length : 0;
  const avgCpi = rows.length ? rows.reduce((sum, row) => sum + row.cpi, 0) / rows.length : 0;
  return [
    kpi("total", "Total Packages", String(rows.length), "Integrated controls scope by package.", "neutral"),
    kpi("blocked", "Blocked Packages", String(rows.filter((row) => row.statusTags.includes("Blocked")).length), "Blocked by material/document constraints.", rows.some((row) => row.statusTags.includes("Blocked")) ? "critical" : "ok"),
    kpi("critical", "Critical Packages", String(rows.filter((row) => row.statusTags.includes("Critical")).length), "SPI/CPI/risk beyond acceptable bounds.", rows.some((row) => row.statusTags.includes("Critical")) ? "critical" : "ok"),
    kpi("spi", "Average SPI", avgSpi.toFixed(2), "Schedule performance index.", avgSpi < 0.95 ? "warning" : "ok"),
    kpi("cpi", "Average CPI", avgCpi.toFixed(2), "Cost performance index.", avgCpi < 0.95 ? "warning" : "ok"),
    kpi("risk", "High Risk Projects", String(distinct(rows.filter((row) => row.riskLevel === "High").map((row) => row.project)).length), "Projects with combined high execution risk.", rows.some((row) => row.riskLevel === "High") ? "warning" : "ok"),
  ];
}

function buildMetrics(rows: ProjectControlsRow[]) {
  const material = rows.length ? rows.reduce((sum, row) => sum + row.materialReadiness, 0) / rows.length : 0;
  const docs = rows.length ? rows.reduce((sum, row) => sum + row.documentReadiness, 0) / rows.length : 0;
  const blocked = rows.filter((row) => row.blockedByMaterial || row.blockedByDocuments).length;
  return [
    { label: "Material Readiness", value: `${material.toFixed(1)}%` },
    { label: "Document Readiness", value: `${docs.toFixed(1)}%` },
    { label: "Blocked Work Packages", value: String(blocked) },
    { label: "Total Shortage Items", value: String(rows.reduce((sum, row) => sum + row.shortageItems, 0)) },
  ];
}

function buildAlerts(rows: ProjectControlsRow[]) {
  return rows
    .flatMap((row) => {
      const output: ProjectControlsDashboard["alerts"] = [];
      if (row.statusTags.includes("Blocked")) {
        output.push({
          id: `${row.id}-blocked`,
          severity: "critical",
          title: "Package Blocked",
          detail: `${row.project}/${row.packageCode} blocked by ${row.blockedByMaterial ? "material" : "document"} readiness.`,
          project: row.project,
          packageCode: row.packageCode,
        });
      }
      if (row.statusTags.includes("Critical")) {
        output.push({
          id: `${row.id}-critical`,
          severity: "warning",
          title: "Performance Drop",
          detail: `${row.project}/${row.packageCode} SPI ${row.spi.toFixed(2)} and CPI ${row.cpi.toFixed(2)}.`,
          project: row.project,
          packageCode: row.packageCode,
        });
      }
      if (row.syncStatus === "Error") {
        output.push({
          id: `${row.id}-sync`,
          severity: "critical",
          title: "Sync Error",
          detail: row.syncErrorMessage || "Control row sync failed.",
          project: row.project,
          packageCode: row.packageCode,
        });
      }
      return output;
    })
    .slice(0, 20);
}

function buildCharts(rows: ProjectControlsRow[]) {
  return {
    performanceByProject: Object.values(
      rows.reduce<Record<string, { name: string; spi: number; cpi: number; count: number }>>((acc, row) => {
        const entry = acc[row.project] ?? { name: row.project, spi: 0, cpi: 0, count: 0 };
        entry.spi += row.spi;
        entry.cpi += row.cpi;
        entry.count += 1;
        acc[row.project] = entry;
        return acc;
      }, {})
    ).map((item) => ({ name: item.name, spi: round(item.spi / item.count), cpi: round(item.cpi / item.count) })),
    readinessByProject: Object.values(
      rows.reduce<Record<string, { project: string; material: number; documents: number; count: number }>>((acc, row) => {
        const entry = acc[row.project] ?? { project: row.project, material: 0, documents: 0, count: 0 };
        entry.material += row.materialReadiness;
        entry.documents += row.documentReadiness;
        entry.count += 1;
        acc[row.project] = entry;
        return acc;
      }, {})
    ).map((item) => ({ project: item.project, material: round(item.material / item.count), documents: round(item.documents / item.count) })),
    blockedByReason: [
      { name: "Material", value: rows.filter((row) => row.blockedByMaterial).length },
      { name: "Documents", value: rows.filter((row) => row.blockedByDocuments).length },
    ],
    riskByManager: Object.values(
      rows.reduce<Record<string, { name: string; value: number }>>((acc, row) => {
        const entry = acc[row.manager] ?? { name: row.manager, value: 0 };
        entry.value += row.riskScore;
        acc[row.manager] = entry;
        return acc;
      }, {})
    ).sort((a, b) => b.value - a.value),
  };
}

function distinct(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function kpi(key: string, title: string, value: string, description: string, severity: Severity) {
  return { key, title, value, description, severity };
}

