import { Badge } from "@/components/ui/badge";
import type { Citation } from "@/lib/ai/client";

export function Citations({ citations }: { citations?: Citation[] | null }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {citations.map((citation) => (
        <Badge key={citation.id} className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {citation.title} · {citation.id.slice(0, 8)}
        </Badge>
      ))}
    </div>
  );
}
