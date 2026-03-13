import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Warehouse Follow-Up",
  description: "Warehouse Follow-Up workspace scaffold.",
};

export default function WarehousePage() {
  return <AppScaffoldPage title="Warehouse Follow-Up" />;
}
