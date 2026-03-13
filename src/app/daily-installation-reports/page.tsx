import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Daily Installation Reports",
  description: "Daily Installation Reports workspace scaffold.",
};

export default function DailyInstallationReportsPage() {
  return <AppScaffoldPage title="Daily Installation Reports" />;
}
