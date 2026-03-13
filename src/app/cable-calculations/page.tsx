import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Cable Calculations",
  description: "Cable Calculations workspace scaffold.",
};

export default function CableCalculationsPage() {
  return <AppScaffoldPage title="Cable Calculations" />;
}
