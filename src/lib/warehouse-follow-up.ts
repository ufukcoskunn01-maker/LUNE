export type WarehouseStatus =
  | "In Stock"
  | "Low Stock"
  | "Out of Stock"
  | "Reserved"
  | "Pending Delivery"
  | "Delayed Delivery"
  | "Shortage"
  | "Excess"
  | "Issued to Site"
  | "Blocked"
  | "Closed";

export type AlertSeverity = "critical" | "warning" | "info";

export type Severity = "critical" | "warning" | "ok" | "neutral";

export interface WarehouseFilterOptions {
  warehouses: string[];
  categories: string[];
  projects: string[];
  packages: string[];
  suppliers: string[];
  statuses: WarehouseStatus[];
}

export interface WarehouseFilters {
  warehouse: string;
  category: string;
  project: string;
  packageCode: string;
  supplier: string;
  status: string;
  criticalOnly: boolean;
  shortageOnly: boolean;
  delayedOnly: boolean;
  reservedOnly: boolean;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export interface WarehouseKpi {
  key: string;
  title: string;
  value: string;
  description: string;
  severity: Severity;
}

export interface WarehouseMetric {
  label: string;
  value: string;
}

export interface WarehouseAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  materialCode: string;
  projectCode: string;
  packageCode: string;
}

export interface WarehouseChartDatum {
  name: string;
  value: number;
}

export interface WarehouseMovementDatum {
  period: string;
  incoming: number;
  outgoing: number;
}

export interface WarehouseBalanceDatum {
  warehouse: string;
  current: number;
  reserved: number;
  available: number;
}

export interface WarehouseTransaction {
  date: string;
  type: string;
  quantity: number;
  warehouse: string;
  project: string;
  packageCode: string;
}

export interface WarehouseReservation {
  id: string;
  reservedQuantity: number;
  requiredQuantity: number;
  neededBy: string;
  status: string;
}

export interface WarehouseDelivery {
  id: string;
  supplier: string;
  orderedQuantity: number;
  receivedQuantity: number;
  expectedDate: string;
  receivedDate: string;
  status: string;
}

export interface WarehouseLinkedPackage {
  project: string;
  packageCode: string;
  requiredQuantity: number;
  issuedQuantity: number;
  status: string;
}

export interface WarehouseRowDetail {
  materialInfo: string;
  transactionHistory: WarehouseTransaction[];
  stockByWarehouse: Array<{ warehouse: string; current: number; reserved: number; available: number }>;
  linkedPackages: WarehouseLinkedPackage[];
  reservations: WarehouseReservation[];
  deliveries: WarehouseDelivery[];
  notes: string;
  oneCReferenceId: string;
  externalSyncId: string;
  externalStatus: string;
  syncStatus: string;
  lastSyncTime: string;
  sourceSystem: string;
  syncErrorMessage: string;
}

export interface WarehouseOperationalRow {
  id: string;
  materialCode: string;
  materialName: string;
  category: string;
  subcategory: string;
  warehouse: string;
  unit: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  incomingQuantity: number;
  outgoingQuantity: number;
  issuedToSiteQuantity: number;
  pendingDeliveryQuantity: number;
  requiredQuantity: number;
  shortageQuantity: number;
  excessQuantity: number;
  reorderStatus: string;
  expectedDeliveryDate: string;
  supplier: string;
  project: string;
  packageCode: string;
  responsiblePerson: string;
  lastTransactionDate: string;
  lastSyncTime: string;
  notes: string;
  status: WarehouseStatus;
  statusTags: WarehouseStatus[];
  criticalShortage: boolean;
  delayedDelivery: boolean;
  blockedPackage: boolean;
  upcomingDeliveryRisk3Days: boolean;
  upcomingDeliveryRisk7Days: boolean;
  stockValueK: number;
  oneCReferenceId: string;
  externalSyncId: string;
  externalStatus: string;
  syncStatus: string;
  sourceSystem: string;
  syncErrorMessage: string;
  detail: WarehouseRowDetail;
}

interface WarehouseBaseRow {
  id: string;
  materialCode: string;
  materialName: string;
  category: string;
  subcategory: string;
  warehouse: string;
  unit: string;
  currentStock: number;
  reservedStock: number;
  incomingQuantity: number;
  outgoingQuantity: number;
  issuedToSiteQuantity: number;
  pendingDeliveryQuantity: number;
  requiredQuantity: number;
  minThreshold: number;
  maxThreshold: number;
  reorderPoint: number;
  expectedDeliveryDate: string;
  supplier: string;
  project: string;
  packageCode: string;
  responsiblePerson: string;
  lastTransactionDate: string;
  notes: string;
  stockValueK: number;
  oneCReferenceId: string;
  externalSyncId: string;
  externalStatus: string;
  syncStatus: string;
  lastSyncTime: string;
  sourceSystem: string;
  syncErrorMessage: string;
  closed: boolean;
}

