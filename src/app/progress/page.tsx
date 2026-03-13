import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Progress Tracking",
  description: "Progress Tracking workspace scaffold.",
};

export default function ProgressPage() {
  return <AppScaffoldPage title="Progress Tracking" />;
}
