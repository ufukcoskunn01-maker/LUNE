export type Citation = {
  id: string;
  title: string;
};

export type AIThread = {
  id: string;
  title: string | null;
  project_code?: string;
  created_at: string;
  updated_at?: string;
  last_message_preview?: string | null;
};

export type AIMessage = {
  id: string;
  thread_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  tokens?: number | null;
  meta?: {
    citations?: Citation[];
  } | null;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

function normalizeRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { rows?: unknown[] }).rows)) {
    return (payload as { rows: T[] }).rows;
  }
  return [];
}

export async function aiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });

  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  if (json.data === undefined) {
    throw new Error("Response payload missing data.");
  }

  return json.data;
}

export async function getThreads(projectCode: string): Promise<AIThread[]> {
  const data = await aiRequest<AIThread[] | { rows: AIThread[] }>(`/api/ai/threads?projectCode=${encodeURIComponent(projectCode)}`);
  return normalizeRows<AIThread>(data);
}

export async function createThread(projectCode: string, title: string): Promise<string> {
  const data = await aiRequest<{ threadId: string }>("/api/ai/thread", {
    method: "POST",
    body: JSON.stringify({ projectCode, title }),
  });
  return data.threadId;
}

export async function getMessages(threadId: string): Promise<AIMessage[]> {
  const data = await aiRequest<AIMessage[] | { rows: AIMessage[] }>(`/api/ai/messages?threadId=${encodeURIComponent(threadId)}`);
  return normalizeRows<AIMessage>(data);
}

export async function sendChat(args: {
  projectCode: string;
  threadId?: string;
  message: string;
  onToken?: (chunk: string) => void;
}): Promise<{ threadId: string; answer: string; citations: Citation[] }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      projectCode: args.projectCode,
      threadId: args.threadId,
      message: args.message,
      stream: true,
    }),
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let errorText = `Request failed (${res.status})`;
    try {
      const err = (await res.json()) as ApiEnvelope<unknown>;
      if (err.error) errorText = err.error;
    } catch {
      // noop
    }
    throw new Error(errorText);
  }

  const isSSE = contentType.includes("text/event-stream");
  if (!isSSE || !res.body) {
    const json = (await res.json()) as ApiEnvelope<{ threadId: string; answer: string; citations?: Citation[] }>;
    if (!json.ok || !json.data) {
      throw new Error(json.error || "Invalid AI response.");
    }

    return {
      threadId: json.data.threadId,
      answer: json.data.answer,
      citations: json.data.citations || [],
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let threadId = args.threadId || "";
  let citations: Citation[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;

      const payloadText = dataLine.replace(/^data:\s*/, "").trim();
      if (!payloadText || payloadText === "[DONE]") continue;

      try {
        const payload = JSON.parse(payloadText) as {
          type?: string;
          token?: string;
          answer?: string;
          threadId?: string;
          citations?: Citation[];
        };

        if (payload.threadId) threadId = payload.threadId;
        if (payload.citations) citations = payload.citations;

        if (payload.type === "token" && payload.token) {
          answer += payload.token;
          args.onToken?.(payload.token);
        }

        if (payload.type === "done" && payload.answer) {
          answer = payload.answer;
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  if (!threadId) {
    throw new Error("Missing thread id from streaming response.");
  }

  return { threadId, answer, citations };
}
