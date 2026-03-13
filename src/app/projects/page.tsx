import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Projects",
  description: "Projects workspace scaffold.",
};

export default function ProjectsPage() {
  return <AppScaffoldPage title="Projects" />;
}