export interface WarehouseDashboardModel {
  rows: WarehouseOperationalRow[];
  kpis: WarehouseKpi[];
  metrics: WarehouseMetric[];
  alerts: WarehouseAlert[];
  charts: {
    stockByCategory: WarehouseChartDatum[];
    shortagesByProject: WarehouseChartDatum[];
    delayedBySupplier: WarehouseChartDatum[];
    movementTrend: WarehouseMovementDatum[];
    reservationVsAvailable: WarehouseChartDatum[];
    topCriticalMaterials: WarehouseChartDatum[];
    warehouseBalance: WarehouseBalanceDatum[];
  };
  filterOptions: WarehouseFilterOptions;
}

const RAW_ROWS: WarehouseBaseRow[] = [
  {
    id: "WHR-001",
    materialCode: "REB-T16",
    materialName: "Rebar T16",
    category: "Structural",
    subcategory: "Rebar",
    warehouse: "Main Warehouse",
    unit: "kg",
    currentStock: 280,
    reservedStock: 40,
    incomingQuantity: 120,
    outgoingQuantity: 90,
    issuedToSiteQuantity: 120,
    pendingDeliveryQuantity: 100,
    requiredQuantity: 320,
    minThreshold: 220,
    maxThreshold: 600,
    reorderPoint: 250,
    expectedDeliveryDate: "2026-03-03",
    supplier: "Aksa Steel",
    project: "A27 Transit Hub",
    packageCode: "CIV-01",
    responsiblePerson: "O. Yildirim",
    lastTransactionDate: "2026-02-27",
    notes: "Primary structural feed for pile cap and deck beams.",
    stockValueK: 184,
    oneCReferenceId: "1C-MAT-001",
    externalSyncId: "SYNC-1001",
    externalStatus: "Operational",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 08:40",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-002",
    materialCode: "HV-CAB-4X120",
    materialName: "HV Cable 4x120",
    category: "MEP",
    subcategory: "Cabling",
    warehouse: "Electrical Store",
    unit: "m",
    currentStock: 145,
    reservedStock: 30,
    incomingQuantity: 40,
    outgoingQuantity: 120,
    issuedToSiteQuantity: 95,
    pendingDeliveryQuantity: 180,
    requiredQuantity: 260,
    minThreshold: 160,
    maxThreshold: 620,
    reorderPoint: 180,
    expectedDeliveryDate: "2026-02-24",
    supplier: "Voltana Electric",
    project: "A27 Transit Hub",
    packageCode: "MEP-07",
    responsiblePerson: "M. Demir",
    lastTransactionDate: "2026-02-26",
    notes: "Critical trunk feed for Zone-3 energization milestone.",
    stockValueK: 372,
    oneCReferenceId: "1C-MAT-002",
    externalSyncId: "SYNC-1002",
    externalStatus: "PendingDelivery",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 08:35",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-003",
    materialCode: "DUCT-GI-500",
    materialName: "GI Ducting 500",
    category: "MEP",
    subcategory: "Ducting",
    warehouse: "Main Warehouse",
    unit: "pcs",
    currentStock: 510,
    reservedStock: 60,
    incomingQuantity: 0,
    outgoingQuantity: 35,
    issuedToSiteQuantity: 50,
    pendingDeliveryQuantity: 0,
    requiredQuantity: 300,
    minThreshold: 300,
    maxThreshold: 430,
    reorderPoint: 280,
    expectedDeliveryDate: "",
    supplier: "CloudBuild Trading",
    project: "A27 Transit Hub",
    packageCode: "MEP-05",
    responsiblePerson: "M. Demir",
    lastTransactionDate: "2026-02-27",
    notes: "Excess stock identified against latest MEP remeasure.",
    stockValueK: 138,
    oneCReferenceId: "1C-MAT-003",
    externalSyncId: "SYNC-1003",
    externalStatus: "Operational",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 08:29",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-004",
    materialCode: "SWGR-LV",
    materialName: "LV Switchgear",
    category: "MEP",
    subcategory: "Switchgear",
    warehouse: "Electrical Store",
    unit: "pcs",
    currentStock: 22,
    reservedStock: 4,
    incomingQuantity: 0,
    outgoingQuantity: 2,
    issuedToSiteQuantity: 1,
    pendingDeliveryQuantity: 20,
    requiredQuantity: 40,
    minThreshold: 24,
    maxThreshold: 70,
    reorderPoint: 30,
    expectedDeliveryDate: "2026-02-22",
    supplier: "Voltana Electric",
    project: "A27 Transit Hub",
    packageCode: "MEP-07",
    responsiblePerson: "M. Demir",
    lastTransactionDate: "2026-02-20",
    notes: "Factory hold due to FAT rescheduling. Package release blocked.",
    stockValueK: 902,
    oneCReferenceId: "1C-MAT-004",
    externalSyncId: "SYNC-1004",
    externalStatus: "SyncError",
    syncStatus: "Error",
    lastSyncTime: "2026-02-27 17:10",
    sourceSystem: "1C",
    syncErrorMessage: "Supplier item code mismatch during 1C sync.",
    closed: false,
  },
  {
    id: "WHR-005",
    materialCode: "FORM-PNL",
    materialName: "Formwork Panels",
    category: "Structural",
    subcategory: "Formwork",
    warehouse: "Site Buffer",
    unit: "pcs",
    currentStock: 190,
    reservedStock: 20,
    incomingQuantity: 0,
    outgoingQuantity: 25,
    issuedToSiteQuantity: 40,
    pendingDeliveryQuantity: 0,
    requiredQuantity: 140,
    minThreshold: 140,
    maxThreshold: 360,
    reorderPoint: 130,
    expectedDeliveryDate: "",
    supplier: "Aksa Steel",
    project: "A27 Transit Hub",
    packageCode: "CIV-03",
    responsiblePerson: "O. Yildirim",
    lastTransactionDate: "2026-02-25",
    notes: "Healthy stock position for current pour sequence.",
    stockValueK: 111,
    oneCReferenceId: "1C-MAT-005",
    externalSyncId: "SYNC-1005",
    externalStatus: "Operational",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 08:11",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-006",
    materialCode: "FIRE-DN100",
    materialName: "Fire Pipe DN100",
    category: "MEP",
    subcategory: "Piping",
    warehouse: "Electrical Store",
    unit: "m",
    currentStock: 85,
    reservedStock: 15,
    incomingQuantity: 50,
    outgoingQuantity: 65,
    issuedToSiteQuantity: 70,
    pendingDeliveryQuantity: 140,
    requiredQuantity: 210,
    minThreshold: 120,
    maxThreshold: 360,
    reorderPoint: 135,
    expectedDeliveryDate: "2026-03-04",
    supplier: "Voltana Electric",
    project: "Harbor Link",
    packageCode: "MEP-12",
    responsiblePerson: "S. Kara",
    lastTransactionDate: "2026-02-21",
    notes: "Shortage persists until supplier lot-2 arrival.",
    stockValueK: 96,
    oneCReferenceId: "1C-MAT-006",
    externalSyncId: "SYNC-1006",
    externalStatus: "PendingDelivery",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 07:58",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-007",
    materialCode: "TILE-600",
    materialName: "Porcelain Tile 600x600",
    category: "Finishing",
    subcategory: "Tiles",
    warehouse: "Finishing Store",
    unit: "pcs",
    currentStock: 420,
    reservedStock: 180,
    incomingQuantity: 60,
    outgoingQuantity: 120,
    issuedToSiteQuantity: 95,
    pendingDeliveryQuantity: 140,
    requiredQuantity: 500,
    minThreshold: 260,
    maxThreshold: 780,
    reorderPoint: 300,
    expectedDeliveryDate: "2026-03-08",
    supplier: "CloudBuild Trading",
    project: "Harbor Link",
    packageCode: "FIN-03",
    responsiblePerson: "S. Kara",
    lastTransactionDate: "2026-02-27",
    notes: "Backlog tied to customs release of batch TR-44.",
    stockValueK: 154,
    oneCReferenceId: "1C-MAT-007",
    externalSyncId: "SYNC-1007",
    externalStatus: "Partial",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 08:02",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-008",
    materialCode: "ADH-50KG",
    materialName: "Tile Adhesive 50kg",
    category: "Finishing",
    subcategory: "Chemicals",
    warehouse: "Finishing Store",
    unit: "bag",
    currentStock: 70,
    reservedStock: 20,
    incomingQuantity: 0,
    outgoingQuantity: 40,
    issuedToSiteQuantity: 35,
    pendingDeliveryQuantity: 80,
    requiredQuantity: 140,
    minThreshold: 90,
    maxThreshold: 260,
    reorderPoint: 100,
    expectedDeliveryDate: "2026-03-01",
    supplier: "CloudBuild Trading",
    project: "Harbor Link",
    packageCode: "FIN-03",
    responsiblePerson: "S. Kara",
    lastTransactionDate: "2026-02-26",
    notes: "Upcoming 3-day delivery risk due shortage and low stock.",
    stockValueK: 42,
    oneCReferenceId: "1C-MAT-008",
    externalSyncId: "SYNC-1008",
    externalStatus: "PendingDelivery",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 07:46",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-009",
    materialCode: "BOLT-M20",
    materialName: "Anchor Bolt M20",
    category: "Structural",
    subcategory: "Fasteners",
    warehouse: "Main Warehouse",
    unit: "pcs",
    currentStock: 760,
    reservedStock: 210,
    incomingQuantity: 0,
    outgoingQuantity: 140,
    issuedToSiteQuantity: 160,
    pendingDeliveryQuantity: 0,
    requiredQuantity: 680,
    minThreshold: 320,
    maxThreshold: 1400,
    reorderPoint: 360,
    expectedDeliveryDate: "",
    supplier: "Aksa Steel",
    project: "A27 Transit Hub",
    packageCode: "CIV-04",
    responsiblePerson: "O. Yildirim",
    lastTransactionDate: "2026-02-27",
    notes: "Sufficient for upcoming 2-week civils sequence.",
    stockValueK: 204,
    oneCReferenceId: "1C-MAT-009",
    externalSyncId: "SYNC-1009",
    externalStatus: "Operational",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 08:07",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-010",
    materialCode: "INS-WOOL",
    materialName: "Insulation Wool",
    category: "MEP",
    subcategory: "Insulation",
    warehouse: "Main Warehouse",
    unit: "roll",
    currentStock: 0,
    reservedStock: 0,
    incomingQuantity: 0,
    outgoingQuantity: 0,
    issuedToSiteQuantity: 0,
    pendingDeliveryQuantity: 150,
    requiredQuantity: 120,
    minThreshold: 60,
    maxThreshold: 260,
    reorderPoint: 80,
    expectedDeliveryDate: "2026-03-06",
    supplier: "Voltana Electric",
    project: "A27 Transit Hub",
    packageCode: "MEP-09",
    responsiblePerson: "M. Demir",
    lastTransactionDate: "2026-02-10",
    notes: "Out of stock; release dependent on supplier dispatch.",
    stockValueK: 0,
    oneCReferenceId: "1C-MAT-010",
    externalSyncId: "SYNC-1010",
    externalStatus: "PendingDelivery",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 07:31",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-011",
    materialCode: "PUMP-CHW",
    materialName: "CHW Pump Assembly",
    category: "MEP",
    subcategory: "Mechanical",
    warehouse: "Electrical Store",
    unit: "pcs",
    currentStock: 6,
    reservedStock: 4,
    incomingQuantity: 0,
    outgoingQuantity: 1,
    issuedToSiteQuantity: 1,
    pendingDeliveryQuantity: 0,
    requiredQuantity: 8,
    minThreshold: 6,
    maxThreshold: 18,
    reorderPoint: 7,
    expectedDeliveryDate: "",
    supplier: "",
    project: "Harbor Link",
    packageCode: "MEP-10",
    responsiblePerson: "S. Kara",
    lastTransactionDate: "2026-02-18",
    notes: "Supplier and delivery date not assigned in ERP.",
    stockValueK: 287,
    oneCReferenceId: "1C-MAT-011",
    externalSyncId: "SYNC-1011",
    externalStatus: "Draft",
    syncStatus: "Pending",
    lastSyncTime: "2026-02-26 14:12",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: false,
  },
  {
    id: "WHR-012",
    materialCode: "VALVE-200",
    materialName: "Gate Valve DN200",
    category: "MEP",
    subcategory: "Valves",
    warehouse: "Site Buffer",
    unit: "pcs",
    currentStock: 48,
    reservedStock: 2,
    incomingQuantity: 0,
    outgoingQuantity: 3,
    issuedToSiteQuantity: 4,
    pendingDeliveryQuantity: 0,
    requiredQuantity: 30,
    minThreshold: 20,
    maxThreshold: 120,
    reorderPoint: 24,
    expectedDeliveryDate: "",
    supplier: "Voltana Electric",
    project: "Harbor Link",
    packageCode: "MEP-12",
    responsiblePerson: "S. Kara",
    lastTransactionDate: "2026-02-23",
    notes: "Closed scope lot released to site.",
    stockValueK: 66,
    oneCReferenceId: "1C-MAT-012",
    externalSyncId: "SYNC-1012",
    externalStatus: "Closed",
    syncStatus: "Synced",
    lastSyncTime: "2026-02-28 08:19",
    sourceSystem: "1C",
    syncErrorMessage: "",
    closed: true,
  },
];

