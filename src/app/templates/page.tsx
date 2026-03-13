import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Template Gallery",
  description: "Template Gallery workspace scaffold.",
};

export default function TemplatesPage() {
  return <AppScaffoldPage title="Template Gallery" />;
}
