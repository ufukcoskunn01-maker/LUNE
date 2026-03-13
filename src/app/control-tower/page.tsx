import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Control Tower",
  description: "Control Tower workspace scaffold.",
};

export default function ControlTowerPage() {
  return <AppScaffoldPage title="Control Tower" />;
}
