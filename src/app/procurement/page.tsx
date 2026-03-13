import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Procurement",
  description: "Procurement workspace scaffold.",
};

export default function ProcurementPage() {
  return <AppScaffoldPage title="Procurement" />;
}
