export type CableRunStatus = "Critical" | "Warning" | "Pass" | "Missing Input";
export type AlertSeverity = "critical" | "warning" | "info";
export type Severity = "critical" | "warning" | "ok" | "neutral";

export interface CableFilters {
  project: string;
  packageCode: string;
  status: string;
  criticalOnly: boolean;
  search: string;
}

export interface CableRunRow {
  id: string;
  project: string;
  packageCode: string;
  feederTag: string;
  from: string;
  to: string;
  lengthM: number;
  loadKw: number;
  voltageV: number;
  phaseCount: 1 | 3;
  powerFactor: number;
  demandFactor: number;
  conductorMaterial: "Cu" | "Al";
  crossSectionMm2: number;
  parallelRuns: number;
  installationMethod: string;
  ambientTempC: number;
  groupingFactor: number;
  maxVoltageDropPercent: number;
  designCurrentA: number;
  effectiveAmpacityA: number;
  utilizationPercent: number;
  voltageDropPercent: number;
  breaker: string;
  status: CableRunStatus;
  responsible: string;
  lastUpdate: string;
  oneCReferenceId: string;
  externalSyncId: string;
  syncStatus: string;
  sourceSystem: string;
  lastSyncTime: string;
  syncErrorMessage: string;
  notes: string;
}

interface RawCableRun {
  id: string;
  project: string;
  packageCode: string;
  feederTag: string;
  from: string;
  to: string;
  lengthM: number;
  loadKw: number;
  voltageV: number;
  phaseCount: 1 | 3;
  powerFactor: number;
  demandFactor: number;
  conductorMaterial: "Cu" | "Al";
  crossSectionMm2: number;
  parallelRuns: number;
  installationMethod: string;
  ambientTempC: number;
  groupingFactor: number;
  maxVoltageDropPercent: number;
  breaker: string;
  responsible: string;
  lastUpdate: string;
  oneCReferenceId: string;
  externalSyncId: string;
  syncStatus: string;
  sourceSystem: string;
  lastSyncTime: string;
  syncErrorMessage: string;
  notes: string;
}

export interface CableDashboard {
  rows: CableRunRow[];
  kpis: Array<{ key: string; title: string; value: string; description: string; severity: Severity }>;
  alerts: Array<{ id: string; severity: AlertSeverity; title: string; detail: string; run: string; project: string }>;
  charts: {
    statusSplit: Array<{ name: string; value: number }>;
    utilizationByProject: Array<{ name: string; value: number }>;
    topVoltageDrop: Array<{ name: string; value: number }>;
    loadByPackage: Array<{ name: string; value: number }>;
  };
  filterOptions: {
    projects: string[];
    packages: string[];
    statuses: CableRunStatus[];
  };
}

const AMPACITY_BASE: Record<string, number> = {
  "Cu-35": 126,
  "Cu-70": 196,
  "Cu-120": 260,
  "Cu-240": 415,
  "Al-120": 215,
  "Al-240": 335,
  "Al-300": 380,
};

const RESISTANCE: Record<string, number> = {
  "Cu-35": 0.524,
  "Cu-70": 0.268,
  "Cu-120": 0.161,
  "Cu-240": 0.080,
  "Al-120": 0.253,
  "Al-240": 0.125,
  "Al-300": 0.100,
};

