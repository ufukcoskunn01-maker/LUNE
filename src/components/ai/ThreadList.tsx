"use client";

type ThreadItem = {
  id: string;
  title: string | null;
  last_message_preview?: string | null;
  updated_at?: string;
  created_at: string;
};

type ThreadListProps = {
  items: ThreadItem[];
  activeThreadId: string | null;
  loading?: boolean;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
};

export function ThreadList({ items, activeThreadId, loading, onSelect, onCreate }: ThreadListProps) {
  if (loading) {
    return <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">Loading threads...</div>;
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
        <p className="text-sm font-medium">No threads yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Start a new conversation for this project context.</p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          New thread
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((thread) => {
        const updatedAt = thread.updated_at || thread.created_at;

        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            aria-label={`Open thread ${thread.title || "Untitled thread"}`}
            className={[
              "w-full rounded-xl border px-3 py-2.5 text-left shadow-sm transition focus-visible:ring-2 focus-visible:ring-ring",
              activeThreadId === thread.id ? "border-primary/30 bg-accent" : "border-border bg-card hover:bg-accent/50",
            ].join(" ")}
          >
            <div className="line-clamp-1 text-sm font-medium">{thread.title || "Untitled thread"}</div>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {thread.last_message_preview || "No messages yet"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">{new Date(updatedAt).toLocaleString()}</div>
          </button>
        );
      })}
    </div>
  );
}
