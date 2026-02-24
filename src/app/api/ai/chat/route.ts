import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { DAILY_MESSAGE_LIMIT, KNOWLEDGE_MATCH_COUNT } from "@/lib/ai/constants";
import { extractCitationIds, toPgVectorLiteral } from "@/lib/ai/citations";
import { requireAuthenticatedUser } from "@/lib/ai/auth";
import { createEmbedding, generateAssistantAnswer } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatBodySchema = z.object({
  projectCode: z.string().trim().min(1).max(64),
  threadId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(12000),
});

const SYSTEM_PROMPT = [
  "You are LUNE Project Assistant. Use ONLY provided knowledge + user message.",
  "If missing info, ask clarifying questions.",
  "Output in structured bullets.",
  "Always cite knowledge IDs you used at the end: [K:uuid,...]",
].join(" ");

function buildKnowledgeContext(
  rows: Array<{ id: string; title: string; content: string; similarity: number | null }>
): string {
  if (!rows.length) return "No matching knowledge found.";

  return rows
    .map((row) => {
      const content = row.content.replace(/\s+/g, " ").trim().slice(0, 1200);
      const sim = typeof row.similarity === "number" ? row.similarity.toFixed(4) : "n/a";
      return `[K:${row.id}] ${row.title} (sim:${sim})\n${content}`;
    })
    .join("\n\n");
}

function pickCitations(
  answer: string,
  knowledgeRows: Array<{ id: string; title: string }>
): Array<{ id: string; title: string }> {
  const found = new Set(extractCitationIds(answer));
  return knowledgeRows
    .filter((row) => found.has(row.id.toLowerCase()))
    .map((row) => ({ id: row.id, title: row.title }));
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const parsed = ChatBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }

    const { projectCode, threadId, message } = parsed.data;

    const usageGate = await auth.userClient.rpc("increment_ai_usage", {
      p_user_id: auth.user.id,
      p_day: new Date().toISOString().slice(0, 10),
      p_message_inc: 1,
      p_token_inc: 0,
      p_message_limit: DAILY_MESSAGE_LIMIT,
    });

    if (usageGate.error) {
      return NextResponse.json({ ok: false, error: usageGate.error.message }, { status: 500 });
    }

    const usage = Array.isArray(usageGate.data) ? usageGate.data[0] : usageGate.data;
    if (!usage?.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Daily message limit reached (${DAILY_MESSAGE_LIMIT}/day).`,
        },
        { status: 429 }
      );
    }

    let resolvedThreadId = threadId;
    if (resolvedThreadId) {
      const { data: existingThread, error: existingThreadError } = await auth.userClient
        .from("ai_threads")
        .select("id")
        .eq("id", resolvedThreadId)
        .eq("user_id", auth.user.id)
        .eq("project_code", projectCode)
        .maybeSingle();

      if (existingThreadError) {
        return NextResponse.json({ ok: false, error: existingThreadError.message }, { status: 500 });
      }

      if (!existingThread) {
        return NextResponse.json({ ok: false, error: "Thread not found for this project." }, { status: 404 });
      }
    } else {
      const title = message.length > 80 ? `${message.slice(0, 77)}...` : message;
      const { data: createdThread, error: threadCreateError } = await auth.userClient
        .from("ai_threads")
        .insert({
          user_id: auth.user.id,
          project_code: projectCode,
          title,
        })
        .select("id")
        .single();

      if (threadCreateError || !createdThread) {
        return NextResponse.json({ ok: false, error: threadCreateError?.message || "Failed to create thread." }, { status: 500 });
      }

      resolvedThreadId = createdThread.id;
    }

    const { error: userMessageError } = await auth.userClient.from("ai_messages").insert({
      thread_id: resolvedThreadId,
      user_id: auth.user.id,
      role: "user",
      content: message,
    });

    if (userMessageError) {
      return NextResponse.json({ ok: false, error: userMessageError.message }, { status: 500 });
    }

    const queryEmbedding = await createEmbedding(message);
    const vectorLiteral = toPgVectorLiteral(queryEmbedding);

    const knowledgeResult = await auth.userClient.rpc("match_ai_knowledge", {
      query_embedding: vectorLiteral,
      project_code: projectCode,
      match_count: KNOWLEDGE_MATCH_COUNT,
    });

    if (knowledgeResult.error) {
      return NextResponse.json({ ok: false, error: knowledgeResult.error.message }, { status: 500 });
    }

    const knowledgeRows = (knowledgeResult.data || []) as Array<{
      id: string;
      title: string;
      content: string;
      similarity: number | null;
    }>;

    const knowledgeContext = buildKnowledgeContext(knowledgeRows);

    const completion = await generateAssistantAnswer({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: message,
      knowledgeContext,
    });

    const citations = pickCitations(completion.answer, knowledgeRows);

    const { error: assistantInsertError } = await auth.userClient.from("ai_messages").insert({
      thread_id: resolvedThreadId,
      user_id: auth.user.id,
      role: "assistant",
      content: completion.answer,
      tokens: completion.tokens,
      meta: {
        citations,
      },
    });

    if (assistantInsertError) {
      return NextResponse.json({ ok: false, error: assistantInsertError.message }, { status: 500 });
    }

    if (completion.tokens && completion.tokens > 0) {
      await auth.userClient.rpc("increment_ai_usage", {
        p_user_id: auth.user.id,
        p_day: new Date().toISOString().slice(0, 10),
        p_message_inc: 0,
        p_token_inc: completion.tokens,
        p_message_limit: DAILY_MESSAGE_LIMIT,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        threadId: resolvedThreadId,
        answer: completion.answer,
        citations,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected AI chat error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
