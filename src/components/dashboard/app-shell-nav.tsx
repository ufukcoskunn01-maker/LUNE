import type { ReactNode } from "react";

export type AppShellNavItem = {
  href: string;
  label: string;
  sidebarLabel: string;
  icon: ReactNode;
};

export type AppShellNavSection = {
  title: string;
  items: AppShellNavItem[];
};

export const appShellNavSections: AppShellNavSection[] = [
  {
    title: "Track",
    items: [
      { href: "/home", label: "Home", sidebarLabel: "Home", icon: <HomeIcon /> },
      { href: "/dashboard", label: "Dashboard", sidebarLabel: "Dashboard", icon: <DashboardIcon /> },
      { href: "/control-tower", label: "Control Tower", sidebarLabel: "Control", icon: <RadarIcon /> },
      { href: "/projects", label: "Projects", sidebarLabel: "Projects", icon: <ProjectsIcon /> },
      { href: "/project-controls", label: "Project Controls", sidebarLabel: "Controls", icon: <GaugeIcon /> },
      { href: "/evm-dashboard", label: "EVM Dashboard", sidebarLabel: "EVM", icon: <TrendIcon /> },
      { href: "/schedule-comparison", label: "Schedule Comparison", sidebarLabel: "Schedule", icon: <CalendarIcon /> },
      { href: "/daily-personal-reports", label: "Personal Reports", sidebarLabel: "Personal Reports", icon: <UsersIcon /> },
      { href: "/daily-installation-reports", label: "Daily Installation Reports", sidebarLabel: "Installation", icon: <ConstructionIcon /> },
      { href: "/progress", label: "Progress Tracking", sidebarLabel: "Progress", icon: <ProgressIcon /> },
      { href: "/procurement", label: "Procurement", sidebarLabel: "Procurement", icon: <PackageIcon /> },
      { href: "/warehouse", label: "Warehouse Follow-Up", sidebarLabel: "Warehouse", icon: <WarehouseIcon /> },
      { href: "/cable-calculations", label: "Cable Calculations", sidebarLabel: "Cables", icon: <CableIcon /> },
      { href: "/reports", label: "Reports", sidebarLabel: "Reports", icon: <ReportsIcon /> },
      { href: "/project-documents-follow-up", label: "Project Documents Follow-Up", sidebarLabel: "Doc Follow-Up", icon: <ClipboardIcon /> },
      { href: "/ai", label: "AI Assistant", sidebarLabel: "AI", icon: <BotIcon /> },
    ],
  },
  {
    title: "Services",
    items: [
      { href: "/team", label: "Team Management", sidebarLabel: "Team", icon: <UsersIcon /> },
      { href: "/templates", label: "Template Gallery", sidebarLabel: "Templates", icon: <TemplatesIcon /> },
      { href: "/notifications", label: "Notifications", sidebarLabel: "Alerts", icon: <BellIcon /> },
      { href: "/settings", label: "Settings", sidebarLabel: "Settings", icon: <SettingsIcon /> },
      { href: "/profile", label: "Profile", sidebarLabel: "Profile", icon: <ProfileIcon /> },
    ],
  },
];

export const appShellNavItems = appShellNavSections.flatMap((section) => section.items);

function IconBase({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

function HomeIcon() { return <IconBase><path d="M4 10.75 12 4l8 6.75V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></IconBase>; }
function DashboardIcon() { return <IconBase><path d="M4 5.5h7v6H4zm9 0h7v9h-7zM4 13.5h7v5H4zm9 2h7v3h-7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></IconBase>; }
function RadarIcon() { return <IconBase><path d="M12 12 19 5M12 12a7 7 0 1 1-4.95-6.7M12 12l-4.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function ProjectsIcon() { return <IconBase><path d="M4 7.5h7v11H4zm9-3h7v14h-7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></IconBase>; }
function GaugeIcon() { return <IconBase><path d="M5 15a7 7 0 1 1 14 0M12 12l3.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function TrendIcon() { return <IconBase><path d="M5 16.5 10 11l3.2 3.2L19 8.5M14.5 8.5H19v4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function CalendarIcon() { return <IconBase><rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 3.8v3M16 3.8v3M4 9h16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></IconBase>; }
function UsersIcon() { return <IconBase><path d="M9 11a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 9 11Zm6 1.4a2.2 2.2 0 1 0 0-4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M4.8 18c0-2 1.9-3.7 4.2-3.7s4.2 1.7 4.2 3.7M14.3 17.3c.3-1.4 1.6-2.4 3.2-2.4.9 0 1.8.3 2.4.9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function ConstructionIcon() { return <IconBase><path d="M7 4.8 10.2 8 8 10.2 4.8 7M13.8 13.8 19.2 19.2M11 7l6 6M13.8 4.8a3 3 0 0 0 0 4.2l1.2 1.2 4.2-4.2L18 4.8a3 3 0 0 0-4.2 0Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function ProgressIcon() { return <IconBase><path d="M6 18V9M12 18V6M18 18v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M4.5 18.5h15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></IconBase>; }
function PackageIcon() { return <IconBase><path d="m12 3.8 7 4v8.4l-7 4-7-4V7.8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="m5 7.9 7 4 7-4M12 11.9v8.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function WarehouseIcon() { return <IconBase><path d="M4.5 9 12 4l7.5 5v9.5H4.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 13h2.5v5H8zm5.5 0H16v2h-2.5zm0 3H16v2h-2.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></IconBase>; }
function CableIcon() { return <IconBase><path d="M7 7.5a3.5 3.5 0 1 0 0 7h4a3.5 3.5 0 1 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M13 2.5a3.5 3.5 0 1 1 0 7H9a3.5 3.5 0 1 0 0 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></IconBase>; }
function ReportsIcon() { return <IconBase><path d="M7 4.5h7l3 3V19.5H7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 4.5v3h3M9.5 11h5M9.5 14h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></IconBase>; }
function ClipboardIcon() { return <IconBase><rect x="6" y="5.5" width="12" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M9 5.5h6v-1a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5Zm1.5 5h4.5m-4.5 3h4.5m-4.5 3h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></IconBase>; }
function BotIcon() { return <IconBase><rect x="5.5" y="7" width="13" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12 4.2v2.2M9.2 11.2h.01M14.8 11.2h.01M9.5 14.5h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></IconBase>; }
function TemplatesIcon() { return <IconBase><rect x="4.5" y="5" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="5" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="4.5" y="12.5" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="12.5" width="6.5" height="6.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" /></IconBase>; }
function BellIcon() { return <IconBase><path d="M7.5 10.5a4.5 4.5 0 1 1 9 0c0 3.6 1.5 4.8 1.5 4.8H6s1.5-1.2 1.5-4.8ZM10 18a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function SettingsIcon() { return <IconBase><path d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="m19 12-1.4-.5a5.9 5.9 0 0 0-.4-1l.75-1.3-1.45-1.45-1.3.75a5.9 5.9 0 0 0-1-.4L12 5l-1.45.55a5.9 5.9 0 0 0-1 .4l-1.3-.75L6.8 6.65l.75 1.3c-.17.33-.3.66-.4 1L5.8 12l1.35.45c.1.34.23.67.4 1l-.75 1.3 1.45 1.45 1.3-.75c.33.17.66.3 1 .4L12 19l1.45-.55c.34-.1.67-.23 1-.4l1.3.75 1.45-1.45-.75-1.3c.17-.33.3-.66.4-1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function ProfileIcon() { return <IconBase><circle cx="12" cy="8.2" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M5.5 18c.8-2.7 3.3-4.4 6.5-4.4s5.7 1.7 6.5 4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></IconBase>; }
