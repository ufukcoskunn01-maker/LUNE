"use client";

import { Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ai/Markdown";
import { Citations } from "@/components/ai/Citations";
import type { Citation } from "@/lib/ai/client";

type ChatMessageProps = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  citations?: Citation[] | null;
  isStreaming?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

export function ChatMessage({ id, role, content, createdAt, citations, isStreaming, isError, onRetry }: ChatMessageProps) {
  const isUser = role === "user";

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <article
        className={[
          "max-w-[86%] rounded-2xl border px-4 py-3 shadow-sm",
          isUser
            ? "border-border bg-accent"
            : isError
              ? "border-red-200 bg-red-50"
              : "border-border bg-card",
        ].join(" ")}
        aria-live={isStreaming ? "polite" : undefined}
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>{role === "user" ? "You" : role === "assistant" ? "Assistant" : "System"}</span>
          <span>{new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        <Markdown content={content} />

        {isStreaming ? <div className="mt-2 inline-block animate-pulse text-sm text-muted-foreground">▍</div> : null}
        {role === "assistant" ? <Citations citations={citations} /> : null}

        <div className="mt-3 flex items-center gap-2">
          {role !== "user" ? (
            <Button
              type="button"
              aria-label="Copy message"
              onClick={onCopy}
              className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-muted-foreground"
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
          ) : null}

          {isError && onRetry ? (
            <Button
              type="button"
              aria-label="Retry message"
              onClick={onRetry}
              className="h-7 rounded-lg border border-red-200 bg-white px-2 text-xs text-red-700"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry
            </Button>
          ) : null}
        </div>

        <span className="sr-only">message-id:{id}</span>
      </article>
    </div>
  );
}
