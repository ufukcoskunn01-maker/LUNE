"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAiRoute = pathname === "/ai";

  return (
    <div className={cn("relative flex min-h-screen overflow-x-hidden bg-background", isAiRoute && "block bg-transparent")}>
      {!isAiRoute ? (
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(2,132,199,0.12),transparent_40%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.1),transparent_38%)]" />
        </div>
      ) : null}

      {!isAiRoute ? <Sidebar /> : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {!isAiRoute ? <Topbar /> : null}
        <main className={cn("min-w-0 max-w-full overflow-x-hidden", isAiRoute ? "p-0" : "px-4 py-6 md:px-6")}>{children}</main>
      </div>
    </div>
  );
}
