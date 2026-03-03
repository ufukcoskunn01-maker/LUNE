"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { Composer } from "@/components/ai/Composer";
import { BackgroundVideo } from "@/components/marketing/BackgroundVideo";
import type { AIMessage, Citation } from "@/lib/ai/client";
import { createThread, sendChat } from "@/lib/ai/client";

const PROJECT_OPTIONS = ["A27", "A25", "A24", "A23", "A22"];

const STORAGE_KEYS = {
  project: "lune:ai:project",
  draftByProject: "lune:ai:draftByProject",
};

function newLocalMessage(args: {
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  isError?: boolean;
}) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: args.role,
    content: args.content,
    created_at: new Date().toISOString(),
    meta: { citations: args.citations || [] },
    __localError: args.isError || false,
  } as AIMessage & { __localError?: boolean };
}

export default function AIPage() {
  const [selectedProjectCode, setSelectedProjectCode] = useState("A27");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<AIMessage & { __localError?: boolean }>>([]);
  const [inputText, setInputText] = useState("");

  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const [sendError, setSendError] = useState<string | null>(null);
  const [authMissing, setAuthMissing] = useState(false);

  const [online, setOnline] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const lastFailedPayloadRef = useRef<{ message: string } | null>(null);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const savedProject = window.localStorage.getItem(STORAGE_KEYS.project);
    if (savedProject && PROJECT_OPTIONS.includes(savedProject)) {
      setSelectedProjectCode(savedProject);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function isAuthErrorMessage(message: string) {
    return message.toLowerCase().includes("not authenticated") || message.toLowerCase().includes("no session");
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.project, selectedProjectCode);
  }, [selectedProjectCode]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEYS.draftByProject);
    if (!raw) {
      setInputText("");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      setInputText(parsed[selectedProjectCode] || "");
    } catch {
      setInputText("");
    }
  }, [selectedProjectCode]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEYS.draftByProject);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[selectedProjectCode] = inputText;
    window.localStorage.setItem(STORAGE_KEYS.draftByProject, JSON.stringify(parsed));
  }, [inputText, selectedProjectCode]);

  useEffect(() => {
    // Fresh session per project: do not show previously saved conversations.
    setSelectedThreadId(null);
    setMessages([]);
    setSendError(null);
  }, [selectedProjectCode]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (!shouldStickToBottomRef.current) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;
  }

  async function handleSend(overrideMessage?: string) {
    const message = (overrideMessage ?? inputText).trim();
    if (!message || sending || authMissing) return;

    setSendError(null);
    setSending(true);
    setStreaming(true);

    let resolvedThreadId = selectedThreadId;

    try {
      if (!resolvedThreadId) {
        resolvedThreadId = await createThread(selectedProjectCode, message.slice(0, 80) || "New thread");
        setSelectedThreadId(resolvedThreadId);
      }

      const optimisticUser = newLocalMessage({ role: "user", content: message });
      const optimisticAssistant = newLocalMessage({ role: "assistant", content: "" });

      setMessages((prev) => [...prev.filter((row) => !row.__localError), optimisticUser, optimisticAssistant]);
      setInputText("");

      lastFailedPayloadRef.current = { message };

      const result = await sendChat({
        projectCode: selectedProjectCode,
        threadId: resolvedThreadId,
        message,
        onToken: (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const index = next.findIndex((row) => row.id === optimisticAssistant.id);
            if (index === -1) return prev;
            const existing = next[index];
            next[index] = { ...existing, content: `${existing.content || ""}${chunk}` };
            return next;
          });
        },
      });

      setMessages((prev) => {
        const next = [...prev];
        const index = next.findIndex((row) => row.id === optimisticAssistant.id);
        if (index === -1) return prev;
        next[index] = {
          ...next[index],
          content: result.answer,
          meta: { citations: result.citations || [] },
        };
        return next;
      });

      if (result.threadId && result.threadId !== selectedThreadId) {
        setSelectedThreadId(result.threadId);
      }

      setAuthMissing(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "AI request failed.";
      setSendError(errorMessage);
      if (isAuthErrorMessage(errorMessage)) {
        setAuthMissing(true);
      }

      setMessages((prev) => {
        const trimmed = prev.filter((row) => row.role !== "assistant" || row.content !== "");
        const errorBubble = newLocalMessage({ role: "system", content: errorMessage, isError: true });
        return [...trimmed, errorBubble];
      });
    } finally {
      setSending(false);
      setStreaming(false);
    }
  }

  async function handleRetryLast() {
    if (!lastFailedPayloadRef.current) return;
    await handleSend(lastFailedPayloadRef.current.message);
  }

  function handleNewThread() {
    setSelectedThreadId(null);
    setMessages([]);
    setSendError(null);
  }

  const sendDisabled = authMissing || !online || sending;

  return (
    <main className="min-h-screen overflow-hidden bg-[#0f1011] text-zinc-100" style={{ fontFamily: '"SuisseIntl", Arial, sans-serif' }}>
      <BackgroundVideo
        mp4Src="/origin/media/68acbc076b672f730e0c77b9/68bb73e8d95f81619ab0f106_Clouds1-transcode.mp4"
        webmSrc="/origin/media/68acbc076b672f730e0c77b9/68bb73e8d95f81619ab0f106_Clouds1-transcode.webm"
        toneOverlayClassName="bg-transparent"
        fadeOverlayClassName="bg-[linear-gradient(180deg,rgba(15,16,17,0)_0%,rgba(15,16,17,0.45)_72%,rgba(15,16,17,0.88)_100%)]"
        className="relative min-h-screen"
      >
        <section className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col items-center px-4 pb-[50px] pt-[180px] text-center">
          <div className="rounded-xl border border-[#d6ebff]/45 bg-[#d9f0ff]/95 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1f6e96]">
            AI Workspace
          </div>

          <h1
            className="mb-6 mt-6 text-[clamp(64px,8vw,96px)] font-light leading-[0.9] text-white"
            style={{ fontFamily: '"LyonDisplay App", Georgia, "Times New Roman", serif' }}
          >
            <span className="italic">Ask</span> your project.
          </h1>

          <div className="mb-6 max-w-[520px]">
            <p className="text-[16px] font-semibold leading-[1.35] text-white">LUNE AI Assistant</p>
            <p className="text-[16px] font-light leading-[1.35] text-white/82">
              Analyze schedule, progress, cost, and execution signals instantly.
            </p>
          </div>

          {authMissing ? (
            <div className="mb-4 w-full max-w-[590px] rounded-xl border border-amber-300/80 bg-amber-50/95 p-3 text-sm text-amber-900">
              Supabase session not found. AI messaging is disabled until you sign in.
            </div>
          ) : null}

          {messages.length > 0 ? (
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="mb-5 max-h-[38vh] w-full max-w-[920px] space-y-3 overflow-auto rounded-[24px] border border-white/15 bg-white/[0.08] p-3 backdrop-blur-xl scrollbar-thin sm:p-4"
            >
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  id={message.id}
                  role={message.role}
                  content={message.content || (streaming && message.role === "assistant" ? "" : " ")}
                  createdAt={message.created_at}
                  citations={message.meta?.citations || []}
                  isStreaming={streaming && message.role === "assistant" && message.id.startsWith("local-")}
                  isError={Boolean(message.__localError)}
                  onRetry={message.__localError ? handleRetryLast : undefined}
                />
              ))}
            </div>
          ) : null}

          {sendError ? <p className="mb-3 text-xs text-red-100">Send failed: {sendError}</p> : null}

          <div className="w-full max-w-[590px]">
            <Composer value={inputText} onChange={setInputText} onSubmit={() => handleSend()} disabled={sendDisabled} sending={sending} />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleNewThread}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.1] px-3 py-1.5 text-[11px] text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                New Thread
              </button>
              <select
                value={selectedProjectCode}
                onChange={(event) => setSelectedProjectCode(event.target.value)}
                className="h-8 rounded-full border border-white/20 bg-white/[0.1] px-3.5 text-[11px] text-white outline-none"
                aria-label="Select project"
              >
                {PROJECT_OPTIONS.map((projectCode) => (
                  <option key={projectCode} value={projectCode}>
                    {projectCode}
                  </option>
                ))}
              </select>
              <span className={`text-[11px] ${online ? "text-emerald-200" : "text-red-200"}`}>{online ? "Online" : "Offline"}</span>
            </div>
          </div>
        </section>
      </BackgroundVideo>
    </main>
  );
}
