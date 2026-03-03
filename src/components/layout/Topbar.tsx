"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronRight,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  FolderKanban,
  MapPin,
  Search,
  LogOut,
  Sun,
  User,
  Wind,
} from "lucide-react";
import { HOME_NAV, QUICK_ACTIONS } from "@/lib/apex-nav";
import { cn } from "@/lib/cn";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function titleFromPath(pathname: string): string {
  const navItem = HOME_NAV.find((item) => item.href === pathname);
  if (navItem) return navItem.label;
  if (pathname.startsWith("/projects/")) return "Project Detail";
  return "Workspace";
}

type WeatherSnapshot = {
  tempC: number | null;
  windMs: number | null;
  conditionCode: string | null;
};

const DEFAULT_WEATHER: WeatherSnapshot = {
  tempC: null,
  windMs: null,
  conditionCode: null,
};

const PROJECT_OPTIONS = [
  "SberCity A27",
  "SberCity A25",
  "SberCity A24",
  "SberCity A23",
  "SberCity A22",
] as const;

const PROJECT_STORAGE_KEY = "lune:selected-project";

function getConditionIcon(conditionCode: string | null) {
  const normalizedCode = conditionCode?.toLowerCase().replaceAll("_", "-") ?? null;
  if (!normalizedCode) return <Sun className="h-3.5 w-3.5 text-amber-300" />;
  if (normalizedCode.includes("thunder")) return <CloudLightning className="h-3.5 w-3.5 text-violet-300" />;
  if (normalizedCode.includes("snow") || normalizedCode === "hail") return <CloudSnow className="h-3.5 w-3.5 text-sky-300" />;
  if (normalizedCode.includes("rain") || normalizedCode === "drizzle" || normalizedCode.includes("showers")) {
    return <CloudRain className="h-3.5 w-3.5 text-sky-300" />;
  }
  if (normalizedCode === "partly-cloudy") return <CloudSun className="h-3.5 w-3.5 text-amber-300" />;
  if (normalizedCode === "clear") return <Sun className="h-3.5 w-3.5 text-amber-300" />;
  return <Cloud className="h-3.5 w-3.5 text-zinc-300" />;
}

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [weather, setWeather] = useState<WeatherSnapshot>(DEFAULT_WEATHER);
  const [now, setNow] = useState<Date | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>(PROJECT_OPTIONS[0]);
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      try {
        const res = await fetch("/api/weather/moscow", { cache: "no-store" });
        if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);

        const json = (await res.json()) as {
          ok?: boolean;
          data?: { tempC?: number | null; windMs?: number | null; condition?: string | null };
        };
        if (!json.ok) throw new Error("Weather payload is not ok");

        if (!cancelled) {
          setWeather({
            tempC: typeof json.data?.tempC === "number" ? json.data.tempC : null,
            windMs: typeof json.data?.windMs === "number" ? json.data.windMs : null,
            conditionCode: typeof json.data?.condition === "string" ? json.data.condition : null,
          });
        }
      } catch {
        if (!cancelled) {
          setWeather({
            tempC: null,
            windMs: null,
            conditionCode: null,
          });
        }
      }
    }

    loadWeather();
    const id = setInterval(loadWeather, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(PROJECT_STORAGE_KEY) : null;
    if (stored && PROJECT_OPTIONS.includes(stored as (typeof PROJECT_OPTIONS)[number])) {
      setSelectedProject(stored);
    }
  }, []);

  const weatherText = useMemo(() => {
    const temp = weather.tempC === null ? "--" : `${Math.round(weather.tempC)}°C`;
    const wind = weather.windMs === null ? "--" : `${weather.windMs.toFixed(1)} m/s`;
    return { temp, wind };
  }, [weather]);

  const topbarDateText = useMemo(() => {
    if (!now) return "--";
    return now.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  }, [now]);

  function handleProjectSelect(projectName: (typeof PROJECT_OPTIONS)[number]) {
    setSelectedProject(projectName);
    setProjectDrawerOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, projectName);
      window.dispatchEvent(
        new CustomEvent("lune:project-change", {
          detail: {
            projectName,
            projectCode: projectName.split(" ").at(-1) ?? projectName,
          },
        })
      );
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <div className="hidden items-center text-xs text-muted-foreground md:flex">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <ChevronRight className="mx-1 h-3 w-3" />
            <span className="text-foreground">{title}</span>
          </div>

          <div className="hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects, docs, people..."
              className="w-64 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm lg:inline-flex">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span suppressHydrationWarning>{topbarDateText}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-2.5 py-2 text-[11px] sm:gap-2 sm:px-3 sm:text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Moscow</span>
            {getConditionIcon(weather.conditionCode)}
            <span>{weatherText.temp}</span>
            <Wind className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline-block" />
            <span className="hidden sm:inline">{weatherText.wind}</span>
          </span>

          <div className="hidden items-center gap-1 xl:flex">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  action.iconOnly
                    ? "inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-card hover:bg-accent/40"
                    : "inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-medium hover:bg-accent/40"
                )}
                title={action.label}
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.iconOnly ? null : <span>{action.label}</span>}
              </Link>
            ))}
          </div>

          <Sheet open={projectDrawerOpen} onOpenChange={setProjectDrawerOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                title={`Project Drawer (${selectedProject})`}
                aria-label="Project drawer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-card hover:bg-accent/40"
              >
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] p-0 sm:max-w-[340px]">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle>Projects</SheetTitle>
                <SheetDescription>Select a project context for this workspace.</SheetDescription>
              </SheetHeader>
              <div className="p-4">
                <div className="space-y-2">
                  {PROJECT_OPTIONS.map((projectName) => {
                    const active = projectName === selectedProject;
                    return (
                      <button
                        key={projectName}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                          active ? "border-white/30 bg-accent text-accent-foreground" : "hover:bg-accent/40"
                        )}
                        onClick={() => handleProjectSelect(projectName)}
                      >
                        <span>{projectName}</span>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="User menu"
                aria-label="User menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-card hover:bg-accent/40"
              >
                <User className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={signingOut}
                onClick={() => {
                  void handleSignOut();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {signingOut ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
