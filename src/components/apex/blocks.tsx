import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeading({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card/90 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        {badge ? (
          <div className="rounded-xl border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">{badge}</div>
        ) : null}
      </div>
    </div>
  );
}

export function StatCard({
  title,
  value,
  delta,
  note,
  trend,
}: {
  title: string;
  value: string;
  delta: string;
  note: string;
  trend?: "up" | "down" | "flat";
}) {
  const icon =
    trend === "up" ? (
      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
    ) : trend === "down" ? (
      <ArrowDownRight className="h-4 w-4 text-red-500" />
    ) : (
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    );

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {icon}
        <span className="font-medium">{delta}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function DataCard({
  title,
  description,
  right,
  children,
  className,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