const RAW_RUNS: RawCableRun[] = [
  {
    id: "CBL-001",
    project: "A27 Transit Hub",
    packageCode: "ELE-07",
    feederTag: "FDR-MSB-01",
    from: "MSB-01",
    to: "SWGR-A",
    lengthM: 165,
    loadKw: 580,
    voltageV: 400,
    phaseCount: 3,
    powerFactor: 0.92,
    demandFactor: 0.86,
    conductorMaterial: "Cu",
    crossSectionMm2: 240,
    parallelRuns: 2,
    installationMethod: "Tray",
    ambientTempC: 38,
    groupingFactor: 0.82,
    maxVoltageDropPercent: 3,
    breaker: "1250A ACB",
    responsible: "B. Aksoy",
    lastUpdate: "2026-02-27",
    oneCReferenceId: "1C-CBL-001",
    externalSyncId: "CBLSYNC-5001",
    syncStatus: "Synced",
    sourceSystem: "LUNE Calc",
    lastSyncTime: "2026-02-28 08:22",
    syncErrorMessage: "",
    notes: "Main feeder for switchgear room.",
  },
  {
    id: "CBL-002",
    project: "A27 Transit Hub",
    packageCode: "ELE-03",
    feederTag: "FDR-LPN-12",
    from: "LCP-12",
    to: "Lighting Zone C",
    lengthM: 245,
    loadKw: 64,
    voltageV: 400,
    phaseCount: 3,
    powerFactor: 0.9,
    demandFactor: 0.75,
    conductorMaterial: "Cu",
    crossSectionMm2: 35,
    parallelRuns: 1,
    installationMethod: "Conduit",
    ambientTempC: 40,
    groupingFactor: 0.78,
    maxVoltageDropPercent: 3,
    breaker: "160A MCCB",
    responsible: "B. Aksoy",
    lastUpdate: "2026-02-26",
    oneCReferenceId: "1C-CBL-002",
    externalSyncId: "CBLSYNC-5002",
    syncStatus: "Synced",
    sourceSystem: "LUNE Calc",
    lastSyncTime: "2026-02-28 08:22",
    syncErrorMessage: "",
    notes: "Long route through technical corridor.",
  },
  {
    id: "CBL-003",
    project: "A29 Logistics Center",
    packageCode: "MEP-10",
    feederTag: "FDR-CHL-03",
    from: "MCC-CHL",
    to: "Chiller No.3",
    lengthM: 95,
    loadKw: 220,
    voltageV: 400,
    phaseCount: 3,
    powerFactor: 0.88,
    demandFactor: 0.95,
    conductorMaterial: "Al",
    crossSectionMm2: 240,
    parallelRuns: 1,
    installationMethod: "Tray",
    ambientTempC: 35,
    groupingFactor: 0.85,
    maxVoltageDropPercent: 3,
    breaker: "630A MCCB",
    responsible: "E. Koc",
    lastUpdate: "2026-02-27",
    oneCReferenceId: "1C-CBL-003",
    externalSyncId: "CBLSYNC-5003",
    syncStatus: "Synced",
    sourceSystem: "LUNE Calc",
    lastSyncTime: "2026-02-28 08:23",
    syncErrorMessage: "",
    notes: "Optimized for low weight.",
  },
  {
    id: "CBL-004",
    project: "A30 Energy Plant",
    packageCode: "ELE-01",
    feederTag: "FDR-MV-01",
    from: "RMU-01",
    to: "Transformer T1",
    lengthM: 310,
    loadKw: 890,
    voltageV: 400,
    phaseCount: 3,
    powerFactor: 0.93,
    demandFactor: 0.9,
    conductorMaterial: "Al",
    crossSectionMm2: 300,
    parallelRuns: 1,
    installationMethod: "Underground",
    ambientTempC: 43,
    groupingFactor: 0.74,
    maxVoltageDropPercent: 3,
    breaker: "1600A ACB",
    responsible: "N. Cinar",
    lastUpdate: "2026-02-25",
    oneCReferenceId: "1C-CBL-004",
    externalSyncId: "CBLSYNC-5004",
    syncStatus: "Pending",
    sourceSystem: "LUNE Calc",
    lastSyncTime: "2026-02-28 08:23",
    syncErrorMessage: "",
    notes: "Upgrade proposal pending for voltage drop margin.",
  },
  {
    id: "CBL-005",
    project: "A30 Energy Plant",
    packageCode: "CIV-03",
    feederTag: "FDR-PMP-02",
    from: "MCC-PUMP",
    to: "Pump House",
    lengthM: 180,
    loadKw: 145,
    voltageV: 400,
    phaseCount: 3,
    powerFactor: 0.87,
    demandFactor: 0.9,
    conductorMaterial: "Cu",
    crossSectionMm2: 70,
    parallelRuns: 1,
    installationMethod: "Tray",
    ambientTempC: 41,
    groupingFactor: 0.8,
    maxVoltageDropPercent: 3,
    breaker: "400A MCCB",
    responsible: "N. Cinar",
    lastUpdate: "2026-02-26",
    oneCReferenceId: "1C-CBL-005",
    externalSyncId: "CBLSYNC-5005",
    syncStatus: "Error",
    sourceSystem: "LUNE Calc",
    lastSyncTime: "2026-02-28 08:23",
    syncErrorMessage: "Conductor code not mapped to 1C catalog.",
    notes: "Sync failed while mapping catalog ID.",
  },
];

