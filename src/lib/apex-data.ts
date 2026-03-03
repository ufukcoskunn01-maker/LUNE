export type KPI = {
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  note: string;
};

export const dashboardKpis: KPI[] = [
  {
    title: "Total Revenue",
    value: "$482.6M",
    delta: "+8.4% MoM",
    trend: "up",
    note: "Driven by civil works acceleration and approved variations.",
  },
  {
    title: "Active Projects",
    value: "26",
    delta: "+2 new",
    trend: "up",
    note: "17 on-track, 6 at-risk, 3 delayed.",
  },
  {
    title: "Team Members",
    value: "1,284",
    delta: "+46 this month",
    trend: "up",
    note: "Peak workforce expected in Q3 2026.",
  },
  {
    title: "Portfolio CPI / SPI",
    value: "0.97 / 0.94",
    delta: "-0.01 / +0.02",
    trend: "flat",
    note: "Cost pressure easing; schedule recovery in progress.",
  },
];

export const financeTrend = [
  { period: "Sep", revenue: 54, expense: 40, profit: 14 },
  { period: "Oct", revenue: 58, expense: 43, profit: 15 },
  { period: "Nov", revenue: 61, expense: 46, profit: 15 },
  { period: "Dec", revenue: 66, expense: 49, profit: 17 },
  { period: "Jan", revenue: 71, expense: 51, profit: 20 },
  { period: "Feb", revenue: 73, expense: 53, profit: 20 },
];

export const projectStatusMix = [
  { name: "On Track", value: 17 },
  { name: "At Risk", value: 6 },
  { name: "Delayed", value: 3 },
  { name: "Completed", value: 12 },
];

export const weeklyTeamHours = [
  { day: "Mon", engineering: 362, field: 498, qc: 102 },
  { day: "Tue", engineering: 348, field: 521, qc: 97 },
  { day: "Wed", engineering: 371, field: 535, qc: 103 },
  { day: "Thu", engineering: 366, field: 508, qc: 108 },
  { day: "Fri", engineering: 355, field: 495, qc: 94 },
  { day: "Sat", engineering: 214, field: 337, qc: 70 },
];

export type PortfolioProject = {
  id: string;
  name: string;
  status: "On Track" | "At Risk" | "Delayed" | "Planned" | "On Hold" | "Completed";
  progress: number;
  budgetM: number;
  spentM: number;
  deadline: string;
  location: string;
  phase: "Planning" | "Foundation" | "Construction" | "Finishing";
  category: "Commercial" | "Industrial" | "Residential";
  manager: string;
  teamSize: number;
};

export const portfolioProjects: PortfolioProject[] = [
  {
    id: "A27-001",
    name: "North Terminal Expansion",
    status: "At Risk",
    progress: 62,
    budgetM: 96,
    spentM: 64.8,
    deadline: "2026-11-24",
    location: "Houston, USA",
    phase: "Construction",
    category: "Industrial",
    manager: "Olivia Jordan",
    teamSize: 126,
  },
  {
    id: "A27-002",
    name: "Caspian Logistics Hub",
    status: "On Track",
    progress: 71,
    budgetM: 112,
    spentM: 75.3,
    deadline: "2026-09-12",
    location: "Baku, Azerbaijan",
    phase: "Construction",
    category: "Commercial",
    manager: "Emir Hasanov",
    teamSize: 144,
  },
  {
    id: "A27-003",
    name: "Harbor Tower Residences",
    status: "Delayed",
    progress: 43,
    budgetM: 84,
    spentM: 41.5,
    deadline: "2027-03-04",
    location: "Istanbul, Turkiye",
    phase: "Foundation",
    category: "Residential",
    manager: "Selin Aksoy",
    teamSize: 98,
  },
  {
    id: "A27-004",
    name: "Delta Data Center Campus",
    status: "On Track",
    progress: 79,
    budgetM: 138,
    spentM: 95.1,
    deadline: "2026-08-19",
    location: "Frankfurt, Germany",
    phase: "Finishing",
    category: "Industrial",
    manager: "Noah Laurent",
    teamSize: 168,
  },
  {
    id: "A27-005",
    name: "Metro Green District",
    status: "Planned",
    progress: 12,
    budgetM: 52,
    spentM: 8.7,
    deadline: "2027-06-30",
    location: "Doha, Qatar",
    phase: "Planning",
    category: "Commercial",
    manager: "Marta Ibrahim",
    teamSize: 64,
  },
  {
    id: "A27-006",
    name: "Eastern Bypass Viaduct",
    status: "On Hold",
    progress: 27,
    budgetM: 71,
    spentM: 19.6,
    deadline: "2027-01-16",
    location: "Riyadh, Saudi Arabia",
    phase: "Foundation",
    category: "Industrial",
    manager: "Daniel Cruz",
    teamSize: 82,
  },
];

