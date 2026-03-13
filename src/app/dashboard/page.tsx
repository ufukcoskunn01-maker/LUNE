import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Dashboard",
  description: "Dashboard workspace scaffold.",
};

export default function DashboardPage() {
  return <AppScaffoldPage title="Dashboard" />;
}
