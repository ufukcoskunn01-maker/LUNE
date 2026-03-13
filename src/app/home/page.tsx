import type { Metadata } from "next";

import { Home } from "@/components/dashboard/Home";

export const metadata: Metadata = {
  title: "Lune | Home",
  description: "Lune home dashboard.",
};

export default function HomePage() {
  return <Home />;
}
