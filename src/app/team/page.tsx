import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Team Management",
  description: "Team Management workspace scaffold.",
};

export default function TeamPage() {
  return <AppScaffoldPage title="Team Management" />;
}