const EMPTY_FILTERS: CableFilters = {
  project: "",
  packageCode: "",
  status: "",
  criticalOnly: false,
  search: "",
};

export function createDefaultCableFilters(): CableFilters {
  return { ...EMPTY_FILTERS };
}

export function buildCableDashboard(filters: CableFilters): CableDashboard {
  const allRows = RAW_RUNS.map((row) => deriveRow(row));
  const rows = applyFilters(allRows, filters);
  return {
    rows,
    kpis: buildKpis(rows),
    alerts: buildAlerts(rows),
    charts: buildCharts(rows),
    filterOptions: {
      projects: distinct(allRows.map((row) => row.project)),
      packages: distinct(allRows.map((row) => row.packageCode)),
      statuses: ["Critical", "Warning", "Pass", "Missing Input"],
    },
  };
}

function deriveRow(raw: RawCableRun): CableRunRow {
  const key = `${raw.conductorMaterial}-${raw.crossSectionMm2}`;
  const baseAmpacity = AMPACITY_BASE[key] ?? 0;
  const resistance = RESISTANCE[key] ?? 0;
  const tempFactor = raw.ambientTempC > 40 ? 0.9 : raw.ambientTempC > 35 ? 0.94 : 1;

  const designCurrentA = calculateCurrent(raw.loadKw, raw.voltageV, raw.powerFactor, raw.phaseCount, raw.demandFactor);
  const effectiveAmpacityA = baseAmpacity * raw.groupingFactor * tempFactor * raw.parallelRuns;
  const utilizationPercent = effectiveAmpacityA > 0 ? (designCurrentA / effectiveAmpacityA) * 100 : 0;
  const voltageDropPercent = calculateVoltageDrop(designCurrentA, raw.lengthM, resistance, raw.phaseCount, raw.voltageV);

  const status: CableRunStatus =
    !baseAmpacity || !resistance
      ? "Missing Input"
      : utilizationPercent > 100 || voltageDropPercent > raw.maxVoltageDropPercent + 0.4
      ? "Critical"
      : utilizationPercent > 90 || voltageDropPercent > raw.maxVoltageDropPercent
      ? "Warning"
      : "Pass";

  return {
    ...raw,
    designCurrentA: round(designCurrentA),
    effectiveAmpacityA: round(effectiveAmpacityA),
    utilizationPercent: round(utilizationPercent),
    voltageDropPercent: round(voltageDropPercent),
    status,
  };
}

function applyFilters(rows: CableRunRow[], filters: CableFilters): CableRunRow[] {
  const search = filters.search.trim().toLowerCase();
  return rows
    .filter((row) => !filters.project || row.project === filters.project)
    .filter((row) => !filters.packageCode || row.packageCode === filters.packageCode)
    .filter((row) => !filters.status || row.status === filters.status)
    .filter((row) => !filters.criticalOnly || row.status === "Critical")
    .filter((row) => !search || `${row.feederTag} ${row.project} ${row.packageCode} ${row.from} ${row.to}`.toLowerCase().includes(search));
}

