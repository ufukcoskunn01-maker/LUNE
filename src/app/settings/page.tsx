import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Settings",
  description: "Settings workspace scaffold.",
};

export default function SettingsPage() {
  return <AppScaffoldPage title="Settings" />;
}
