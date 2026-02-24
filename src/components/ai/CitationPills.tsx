import { Badge } from "@/components/ui/badge";

type Citation = {
  id: string;
  title: string;
};

export function CitationPills({ citations }: { citations?: Citation[] | null }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {citations.map((citation) => (
        <Badge key={citation.id} className="border-blue-200 bg-blue-50 text-[11px] text-blue-900">
          {citation.title} ({citation.id.slice(0, 8)})
        </Badge>
      ))}
    </div>
  );
}
