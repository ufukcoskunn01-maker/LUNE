import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type StatusTone = "green" | "yellow" | "orange" | "red" | "blue" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  yellow: "border-yellow-500/35 bg-yellow-500/10 text-yellow-200",
  orange: "border-orange-500/35 bg-orange-500/10 text-orange-200",
  red: "border-red-500/35 bg-red-500/10 text-red-200",
  blue: "border-sky-500/35 bg-sky-500/10 text-sky-200",
  neutral: "border-muted-foreground/25 bg-muted/30 text-muted-foreground",
};

export function StatusBadge({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  return <Badge className={cn(toneClasses[tone], className)}>{label}</Badge>;
}