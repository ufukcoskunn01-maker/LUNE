import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Reports",
  description: "Reports workspace scaffold.",
};

export default function ReportsPage() {
  return <AppScaffoldPage title="Reports" />;
}