const MOVEMENT_TREND: WarehouseMovementDatum[] = [
  { period: "2026-W01", incoming: 410, outgoing: 295 },
  { period: "2026-W02", incoming: 368, outgoing: 322 },
  { period: "2026-W03", incoming: 452, outgoing: 371 },
  { period: "2026-W04", incoming: 496, outgoing: 406 },
  { period: "2026-W05", incoming: 422, outgoing: 389 },
  { period: "2026-W06", incoming: 384, outgoing: 352 },
  { period: "2026-W07", incoming: 514, outgoing: 448 },
  { period: "2026-W08", incoming: 468, outgoing: 431 },
];

const ALL_STATUSES: WarehouseStatus[] = [
  "In Stock",
  "Low Stock",
  "Out of Stock",
  "Reserved",
  "Pending Delivery",
  "Delayed Delivery",
  "Shortage",
  "Excess",
  "Issued to Site",
  "Blocked",
  "Closed",
];

const EMPTY_FILTERS: WarehouseFilters = {
  warehouse: "",
  category: "",
  project: "",
  packageCode: "",
  supplier: "",
  status: "",
  criticalOnly: false,
  shortageOnly: false,
  delayedOnly: false,
  reservedOnly: false,
  dateFrom: "",
  dateTo: "",
  search: "",
};