export const evmTrend = [
  { period: "2025-W49", pv: 18.4, ev: 17.6, ac: 18.9 },
  { period: "2025-W50", pv: 21.2, ev: 20.1, ac: 21.6 },
  { period: "2025-W51", pv: 24.1, ev: 22.9, ac: 24.8 },
  { period: "2025-W52", pv: 27.3, ev: 25.8, ac: 27.2 },
  { period: "2026-W01", pv: 30.4, ev: 28.7, ac: 30.1 },
  { period: "2026-W02", pv: 33.8, ev: 31.6, ac: 33.2 },
  { period: "2026-W03", pv: 37.2, ev: 34.9, ac: 36.6 },
  { period: "2026-W04", pv: 40.7, ev: 38.2, ac: 40.9 },
  { period: "2026-W05", pv: 44.3, ev: 41.5, ac: 44.8 },
  { period: "2026-W06", pv: 48.0, ev: 44.7, ac: 48.1 },
];

export const evmIndexTrend = evmTrend.map((row) => ({
  period: row.period,
  cpi: Number((row.ev / row.ac).toFixed(3)),
  spi: Number((row.ev / row.pv).toFixed(3)),
}));

export const evmSummary = {
  bcws: 48.0,
  bcwp: 44.7,
  acwp: 48.1,
  bac: 126.4,
  eac: 131.2,
  etc: 82.5,
  vac: -4.8,
  cpi: 0.93,
  spi: 0.93,
  cv: -3.4,
  sv: -3.3,
};

export const scheduleDelta = [
  { activity: "CIV-120", baselineFinish: "2026-03-18", currentFinish: "2026-03-20", deltaDays: 2, critical: true },
  { activity: "ELE-204", baselineFinish: "2026-04-02", currentFinish: "2026-04-08", deltaDays: 6, critical: true },
  { activity: "MEP-312", baselineFinish: "2026-04-22", currentFinish: "2026-04-19", deltaDays: -3, critical: false },
  { activity: "ARC-410", baselineFinish: "2026-05-03", currentFinish: "2026-05-09", deltaDays: 6, critical: false },
  { activity: "COM-515", baselineFinish: "2026-05-26", currentFinish: "2026-05-30", deltaDays: 4, critical: true },
];

export const milestoneTrend = [
  { period: "W01", planned: 10, actual: 8 },
  { period: "W02", planned: 18, actual: 15 },
  { period: "W03", planned: 26, actual: 23 },
  { period: "W04", planned: 34, actual: 31 },
  { period: "W05", planned: 43, actual: 38 },
  { period: "W06", planned: 52, actual: 47 },
];

export const progressCurve = [
  { month: "Sep", planned: 8, actual: 7, earned: 7.2 },
  { month: "Oct", planned: 16, actual: 14, earned: 14.4 },
  { month: "Nov", planned: 28, actual: 24, earned: 24.6 },
  { month: "Dec", planned: 39, actual: 33, earned: 33.4 },
  { month: "Jan", planned: 52, actual: 46, earned: 46.3 },
  { month: "Feb", planned: 63, actual: 57, earned: 57.1 },
];

export const progressByTrade = [
  { trade: "Civil", complete: 68, remaining: 32 },
  { trade: "Structural", complete: 62, remaining: 38 },
  { trade: "MEP", complete: 49, remaining: 51 },
  { trade: "Architectural", complete: 44, remaining: 56 },
  { trade: "Commissioning", complete: 18, remaining: 82 },
];

export const procurementOrders = [
  {
    po: "PO-2026-1142",
    vendor: "Global Steel",
    amount: "$3.2M",
    requiredDate: "2026-02-18",
    actualDate: "2026-02-21",
    status: "In Transit",
    overdueDays: 3,
  },
  {
    po: "PO-2026-1137",
    vendor: "Atlas MEP",
    amount: "$1.1M",
    requiredDate: "2026-02-12",
    actualDate: "2026-02-12",
    status: "Received",
    overdueDays: 0,
  },
  {
    po: "PO-2026-1105",
    vendor: "Nova Controls",
    amount: "$4.8M",
    requiredDate: "2026-02-25",
    actualDate: "-",
    status: "Ordered",
    overdueDays: 0,
  },
  {
    po: "PO-2026-1098",
    vendor: "Lumen Cables",
    amount: "$860K",
    requiredDate: "2026-02-10",
    actualDate: "2026-02-16",
    status: "Received",
    overdueDays: 6,
  },
];

export const vendorPerformance = [
  { vendor: "Global Steel", onTime: 82, quality: 91, commercial: 88 },
  { vendor: "Atlas MEP", onTime: 94, quality: 89, commercial: 90 },
  { vendor: "Nova Controls", onTime: 76, quality: 95, commercial: 83 },
  { vendor: "Lumen Cables", onTime: 69, quality: 86, commercial: 80 },
];