function buildKpis(rows: CableRunRow[]) {
  const avgUtil = rows.length ? rows.reduce((sum, row) => sum + row.utilizationPercent, 0) / rows.length : 0;
  const avgVd = rows.length ? rows.reduce((sum, row) => sum + row.voltageDropPercent, 0) / rows.length : 0;
  return [
    kpi("total", "Total Runs", String(rows.length), "Cable runs in current filter scope.", "neutral"),
    kpi("critical", "Critical Runs", String(rows.filter((row) => row.status === "Critical").length), "Exceeded ampacity or voltage drop thresholds.", rows.some((row) => row.status === "Critical") ? "critical" : "ok"),
    kpi("warning", "Warning Runs", String(rows.filter((row) => row.status === "Warning").length), "Near-limit runs requiring verification.", rows.some((row) => row.status === "Warning") ? "warning" : "ok"),
    kpi("util", "Average Utilization", `${avgUtil.toFixed(1)}%`, "Design current / effective ampacity.", avgUtil > 85 ? "warning" : "ok"),
    kpi("vd", "Average Voltage Drop", `${avgVd.toFixed(2)}%`, "Estimated running voltage drop.", avgVd > 2.5 ? "warning" : "ok"),
    kpi("sync", "Sync Errors", String(rows.filter((row) => row.syncStatus === "Error").length), "Calculation sync issues with external systems.", rows.some((row) => row.syncStatus === "Error") ? "critical" : "ok"),
  ];
}

function buildAlerts(rows: CableRunRow[]) {
  return rows
    .flatMap((row) => {
      const alerts: CableDashboard["alerts"] = [];
      if (row.status === "Critical") {
        alerts.push({
          id: `${row.id}-critical`,
          severity: "critical",
          title: "Critical Cable Run",
          detail: `${row.feederTag} utilization ${row.utilizationPercent.toFixed(1)}%, voltage drop ${row.voltageDropPercent.toFixed(2)}%.`,
          run: row.feederTag,
          project: row.project,
        });
      }
      if (row.status === "Warning") {
        alerts.push({
          id: `${row.id}-warning`,
          severity: "warning",
          title: "Near Limit",
          detail: `${row.feederTag} approaching design margins.`,
          run: row.feederTag,
          project: row.project,
        });
      }
      if (row.syncStatus === "Error") {
        alerts.push({
          id: `${row.id}-sync`,
          severity: "critical",
          title: "Sync Error",
          detail: row.syncErrorMessage || `${row.feederTag} sync failed.`,
          run: row.feederTag,
          project: row.project,
        });
      }
      return alerts;
    })
    .slice(0, 20);
}

function buildCharts(rows: CableRunRow[]) {
  return {
    statusSplit: summarize(rows, (row) => row.status, () => 1),
    utilizationByProject: summarize(rows, (row) => row.project, (row) => row.utilizationPercent),
    topVoltageDrop: [...rows].sort((a, b) => b.voltageDropPercent - a.voltageDropPercent).slice(0, 6).map((row) => ({ name: row.feederTag, value: row.voltageDropPercent })),
    loadByPackage: summarize(rows, (row) => `${row.project}-${row.packageCode}`, (row) => row.loadKw),
  };
}

function summarize(rows: CableRunRow[], keyFn: (row: CableRunRow) => string, valueFn: (row: CableRunRow) => number) {
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

function calculateCurrent(loadKw: number, voltageV: number, pf: number, phaseCount: 1 | 3, demandFactor: number): number {
  if (!voltageV || !pf) return 0;
  const loadW = loadKw * 1000 * demandFactor;
  if (phaseCount === 3) return loadW / (Math.sqrt(3) * voltageV * pf);
  return loadW / (voltageV * pf);
}

function calculateVoltageDrop(currentA: number, lengthM: number, resistanceOhmPerKm: number, phaseCount: 1 | 3, voltageV: number): number {
  if (!voltageV || !resistanceOhmPerKm) return 0;
  const lengthKm = lengthM / 1000;
  const dropV = phaseCount === 3 ? Math.sqrt(3) * currentA * resistanceOhmPerKm * lengthKm : 2 * currentA * resistanceOhmPerKm * lengthKm;
  return (dropV / voltageV) * 100;
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