export function createDefaultWarehouseFilters(): WarehouseFilters {
  return { ...EMPTY_FILTERS };
}

export function buildWarehouseDashboard(filters: WarehouseFilters, now = new Date()): WarehouseDashboardModel {
  const allRows = RAW_ROWS.map((raw) => deriveOperationalRow(raw, now));
  const filteredRows = applyFilters(allRows, filters);
  const kpis = buildKpis(filteredRows);
  const metrics = buildMetrics(filteredRows);
  const alerts = buildAlerts(filteredRows, now);

  return {
    rows: filteredRows,
    kpis,
    metrics,
    alerts,
    charts: buildCharts(filteredRows),
    filterOptions: {
      warehouses: distinct(allRows.map((row) => row.warehouse)),
      categories: distinct(allRows.map((row) => row.category)),
      projects: distinct(allRows.map((row) => row.project)),
      packages: distinct(allRows.map((row) => row.packageCode)),
      suppliers: distinct(allRows.map((row) => row.supplier).filter((item) => item.length > 0)),
      statuses: ALL_STATUSES,
    },
  };
}
function deriveOperationalRow(raw: WarehouseBaseRow, now: Date): WarehouseOperationalRow {
  const availableStock = Math.max(raw.currentStock - raw.reservedStock, 0);
  const shortageQuantity = Math.max(raw.requiredQuantity - availableStock, 0);
  const excessQuantity = Math.max(availableStock - raw.maxThreshold, 0);

  const expectedDate = parseIsoDate(raw.expectedDeliveryDate);
  const delayedDelivery = Boolean(expectedDate && raw.pendingDeliveryQuantity > 0 && expectedDate.getTime() < startOfDay(now).getTime());
  const criticalShortage = shortageQuantity > 0 && availableStock < raw.requiredQuantity;
  const lowStock = availableStock > 0 && availableStock < raw.minThreshold;
  const outOfStock = availableStock <= 0;
  const reserved = raw.reservedStock > 0;
  const pending = raw.pendingDeliveryQuantity > 0;
  const blocked = criticalShortage && !raw.closed;
  const issued = raw.issuedToSiteQuantity > 0;
  const excess = excessQuantity > 0;

  const upcomingDeliveryRisk3Days =
    shortageQuantity > 0 &&
    Boolean(expectedDate && isWithinDays(expectedDate, now, 3) && expectedDate.getTime() >= startOfDay(now).getTime());

  const upcomingDeliveryRisk7Days =
    shortageQuantity > 0 &&
    Boolean(expectedDate && isWithinDays(expectedDate, now, 7) && expectedDate.getTime() >= startOfDay(now).getTime());

  const statusTags: WarehouseStatus[] = [];
  if (raw.closed) statusTags.push("Closed");
  if (outOfStock) statusTags.push("Out of Stock");
  if (lowStock) statusTags.push("Low Stock");
  if (reserved) statusTags.push("Reserved");
  if (pending) statusTags.push("Pending Delivery");
  if (delayedDelivery) statusTags.push("Delayed Delivery");
  if (criticalShortage) statusTags.push("Shortage");
  if (excess) statusTags.push("Excess");
  if (issued) statusTags.push("Issued to Site");
  if (blocked) statusTags.push("Blocked");
  if (!statusTags.length) statusTags.push("In Stock");

  const detail = buildRowDetail(raw, availableStock);

  return {
    id: raw.id,
    materialCode: raw.materialCode,
    materialName: raw.materialName,
    category: raw.category,
    subcategory: raw.subcategory,
    warehouse: raw.warehouse,
    unit: raw.unit,
    currentStock: raw.currentStock,
    reservedStock: raw.reservedStock,
    availableStock,
    incomingQuantity: raw.incomingQuantity,
    outgoingQuantity: raw.outgoingQuantity,
    issuedToSiteQuantity: raw.issuedToSiteQuantity,
    pendingDeliveryQuantity: raw.pendingDeliveryQuantity,
    requiredQuantity: raw.requiredQuantity,
    shortageQuantity,
    excessQuantity,
    reorderStatus: availableStock <= raw.reorderPoint ? "Reorder Needed" : "Healthy",
    expectedDeliveryDate: raw.expectedDeliveryDate,
    supplier: raw.supplier,
    project: raw.project,
    packageCode: raw.packageCode,
    responsiblePerson: raw.responsiblePerson,
    lastTransactionDate: raw.lastTransactionDate,
    lastSyncTime: raw.lastSyncTime,
    notes: raw.notes,
    status: statusTags[0],
    statusTags,
    criticalShortage,
    delayedDelivery,
    blockedPackage: blocked,
    upcomingDeliveryRisk3Days,
    upcomingDeliveryRisk7Days,
    stockValueK: raw.stockValueK,
    oneCReferenceId: raw.oneCReferenceId,
    externalSyncId: raw.externalSyncId,
    externalStatus: raw.externalStatus,
    syncStatus: raw.syncStatus,
    sourceSystem: raw.sourceSystem,
    syncErrorMessage: raw.syncErrorMessage,
    detail,
  };
}