export const inventoryStock = [
  { item: "Rebar T16", onHand: 280, minLevel: 220, valueK: 184 },
  { item: "HV Cables", onHand: 145, minLevel: 160, valueK: 372 },
  { item: "Ducting", onHand: 510, minLevel: 300, valueK: 138 },
  { item: "Switchgear", onHand: 22, minLevel: 24, valueK: 902 },
  { item: "Formwork Panels", onHand: 190, minLevel: 140, valueK: 111 },
];

export const reportJobs = [
  {
    name: "Executive Weekly Digest",
    schedule: "Every Monday 07:00",
    output: "PDF + XLSX",
    recipients: "Steering Committee",
    lastRun: "2026-02-16 07:00",
    status: "Delivered",
  },
  {
    name: "Daily Workforce Summary",
    schedule: "Daily 19:00",
    output: "XLSX",
    recipients: "Site Leadership",
    lastRun: "2026-02-16 19:01",
    status: "Delivered",
  },
  {
    name: "Cost Variance Exception",
    schedule: "Daily 18:30",
    output: "PDF",
    recipients: "Controls Team",
    lastRun: "2026-02-16 18:31",
    status: "Warning",
  },
];

export const documents = [
  {
    id: "DOC-7712",
    title: "IFC Drawings - Block A",
    type: "Drawing",
    version: "Rev-04",
    uploadedBy: "M. Ibrahim",
    uploadedAt: "2026-02-15",
    status: "Approved",
  },
  {
    id: "DOC-7721",
    title: "RFI-324 HVAC Clearance",
    type: "RFI",
    version: "Rev-01",
    uploadedBy: "N. Laurent",
    uploadedAt: "2026-02-16",
    status: "Open",
  },
  {
    id: "DOC-7699",
    title: "Submittal - LV Panel",
    type: "Submittal",
    version: "Rev-02",
    uploadedBy: "S. Aksoy",
    uploadedAt: "2026-02-13",
    status: "In Review",
  },
];

export const aiConversation = [
  {
    role: "user",
    message:
      "Compare CPI/SPI deterioration in the last 4 periods and list top 3 drivers with mitigation actions.",
  },
  {
    role: "assistant",
    message:
      "CPI dropped from 0.95 to 0.93 due to electrical overtime and delayed procurement. SPI improved from 0.91 to 0.93 because of civil recovery shifts. Top mitigations: resequence MEP fronts, enforce vendor escalation on PO-2026-1142, and freeze non-critical change requests.",
  },
];

export const teamMembers = [
  {
    name: "Olivia Jordan",
    role: "Project Manager",
    department: "Project Controls",
    company: "LUNE PMO",
    access: "Manager",
    status: "Active",
    lastLogin: "2026-02-17 08:14",
  },
  {
    name: "Emir Hasanov",
    role: "Planner/Scheduler",
    department: "Planning",
    company: "LUNE PMO",
    access: "Editor",
    status: "Active",
    lastLogin: "2026-02-17 08:51",
  },
  {
    name: "Selin Aksoy",
    role: "Quantity Surveyor",
    department: "Cost Control",
    company: "LUNE PMO",
    access: "Editor",
    status: "Active",
    lastLogin: "2026-02-16 22:03",
  },
  {
    name: "Daniel Cruz",
    role: "Procurement Officer",
    department: "Procurement",
    company: "LUNE PMO",
    access: "Editor",
    status: "Active",
    lastLogin: "2026-02-16 21:22",
  },
  {
    name: "Lina Park",
    role: "Viewer",
    department: "Client Team",
    company: "Client",
    access: "Read Only",
    status: "Active",
    lastLogin: "2026-02-15 10:42",
  },
];

export const notifications = [
  {
    type: "Schedule Delay",
    severity: "High",
    message: "ELE-204 slipped 6 days and entered critical path.",
    module: "Schedule",
    time: "2026-02-17 09:12",
  },
  {
    type: "Budget Variance",
    severity: "Medium",
    message: "Cost variance exceeded threshold at -$3.4M this period.",
    module: "EVM",
    time: "2026-02-17 08:43",
  },
  {
    type: "Approval Request",
    severity: "Low",
    message: "Submittal DOC-7699 requires engineering review.",
    module: "Documents",
    time: "2026-02-16 17:19",
  },
];

export const templates = [
  {
    title: "Daily Attendance Import",
    description: "Excel template with trade breakdown and headcount validation.",
    category: "Attendance",
    format: ".xlsx",
    updatedAt: "2026-02-09",
  },
  {
    title: "Weekly EVM Pack",
    description: "ANSI-748 aligned PV/EV/AC workbook with chart sheets.",
    category: "EVM",
    format: ".xlsx",
    updatedAt: "2026-02-14",
  },
  {
    title: "Three-Week Lookahead",
    description: "Schedule lookahead with baseline comparison and constraints log.",
    category: "Schedule",
    format: ".xlsx",
    updatedAt: "2026-02-11",
  },
  {
    title: "Executive Dashboard PDF",
    description: "Automated board-ready portfolio report with KPI snapshots.",
    category: "Reports",
    format: ".pdf",
    updatedAt: "2026-02-16",
  },
];
