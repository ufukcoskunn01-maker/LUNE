import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Project Controls",
  description: "Project Controls workspace scaffold.",
};

export default function ProjectControlsPage() {
  return <AppScaffoldPage title="Project Controls" />;
}
