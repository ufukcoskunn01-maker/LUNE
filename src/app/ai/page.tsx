import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | AI Assistant",
  description: "AI Assistant workspace scaffold.",
};

export default function AiPage() {
  return <AppScaffoldPage title="AI Assistant" />;
}
