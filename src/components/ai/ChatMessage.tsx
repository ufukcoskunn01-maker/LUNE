import { CitationPills } from "@/components/ai/CitationPills";

type Citation = {
  id: string;
  title: string;
};

type ChatMessageProps = {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  citations?: Citation[] | null;
};

export function ChatMessage({ role, content, createdAt, citations }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap",
          isUser ? "border-slate-300 bg-slate-50" : "border-blue-100 bg-white",
        ].join(" ")}
      >
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{role}</div>
        <p>{content}</p>
        <CitationPills citations={citations} />
        <div className="mt-2 text-[11px] text-muted-foreground">{new Date(createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}