function buildRowDetail(raw: WarehouseBaseRow, availableStock: number): WarehouseRowDetail {
  return {
    materialInfo: `${raw.materialCode} / ${raw.materialName} (${raw.category} - ${raw.subcategory})`,
    transactionHistory: [
      {
        date: shiftDate(raw.lastTransactionDate, -9),
        type: "Incoming",
        quantity: Math.max(raw.incomingQuantity - 20, 0),
        warehouse: raw.warehouse,
        project: raw.project,
        packageCode: raw.packageCode,
      },
      {
        date: shiftDate(raw.lastTransactionDate, -5),
        type: "Outgoing",
        quantity: raw.outgoingQuantity,
        warehouse: raw.warehouse,
        project: raw.project,
        packageCode: raw.packageCode,
      },
      {
        date: raw.lastTransactionDate,
        type: "Issued to Site",
        quantity: raw.issuedToSiteQuantity,
        warehouse: raw.warehouse,
        project: raw.project,
        packageCode: raw.packageCode,
      },
    ],
    stockByWarehouse: [
      {
        warehouse: raw.warehouse,
        current: raw.currentStock,
        reserved: raw.reservedStock,
        available: availableStock,
      },
    ],
    linkedPackages: [
      {
        project: raw.project,
        packageCode: raw.packageCode,
        requiredQuantity: raw.requiredQuantity,
        issuedQuantity: raw.issuedToSiteQuantity,
        status: raw.closed ? "Closed" : raw.requiredQuantity > availableStock ? "Blocked" : "Ready",
      },
    ],
    reservations: [
      {
        id: `${raw.id}-RSV-01`,
        reservedQuantity: raw.reservedStock,
        requiredQuantity: raw.requiredQuantity,
        neededBy: raw.expectedDeliveryDate || shiftDate(raw.lastTransactionDate, 5),
        status: raw.closed ? "Closed" : "Active",
      },
    ],
    deliveries: [
      {
        id: `${raw.id}-DLV-01`,
        supplier: raw.supplier || "Unassigned",
        orderedQuantity: raw.pendingDeliveryQuantity,
        receivedQuantity: 0,
        expectedDate: raw.expectedDeliveryDate,
        receivedDate: "",
        status: raw.pendingDeliveryQuantity > 0 ? "Pending" : "None",
      },
    ],
    notes: raw.notes,
    oneCReferenceId: raw.oneCReferenceId,
    externalSyncId: raw.externalSyncId,
    externalStatus: raw.externalStatus,
    syncStatus: raw.syncStatus,
    lastSyncTime: raw.lastSyncTime,
    sourceSystem: raw.sourceSystem,
    syncErrorMessage: raw.syncErrorMessage,
  };
}

