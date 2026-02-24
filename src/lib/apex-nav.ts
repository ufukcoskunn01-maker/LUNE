import {
  Bell,
  Bot,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  Home,
  LayoutDashboard,
  Package,
  Radar,
  Settings,
  TrendingUp,
  UserCircle2,
  Users,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
};

export const APEX_PRIMARY_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Dashboard",
    icon: LayoutDashboard,
    description: "Portfolio overview, KPI signals, and trend analytics.",
  },
  {
    href: "/control-tower",
    label: "Control Tower",
    shortLabel: "Control",
    icon: Radar,
    description: "Live executive command view with advanced visuals and automation streams.",
  },
  {
    href: "/projects",
    label: "Projects",
    shortLabel: "Projects",
    icon: FolderKanban,
    description: "Portfolio controls with budget, schedule, and risk status.",
  },
  {
    href: "/evm-dashboard",
    label: "EVM Dashboard",
    shortLabel: "EVM",
    icon: TrendingUp,
    description: "ANSI-748 performance, variance, and forecast control.",
  },
  {
    href: "/schedule-comparison",
    label: "Schedule Comparison",
    shortLabel: "Schedule",
    icon: CalendarClock,
    description: "Baseline vs update delta tracking and critical-path changes.",
  },
  {
    href: "/daily-personal-reports",
    label: "Personal Reports",
    shortLabel: "Personal Reports",
    icon: Users,
    description: "Daily personnel report controls with profession and company breakdown.",
  },
  {
    href: "/progress",
    label: "Progress Tracking",
    shortLabel: "Progress",
    icon: Gauge,
    description: "Physical progress, S-curve velocity, and package completion.",
  },
  {
    href: "/procurement",
    label: "Procurement",
    shortLabel: "Procurement",
    icon: Package,
    description: "PO lifecycle, delivery risk, and vendor performance tracking.",
  },
  {
    href: "/warehouse",
    label: "Warehouse",
    shortLabel: "Warehouse",
    icon: Warehouse,
    description: "Inventory valuation, stock risk, and material transactions.",
  },
  {
    href: "/reports",
    label: "Reports",
    shortLabel: "Reports",
    icon: FileText,
    description: "Automated report scheduling, generation, and distribution.",
  },
  {
    href: "/documents",
    label: "Documents",
    shortLabel: "Documents",
    icon: ClipboardList,
    description: "Version-controlled records, RFIs, submittals, and drawings.",
  },
  {
    href: "/ai",
    label: "AI Assistant",
    shortLabel: "AI",
    icon: Bot,
    description: "Context-aware analytics assistant for project decisions.",
  },
];

export const APEX_SECONDARY_NAV: NavItem[] = [
  {
    href: "/team",
    label: "Team Management",
    shortLabel: "Team",
    icon: Users,
    description: "Role-based access, staffing coverage, and activity health.",
  },
  {
    href: "/templates",
    label: "Template Gallery",
    shortLabel: "Templates",
    icon: Boxes,
    description: "Reusable templates for imports, reports, and dashboards.",
  },
  {
    href: "/notifications",
    label: "Notifications",
    shortLabel: "Alerts",
    icon: Bell,
    description: "Milestones, delay alerts, approvals, and mentions.",
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    icon: Settings,
    description: "System preferences, workflow defaults, and integrations.",
  },
  {
    href: "/profile",
    label: "Profile",
    shortLabel: "Profile",
    icon: UserCircle2,
    description: "Personal settings, timezone, and notification controls.",
  },
];

export const HOME_NAV: NavItem[] = [
  {
    href: "/",
    label: "Home",
    shortLabel: "Home",
    icon: Home,
    description: "Platform overview and executive launchpad.",
  },
  ...APEX_PRIMARY_NAV,
  ...APEX_SECONDARY_NAV,
];

export const QUICK_ACTIONS = [
  { label: "Run EVM Forecast", href: "/evm-dashboard", icon: TrendingUp, iconOnly: true },
  { label: "Generate Reports", href: "/reports", icon: FileText, iconOnly: true },
];
