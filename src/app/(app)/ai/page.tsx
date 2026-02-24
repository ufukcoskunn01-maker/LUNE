"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { ThreadList } from "@/components/ai/ThreadList";
import { getAccessToken } from "@/lib/ai/client-auth";

const PROJECT_STORAGE_KEY = "lune:selected-project";
const PROJECT_OPTIONS = ["A27", "A25", "A24", "A23", "A22"];

type ThreadItem = {
  id: string;
  title: string | null;
  project_code: string;
  created_at: string;
};

type Citation = {
  id: string;
  title: string;
};

type MessageItem = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  meta?: {
    citations?: Citation[];
  } | null;
};

async function apiCall<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  return json.data as T;
}

export default function AIPage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [projectCode, setProjectCode] = useState("A27");
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState((searchParams.get("question") || "").trim());
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAccessToken().then((nextToken) => setToken(nextToken));

    const storedProject = typeof window !== "undefined" ? window.localStorage.getItem(PROJECT_STORAGE_KEY) : null;
    if (storedProject) {
      setProjectCode(storedProject.split(" ").at(-1) || "A27");
    }

    const onProjectChange = (event: Event) => {
      const detail = (event as CustomEvent<{ projectCode?: string }>).detail;
      if (detail?.projectCode) {
        setProjectCode(detail.projectCode);
      }
    };

    window.addEventListener("lune:project-change", onProjectChange as EventListener);
    return () => window.removeEventListener("lune:project-change", onProjectChange as EventListener);
  }, []);

  const loadThreads = useCallback(async () => {
    if (!token) return;
    setLoadingThreads(true);
    setError(null);

    try {
      const data = await apiCall<ThreadItem[]>(`/api/ai/threads?projectCode=${encodeURIComponent(projectCode)}`, token);
      setThreads(data);

      if (data.length === 0) {
        setActiveThreadId(null);
        setMessages([]);
      } else if (!activeThreadId || !data.find((item) => item.id === activeThreadId)) {
        setActiveThreadId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load threads.");
    } finally {
      setLoadingThreads(false);
    }
  }, [token, projectCode, activeThreadId]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (!token) return;
      setLoadingMessages(true);
      setError(null);

      try {
        const data = await apiCall<MessageItem[]>(`/api/ai/messages?threadId=${encodeURIComponent(threadId)}`, token);
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  const canSend = useMemo(() => !!token && !!input.trim() && !sending, [token, input, sending]);

  async function onSend() {
    if (!token) {
      setError("You must be authenticated to use AI assistant.");
      return;
    }

    const message = input.trim();
    if (!message) return;

    setSending(true);
    setError(null);

    try {
      const data = await apiCall<{ threadId: string }>("/api/ai/chat", token, {
        method: "POST",
        body: JSON.stringify({
          projectCode,
          threadId: activeThreadId || undefined,
          message,
        }),
      });

      setInput("");

      if (data.threadId !== activeThreadId) {
        setActiveThreadId(data.threadId);
      }

      await loadThreads();
      await loadMessages(data.threadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Threads</CardTitle>
          <CardDescription>Project-specific AI conversation history.</CardDescription>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Project
            <select
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            >
              {PROJECT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-auto p-4">
          {loadingThreads ? <div className="text-sm text-muted-foreground">Loading threads...</div> : null}
          <ThreadList items={threads} activeThreadId={activeThreadId} onSelect={setActiveThreadId} />
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>LUNE AI Assistant</CardTitle>
          <CardDescription>
            Uses project knowledge context with citations. Daily limit: 200 messages per user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="max-h-[58vh] space-y-3 overflow-auto rounded-xl border bg-muted/20 p-3">
            {loadingMessages ? <div className="text-sm text-muted-foreground">Loading messages...</div> : null}
            {!loadingMessages && messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">Start by sending your first project question.</div>
            ) : null}
            {messages.map((item) => (
              <ChatMessage
                key={item.id}
                role={item.role}
                content={item.content}
                createdAt={item.created_at}
                citations={item.meta?.citations}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about schedule, cost, risk, or controls insights..."
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) onSend();
                }
              }}
            />
            <Button type="button" onClick={onSend} disabled={!canSend} className="min-w-[90px]">
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>

          {error ? <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
          {!token ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
              No authenticated Supabase session found. Sign in to use AI routes.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
