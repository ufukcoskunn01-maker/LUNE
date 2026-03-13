import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Notifications",
  description: "Notifications workspace scaffold.",
};

export default function NotificationsPage() {
  return <AppScaffoldPage title="Notifications" />;
}
