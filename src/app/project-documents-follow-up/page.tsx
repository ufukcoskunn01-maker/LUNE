import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Project Documents Follow-Up",
  description: "Project Documents Follow-Up workspace scaffold.",
};

export default function ProjectDocumentsFollowUpPage() {
  return <AppScaffoldPage title="Project Documents Follow-Up" />;
}
