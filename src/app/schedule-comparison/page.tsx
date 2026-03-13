import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Schedule Comparison",
  description: "Schedule Comparison workspace scaffold.",
};

export default function ScheduleComparisonPage() {
  return <AppScaffoldPage title="Schedule Comparison" />;
}
