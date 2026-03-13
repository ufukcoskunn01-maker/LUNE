import type { Metadata } from "next";

import { AppScaffoldPage } from "@/components/dashboard/AppScaffoldPage";

export const metadata: Metadata = {
  title: "Lune | Profile",
  description: "Profile workspace scaffold.",
};

export default function ProfilePage() {
  return <AppScaffoldPage title="Profile" />;
}
