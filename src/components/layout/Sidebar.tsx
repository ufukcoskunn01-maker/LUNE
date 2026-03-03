"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { APEX_PRIMARY_NAV } from "@/lib/apex-nav";
import { Home } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 bg-background/95 backdrop-blur transition-[width,padding] duration-300",
        expanded ? "w-[290px] p-4" : "w-[84px] p-2"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={cn(
          "transition-all duration-300",
          expanded ? "rounded-2xl border border-white/10 bg-card p-4 shadow-sm" : "px-0 py-1"
        )}
      >
        <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
          <div
            className={cn(
              "flex items-center justify-center rounded-xl border border-white/20 bg-background transition-all duration-300",
              expanded ? "h-9 w-9" : "h-12 w-12"
            )}
          >
            <Image src="/brand/lune-logo-mark.svg" alt="LUNE logo" width={expanded ? 22 : 30} height={expanded ? 13 : 18} />
          </div>
          <div className={cn("overflow-hidden transition-all duration-300", expanded ? "max-w-[190px] opacity-100" : "max-w-0 opacity-0")}>
            <div className="text-sm font-semibold leading-4">LUNE PM Platform</div>
            <div className="text-xs text-muted-foreground">Enterprise Construction Controls</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1 rounded-2xl border border-white/10 bg-card p-2 shadow-sm">
        <Link
          href="/"
          className={cn(
            "mb-2 flex items-center rounded-xl py-2 text-sm transition",
            expanded ? "gap-2 px-3" : "justify-center px-0",
            pathname === "/" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
          )}
          title="Home"
        >
          <Home className="h-4 w-4" />
          {expanded ? <span>Home</span> : null}
        </Link>

        {expanded ? <div className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Track</div> : null}
        <nav className="space-y-1">
          {APEX_PRIMARY_NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-xl py-2 text-sm transition",
                  expanded ? "gap-2 px-3" : "justify-center px-0",
                  active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
                {expanded ? <span className="truncate">{item.shortLabel}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
