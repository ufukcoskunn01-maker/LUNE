import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | EVM Dashboard",
  description: "EVM Dashboard workspace scaffold.",
};

export default function EvmDashboardPage() {
  return <AppScaffoldPage title="EVM Dashboard" />;
}
