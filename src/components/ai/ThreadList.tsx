type ThreadItem = {
  id: string;
  title: string | null;
  created_at: string;
};

type ThreadListProps = {
  items: ThreadItem[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void;
};

export function ThreadList({ items, activeThreadId, onSelect }: ThreadListProps) {
  if (!items.length) {
    return <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">No threads yet.</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((thread) => (
        <button
          key={thread.id}
          type="button"
          onClick={() => onSelect(thread.id)}
          className={[
            "w-full rounded-xl border p-3 text-left text-sm transition",
            activeThreadId === thread.id ? "border-blue-200 bg-blue-50" : "hover:bg-accent/40",
          ].join(" ")}
        >
          <div className="line-clamp-2 font-medium">{thread.title || "Untitled thread"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{new Date(thread.created_at).toLocaleString()}</div>
        </button>
      ))}
    </div>
  );
}
