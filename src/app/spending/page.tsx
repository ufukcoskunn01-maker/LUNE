import type { Metadata } from "next";

import { SpendingPage } from "@/components/spending/SpendingPage";

export const metadata: Metadata = {
  title: "Lune | Spending",
  description: "Spending dashboard inspired by the provided Origin references.",
};

export default function SpendingRoute() {
  return <SpendingPage />;
}
