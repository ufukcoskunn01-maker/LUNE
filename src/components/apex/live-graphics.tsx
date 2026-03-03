"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  CalendarRange,
  Coffee,
  Film,
  HandCoins,
  ShoppingBasket,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import type {
  AllocationItem,
  BudgetLine,
  ForecastCurvePoint,
  MomentumPoint,
  SpendDay,
  TransactionItem,
} from "@/lib/apex-live-data";
import { cn } from "@/lib/cn";

const valueCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const valueDetailed = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatCompact(value: number): string {
  return valueCompact.format(value);
}

function formatMoney(value: number): string {
  return valueDetailed.format(value);
}

function amountLabel(value: number): string {
  if (value === 0) return "-";
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value}`;
}

function useChartsReady(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function SafeResponsiveContainer({ children }: { children: ReactNode }) {
  const ready = useChartsReady();
  if (!ready) return null;
  return <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>;
}

function LiveCard({
  title,
  right,
  className,
  children,
}: {
  title: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border border-white/15 bg-[radial-gradient(circle_at_10%_0%,rgba(56,189,248,0.12),transparent_45%),linear-gradient(180deg,#0b0f17_0%,#05070d_100%)] text-zinc-100 shadow-[0_25px_60px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-300">{title}</p>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ForecastCurveCard({
  data,
  currentValue,
  futureValue,
  futureDelta,
  className,
}: {
  data: ForecastCurvePoint[];
  currentValue: number;
  futureValue: number;
  futureDelta: number;
  className?: string;
}) {
  return (
    <LiveCard
      title="Program Value Trajectory"
      className={className}
      right={
        <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">
          <CalendarRange className="h-4 w-4" />
          Scenario: Growth + cost control
        </span>
      }
    >
      <div className="grid gap-4 px-6 pb-5 pt-5 md:grid-cols-2">
        <div>
          <p className="text-sm text-zinc-300">Current program value</p>
          <p className="mt-1 text-4xl font-semibold">{formatCompact(currentValue)}</p>
        </div>
        <div className="md:text-right">
          <p className="text-sm text-zinc-300">Projected value by 2032</p>
          <p className="mt-1 text-4xl font-semibold">
            {formatCompact(futureValue)} <ArrowUpRight className="inline h-7 w-7 text-emerald-300" />
          </p>
          <p className="mt-1 text-lg font-medium text-emerald-300">+{formatCompact(futureDelta)} uplift</p>
        </div>
      </div>

      <div className="h-[320px] px-2 pb-4">
        <SafeResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 24, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="forecast-live-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2ea7ff" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#2ea7ff" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.14)" strokeDasharray="4 4" />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
              tickFormatter={(value) => `$${value}M`}
            />
            <Tooltip
              formatter={(value: number) => `${value}M`}
              contentStyle={{
                background: "#05070d",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 12,
                color: "#fff",
              }}
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="rgba(255,255,255,0.55)"
              strokeDasharray="6 4"
              strokeWidth={1.8}
              dot={false}
              name="Target"
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#2ea7ff"
              fill="url(#forecast-live-fill)"
              strokeWidth={3}
              dot={false}
              name="Actual"
            />
            <Legend wrapperStyle={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }} />
          </AreaChart>
        </SafeResponsiveContainer>
      </div>

      <div className="border-t border-white/10 px-6 py-4 text-sm text-zinc-300">
        Forecast assumes current productivity recovery, pending procurement acceleration, and no additional scope changes.
      </div>
    </LiveCard>
  );
}

export function SpendCalendarCard({
  days,
  total,
  monthLabel = "May 2026",
  className,
}: {
  days: SpendDay[];
  total: number;
  monthLabel?: string;
  className?: string;
}) {
  const startOffset = 0;
  const byDay = new Map(days.map((item) => [item.day, item.amount]));
  const maxAmount = Math.max(1, ...days.map((item) => item.amount));

  const cells: Array<number | null> = [
    ...Array.from({ length: startOffset }, () => null as number | null),
    ...Array.from({ length: 31 }, (_, index) => index + 1),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return (
    <LiveCard
      title="Spend This Month"
      className={className}
      right={
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">{monthLabel}</span>
          <button
            type="button"
            aria-label="Spark controls"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/25 text-indigo-300"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="px-6 py-5">
        <p className="text-5xl font-semibold">{formatCompact(total)}</p>
        <p className="mt-1 text-sm text-zinc-300">Tracked spend across all synced project accounts</p>
      </div>

      <div className="grid grid-cols-7 gap-1.5 px-6 pb-6">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-[76px] rounded-xl border border-transparent" />;
          }

          const amount = byDay.get(day) ?? 0;
          const intensity = amount > 0 ? Math.max(0.14, amount / maxAmount) : 0;
          const activeClass =
            amount > 0
              ? "border-sky-500/60 bg-sky-900/65 text-zinc-100"
              : "border-white/10 bg-black/25 text-zinc-300";

          return (
            <div
              key={day}
              className={cn("h-[76px] rounded-xl border p-3 transition-colors", activeClass)}
              style={amount > 0 ? { boxShadow: `inset 0 0 0 999px rgba(14, 165, 233, ${intensity * 0.34})` } : undefined}
            >
              <p className="text-lg leading-none">{day}</p>
              <p className="mt-2 text-[1rem] font-medium">{amountLabel(amount)}</p>
            </div>
          );
        })}
      </div>
    </LiveCard>
  );
}

function TransactionIcon({ type }: { type: TransactionItem["icon"] }) {
  const common = "h-4 w-4";
  if (type === "coffee") return <Coffee className={common} />;
  if (type === "film") return <Film className={common} />;
  if (type === "store") return <ShoppingBasket className={common} />;
  if (type === "wallet") return <HandCoins className={common} />;
  if (type === "truck") return <Truck className={common} />;
  return <Wrench className={common} />;
}

export function TransactionFeedCard({
  items,
  className,
}: {
  items: TransactionItem[];
  className?: string;
}) {
  return (
    <LiveCard title="Latest Transactions" className={className}>
      <div className="divide-y divide-white/10">
        {items.map((item) => {
          const outgoing = item.direction === "out";
          return (
            <article key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4">
              <div
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full border",
                  outgoing ? "border-orange-400/55 bg-orange-500/10 text-orange-300" : "border-emerald-400/55 bg-emerald-500/10 text-emerald-300"
                )}
              >
                <TransactionIcon type={item.icon} />
              </div>
              <div>
                <p className="text-2xl text-lg font-medium">{item.label}</p>
                <p className="text-sm text-zinc-400">
                  {item.date} • {item.category}
                </p>
              </div>
              <p className={cn("text-xl text-lg font-semibold", outgoing ? "text-zinc-100" : "text-emerald-300")}>
                {outgoing ? "-" : "+"}
                {formatMoney(item.amount)}
              </p>
            </article>
          );
        })}
      </div>
    </LiveCard>
  );
}

export function BudgetTrackerCard({
  lines,
  totalSpent,
  totalLimit,
  className,
}: {
  lines: BudgetLine[];
  totalSpent: number;
  totalLimit: number;
  className?: string;
}) {
  const totalPct = Math.min(100, (totalSpent / totalLimit) * 100);

  return (
    <LiveCard title="Budget" className={className}>
      <div className="space-y-7 px-6 py-6">
        <div>
          <div className="flex items-end justify-between gap-3">
            <p className="text-xl text-3xl font-semibold">Total Budget</p>
            <p className="text-lg text-zinc-200">
              {formatCompact(totalSpent)} of {formatCompact(totalLimit)}
            </p>
          </div>
          <div className="mt-3 h-3 rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-lime-400/80" style={{ width: `${totalPct}%` }} />
          </div>
          <p className="mt-2 text-right text-sm text-zinc-300">{totalPct.toFixed(1)}%</p>
        </div>

        {lines.map((line) => {
          const spentPct = Math.min(100, (line.spent / line.limit) * 100);
          const forecastPct = Math.min(100, (line.forecast / line.limit) * 100);
          return (
            <div key={line.label}>
              <div className="flex items-end justify-between gap-3">
                <p className="text-lg font-medium">{line.label}</p>
                <p className="text-sm text-zinc-300">{spentPct.toFixed(1)}%</p>
              </div>
              <div className="mt-3 h-3 rounded-full bg-zinc-800">
                <div className="relative h-full rounded-full" style={{ width: `${forecastPct}%` }}>
                  <div
                    className="absolute inset-0 rounded-full border border-dashed opacity-70"
                    style={{ borderColor: line.color }}
                  />
                  <div className="h-full rounded-full" style={{ width: `${(spentPct / forecastPct) * 100 || 0}%`, backgroundColor: line.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </LiveCard>
  );
}

export function AllocationRiskCard({
  items,
  className,
}: {
  items: AllocationItem[];
  className?: string;
}) {
  return (
    <LiveCard
      title="Asset & Risk"
      className={className}
      right={
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/20 text-indigo-300"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      }
    >
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-center gap-1">
          {items.map((item) => (
            <div key={item.name} className="h-3 rounded-full" style={{ backgroundColor: item.color, width: `${Math.max(6, item.share)}%` }} />
          ))}
        </div>
      </div>
      <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.name} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-medium">{item.name}</p>
                <p className="text-sm text-zinc-400">{item.share}% share</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{formatCompact(item.amount)}</p>
                <p className={cn("text-sm", item.delta >= 0 ? "text-emerald-300" : "text-red-300")}>
                  {item.delta >= 0 ? "+" : ""}
                  {item.delta.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LiveCard>
  );
}

export function MomentumCard({
  data,
  title = "Spend Last 30D",
  value,
  deltaPct,
  className,
}: {
  data: MomentumPoint[];
  title?: string;
  value: number;
  deltaPct: number;
  className?: string;
}) {
  return (
    <LiveCard
      title={title}
      className={className}
      right={
        <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/25 text-indigo-300">
          <Sparkles className="h-4 w-4" />
        </button>
      }
    >
      <div className="px-6 pt-5">
        <p className="text-5xl font-semibold">{formatCompact(value)}</p>
        <p className={cn("mt-2 text-xl text-lg font-medium", deltaPct >= 0 ? "text-emerald-300" : "text-red-300")}>
          {deltaPct >= 0 ? "+" : ""}
          {deltaPct.toFixed(1)}%
        </p>
      </div>
      <div className="h-[320px] px-2 pb-4 pt-2">
        <SafeResponsiveContainer>
          <LineChart data={data} margin={{ top: 14, right: 18, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="momentum-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2ea7ff" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#2ea7ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }} />
            <YAxis hide />
            <Tooltip
              formatter={(v: number) => formatCompact(v * 1000)}
              contentStyle={{
                background: "#05070d",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 12,
              }}
            />
            <Area type="monotone" dataKey="current" stroke="transparent" fill="url(#momentum-fill)" />
            <Line type="monotone" dataKey="previous" stroke="rgba(255,255,255,0.55)" strokeDasharray="6 4" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="current" stroke="#2ea7ff" dot={false} strokeWidth={3} />
          </LineChart>
        </SafeResponsiveContainer>
      </div>
    </LiveCard>
  );
}

export function AllocationDonutCard({
  items,
  totalLabel,
  className,
}: {
  items: AllocationItem[];
  totalLabel: string;
  className?: string;
}) {
  return (
    <LiveCard title="Category Breakdown" className={className}>
      <div className="grid gap-4 p-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="h-[330px]">
          <SafeResponsiveContainer>
            <PieChart>
              <Pie data={items} dataKey="share" nameKey="name" innerRadius={84} outerRadius={126} paddingAngle={2}>
                {items.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value}%`} contentStyle={{ background: "#05070d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12 }} />
              <Legend wrapperStyle={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }} />
            </PieChart>
          </SafeResponsiveContainer>
        </div>
        <div className="space-y-3">
          <p className="text-4xl font-semibold">{totalLabel}</p>
          {items.map((item) => (
            <div key={item.name} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-zinc-100">{item.name}</span>
                </div>
                <span className="text-sm text-zinc-300">{formatCompact(item.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LiveCard>
  );
}