function applyFilters(rows: WarehouseOperationalRow[], filters: WarehouseFilters): WarehouseOperationalRow[] {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const from = parseIsoDate(filters.dateFrom);
  const to = parseIsoDate(filters.dateTo);

  return rows
    .filter((row) => !filters.warehouse || row.warehouse === filters.warehouse)
    .filter((row) => !filters.category || row.category === filters.category)
    .filter((row) => !filters.project || row.project === filters.project)
    .filter((row) => !filters.packageCode || row.packageCode === filters.packageCode)
    .filter((row) => !filters.supplier || row.supplier === filters.supplier)
    .filter((row) => !filters.status || row.statusTags.includes(filters.status as WarehouseStatus))
    .filter((row) => !filters.criticalOnly || row.criticalShortage)
    .filter((row) => !filters.shortageOnly || row.shortageQuantity > 0)
    .filter((row) => !filters.delayedOnly || row.delayedDelivery)
    .filter((row) => !filters.reservedOnly || row.reservedStock > 0)
    .filter((row) => {
      if (!from && !to) return true;
      const date = parseIsoDate(row.expectedDeliveryDate) ?? parseIsoDate(row.lastTransactionDate);
      if (!date) return false;
      if (from && date.getTime() < from.getTime()) return false;
      if (to && date.getTime() > to.getTime()) return false;
      return true;
    })
    .filter((row) => {
      if (!normalizedSearch) return true;
      const haystack = [
        row.materialCode,
        row.materialName,
        row.category,
        row.subcategory,
        row.warehouse,
        row.project,
        row.packageCode,
        row.supplier,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
}
function buildKpis(rows: WarehouseOperationalRow[]): WarehouseKpi[] {
  const totalMaterials = distinct(rows.map((row) => row.materialCode)).length;
  const totalActiveStockItems = rows.filter((row) => row.currentStock > 0 || row.pendingDeliveryQuantity > 0).length;
  const lowStockItems = rows.filter((row) => row.statusTags.includes("Low Stock")).length;
  const outOfStockItems = rows.filter((row) => row.statusTags.includes("Out of Stock")).length;
  const delayedDeliveries = rows.filter((row) => row.delayedDelivery).length;
  const incomingThisWeek = rows.filter((row) => {
    const date = parseIsoDate(row.expectedDeliveryDate);
    return Boolean(date && row.pendingDeliveryQuantity > 0 && isWithinDays(date, new Date("2026-02-28"), 7));
  }).length;
  const reservedMaterials = rows.reduce((total, row) => total + row.reservedStock, 0);
  const issuedToSite = rows.reduce((total, row) => total + row.issuedToSiteQuantity, 0);
  const criticalShortages = rows.filter((row) => row.criticalShortage).length;
  const totalWarehouseValueK = rows.reduce((total, row) => total + row.stockValueK, 0);
  const blockedPackages = distinct(rows.filter((row) => row.blockedPackage).map((row) => row.packageCode)).length;

  return [
    kpi("total_materials", "Total Materials", String(totalMaterials), "Material master items in active scope.", "neutral"),
    kpi("active_stock", "Active Stock Items", String(totalActiveStockItems), "Rows with stock or pending delivery activity.", "neutral"),
    kpi("low_stock", "Low Stock Items", String(lowStockItems), "Available stock below minimum threshold.", lowStockItems > 0 ? "warning" : "ok"),
    kpi("out_stock", "Out-of-Stock Items", String(outOfStockItems), "No available stock for execution.", outOfStockItems > 0 ? "critical" : "ok"),
    kpi("delayed", "Delayed Deliveries", String(delayedDeliveries), "Expected date passed and delivery not completed.", delayedDeliveries > 0 ? "critical" : "ok"),
    kpi("incoming_week", "Incoming This Week", String(incomingThisWeek), "Deliveries expected within 7 days.", "neutral"),
    kpi("reserved", "Reserved Materials", formatQuantity(reservedMaterials), "Reserved quantity against active packages.", "neutral"),
    kpi("issued", "Issued To Site", formatQuantity(issuedToSite), "Issued quantity for active execution fronts.", "neutral"),
    kpi("critical", "Critical Shortages", String(criticalShortages), "Rows where available stock is below required quantity.", criticalShortages > 0 ? "critical" : "ok"),
    kpi("value", "Total Warehouse Value", `$${totalWarehouseValueK.toFixed(1)}K`, "Estimated on-hand value from unit rates.", "neutral"),
    kpi("blocked", "Blocked Packages", String(blockedPackages), "Packages blocked by material constraints.", blockedPackages > 0 ? "critical" : "ok"),
  ];
}

function buildMetrics(rows: WarehouseOperationalRow[]): WarehouseMetric[] {
  const totalAvailable = rows.reduce((total, row) => total + row.availableStock, 0);
  const totalOutgoing = rows.reduce((total, row) => total + row.outgoingQuantity, 0);
  const stockCoverage = totalOutgoing > 0 ? (totalAvailable / totalOutgoing) * 30 : 0;

  const shortageRate = rows.length > 0 ? (rows.filter((row) => row.shortageQuantity > 0).length / rows.length) * 100 : 0;
  const completedDeliveries = rows.flatMap((row) => row.detail.deliveries).filter((delivery) => delivery.receivedDate);
  const onTimeDeliveries = completedDeliveries.filter((delivery) => {
    const expected = parseIsoDate(delivery.expectedDate);
    const received = parseIsoDate(delivery.receivedDate);
    return Boolean(expected && received && received.getTime() <= expected.getTime());
  }).length;

  const onTimeDeliveryRate = completedDeliveries.length > 0 ? (onTimeDeliveries / completedDeliveries.length) * 100 : 0;
  const turnover = totalAvailable > 0 ? totalOutgoing / totalAvailable : 0;

  const blockedPackages = distinct(rows.filter((row) => row.blockedPackage).map((row) => row.packageCode)).length;
  const criticalMaterials = distinct(rows.filter((row) => row.criticalShortage).map((row) => row.materialCode)).length;

  return [
    { label: "Stock Coverage", value: `${stockCoverage.toFixed(1)} days` },
    { label: "Shortage Rate", value: `${shortageRate.toFixed(1)}%` },
    { label: "On-Time Delivery", value: `${onTimeDeliveryRate.toFixed(1)}%` },
    { label: "Turnover Indicator", value: `${turnover.toFixed(2)}x` },
    { label: "Blocked Packages", value: String(blockedPackages) },
    { label: "Critical Materials", value: String(criticalMaterials) },
  ];
}

function buildAlerts(rows: WarehouseOperationalRow[], now: Date): WarehouseAlert[] {
  const staleThreshold = shiftDate(now.toISOString().slice(0, 10), -14);

  const alerts: WarehouseAlert[] = [];

  rows
    .filter((row) => row.delayedDelivery)
    .forEach((row) => {
      alerts.push({
        id: `${row.id}-overdue`,
        severity: "critical",
        title: "Overdue Delivery",
        detail: `${row.materialCode} expected on ${row.expectedDeliveryDate || "-"} has not arrived.`,
        materialCode: row.materialCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    });

  rows
    .filter((row) => row.criticalShortage)
    .forEach((row) => {
      alerts.push({
        id: `${row.id}-shortage`,
        severity: "critical",
        title: "Critical Shortage",
        detail: `${row.materialCode} shortage is ${formatQuantity(row.shortageQuantity)} ${row.unit}.`,
        materialCode: row.materialCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    });

  rows
    .filter((row) => row.blockedPackage)
    .forEach((row) => {
      alerts.push({
        id: `${row.id}-blocked`,
        severity: "warning",
        title: "Blocked Package",
        detail: `${row.packageCode} is blocked by ${row.materialCode} availability.`,
        materialCode: row.materialCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    });

  rows
    .filter((row) => row.pendingDeliveryQuantity > 0 && (!row.supplier || !row.expectedDeliveryDate))
    .forEach((row) => {
      alerts.push({
        id: `${row.id}-missing`,
        severity: "warning",
        title: "Missing Supplier/Date",
        detail: `${row.materialCode} has pending delivery with incomplete supplier/date metadata.`,
        materialCode: row.materialCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    });

  rows
    .filter((row) => row.lastTransactionDate < staleThreshold)
    .forEach((row) => {
      alerts.push({
        id: `${row.id}-stale`,
        severity: "info",
        title: "No Recent Update",
        detail: `${row.materialCode} has no stock movement in the last 14 days.`,
        materialCode: row.materialCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    });

  rows
    .filter((row) => row.syncStatus.toLowerCase() === "error" || row.syncErrorMessage.length > 0)
    .forEach((row) => {
      alerts.push({
        id: `${row.id}-sync`,
        severity: "critical",
        title: "Sync Error",
        detail: `${row.materialCode}: ${row.syncErrorMessage || "Unknown 1C sync failure."}`,
        materialCode: row.materialCode,
        projectCode: row.project,
        packageCode: row.packageCode,
      });
    });

  return alerts
    .sort((left, right) => alertWeight(left.severity) - alertWeight(right.severity))
    .slice(0, 18);
}

function buildCharts(rows: WarehouseOperationalRow[]) {
  const stockByCategory = sumBy(rows, "category", (row) => row.availableStock);
  const shortagesByProject = sumBy(rows.filter((row) => row.shortageQuantity > 0), "project", (row) => row.shortageQuantity);
  const delayedBySupplier = countBy(rows.filter((row) => row.delayedDelivery), "supplier");
  const reservationVsAvailable: WarehouseChartDatum[] = [
    { name: "Reserved", value: rows.reduce((total, row) => total + row.reservedStock, 0) },
    { name: "Available", value: rows.reduce((total, row) => total + row.availableStock, 0) },
  ];

  const topCriticalMaterials = rows
    .filter((row) => row.shortageQuantity > 0)
    .sort((left, right) => right.shortageQuantity - left.shortageQuantity)
    .slice(0, 8)
    .map((row) => ({ name: row.materialCode, value: row.shortageQuantity }));

  const warehouseBalance = Object.values(
    rows.reduce<Record<string, WarehouseBalanceDatum>>((accumulator, row) => {
      const entry = accumulator[row.warehouse] ?? {
        warehouse: row.warehouse,
        current: 0,
        reserved: 0,
        available: 0,
      };

      entry.current += row.currentStock;
      entry.reserved += row.reservedStock;
      entry.available += row.availableStock;
      accumulator[row.warehouse] = entry;
      return accumulator;
    }, {})
  );

  return {
    stockByCategory,
    shortagesByProject,
    delayedBySupplier,
    movementTrend: MOVEMENT_TREND,
    reservationVsAvailable,
    topCriticalMaterials,
    warehouseBalance,
  };
}

function sumBy(rows: WarehouseOperationalRow[], key: "category" | "project", getter: (row: WarehouseOperationalRow) => number): WarehouseChartDatum[] {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const bucket = row[key] || "Unassigned";
    const current = map.get(bucket) ?? 0;
    map.set(bucket, current + getter(row));
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function countBy(rows: WarehouseOperationalRow[], key: "supplier"): WarehouseChartDatum[] {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const bucket = row[key] || "Unassigned";
    const current = map.get(bucket) ?? 0;
    map.set(bucket, current + 1);
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function startOfDay(value: Date): Date {
  const output = new Date(value);
  output.setHours(0, 0, 0, 0);
  return output;
}

function isWithinDays(target: Date, reference: Date, days: number): boolean {
  const diffMs = startOfDay(target).getTime() - startOfDay(reference).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

function shiftDate(value: string, diffDays: number): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  parsed.setDate(parsed.getDate() + diffDays);
  return parsed.toISOString().slice(0, 10);
}

function distinct(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function kpi(key: string, title: string, value: string, description: string, severity: Severity): WarehouseKpi {
  return { key, title, value, description, severity };
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function alertWeight(severity: AlertSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}
