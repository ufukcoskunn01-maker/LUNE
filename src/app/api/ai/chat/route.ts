import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { DAILY_MESSAGE_LIMIT, KNOWLEDGE_MATCH_COUNT } from "@/lib/ai/constants";
import { extractCitationIds, toPgVectorLiteral } from "@/lib/ai/citations";
import { createEmbedding, generateAssistantAnswer } from "@/lib/ai/openai";
import { requireRouteUser, type RouteSupabaseClient } from "@/lib/ai/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatBodySchema = z.object({
  projectCode: z.string().trim().min(1).max(64),
  threadId: z.string().optional(),
  message: z.string().trim().min(1).max(12000),
});

const SYSTEM_PROMPT = [
  "You are LUNE Project Assistant. Use ONLY provided knowledge + user message.",
  "If missing info, ask clarifying questions.",
  "Output in structured bullets.",
  "Always cite knowledge IDs you used at the end: [K:uuid,...]",
].join(" ");

function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

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

async function incrementUsageSafe(args: {
  supabase: RouteSupabaseClient;
  userId: string;
  day: string;
  messageInc: number;
  tokenInc: number;
  messageLimit: number;
}) {
  const rpcResult = await args.supabase.rpc("increment_ai_usage", {
    p_user_id: args.userId,
    p_day: args.day,
    p_message_inc: args.messageInc,
    p_token_inc: args.tokenInc,
    p_message_limit: args.messageLimit,
  });

  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    return {
      ok: true as const,
      allowed: Boolean(row?.allowed),
      messages_count: Number(row?.messages_count || 0),
      tokens_count: Number(row?.tokens_count || 0),
    };
  }

  const isMissingFn =
    rpcResult.error.message.includes("Could not find the function public.increment_ai_usage") ||
    rpcResult.error.message.includes("function public.increment_ai_usage");

  if (!isMissingFn) {
    return { ok: false as const, error: rpcResult.error.message };
  }

  const isMissingUsageTableError = (message: string) =>
    message.includes("Could not find the table 'public.ai_usage_daily'") || message.includes("relation \"ai_usage_daily\" does not exist");

  const dayStart = `${args.day}T00:00:00.000Z`;
  const dayEndDate = new Date(`${args.day}T00:00:00.000Z`);
  dayEndDate.setUTCDate(dayEndDate.getUTCDate() + 1);
  const dayEnd = dayEndDate.toISOString();

  const { data: existing, error: existingError } = await args.supabase
    .from("ai_usage_daily")
    .select("messages_count,tokens_count")
    .eq("user_id", args.userId)
    .eq("day", args.day)
    .maybeSingle();

  if (existingError) {
    if (isMissingUsageTableError(existingError.message)) {
      const { count, error: countError } = await args.supabase
        .from("ai_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", args.userId)
        .eq("role", "user")
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd);

      if (countError) {
        return { ok: false as const, error: countError.message };
      }

      const currentMessages = Number(count || 0);
      const nextMessages = currentMessages + Math.max(args.messageInc, 0);
      if (nextMessages > args.messageLimit) {
        return {
          ok: true as const,
          allowed: false,
          messages_count: currentMessages,
          tokens_count: 0,
        };
      }

      return {
        ok: true as const,
        allowed: true,
        messages_count: nextMessages,
        tokens_count: 0,
      };
    }

    return { ok: false as const, error: existingError.message };
  }

  const currentMessages = Number(existing?.messages_count || 0);
  const currentTokens = Number(existing?.tokens_count || 0);
  const nextMessages = currentMessages + Math.max(args.messageInc, 0);
  const nextTokens = currentTokens + Math.max(args.tokenInc, 0);

  if (nextMessages > args.messageLimit) {
    return {
      ok: true as const,
      allowed: false,
      messages_count: currentMessages,
      tokens_count: currentTokens,
    };
  }

  const { error: upsertError } = await args.supabase.from("ai_usage_daily").upsert(
    {
      user_id: args.userId,
      day: args.day,
      messages_count: nextMessages,
      tokens_count: nextTokens,
    },
    { onConflict: "user_id,day" }
  );

  if (upsertError) {
    if (isMissingUsageTableError(upsertError.message)) {
      return {
        ok: true as const,
        allowed: true,
        messages_count: nextMessages,
        tokens_count: nextTokens,
      };
    }

    return { ok: false as const, error: upsertError.message };
  }

  return {
    ok: true as const,
    allowed: true,
    messages_count: nextMessages,
    tokens_count: nextTokens,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRouteUser(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const parsed = ChatBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }

    const { projectCode, message } = parsed.data;
    const rawThreadId = parsed.data.threadId;
    const threadId = isUuid(rawThreadId) ? rawThreadId : null;

    const usageDay = new Date().toISOString().slice(0, 10);
    const usageGate = await incrementUsageSafe({
      supabase: auth.supabase,
      userId: auth.user.id,
      day: usageDay,
      messageInc: 1,
      tokenInc: 0,
      messageLimit: DAILY_MESSAGE_LIMIT,
    });

    if (!usageGate.ok) {
      return NextResponse.json({ ok: false, error: usageGate.error }, { status: 500 });
    }

    if (!usageGate.allowed) {
      return NextResponse.json(
        { ok: false, error: `Daily message limit reached (${DAILY_MESSAGE_LIMIT}/day).` },
        { status: 429 }
      );
    }

    let resolvedThreadId = threadId;
    if (resolvedThreadId) {
      const { data: existingThread, error: existingThreadError } = await auth.supabase
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
      const { data: createdThread, error: threadCreateError } = await auth.supabase
        .from("ai_threads")
        .insert({ user_id: auth.user.id, project_code: projectCode, title })
        .select("id")
        .single();

      if (threadCreateError || !createdThread) {
        return NextResponse.json({ ok: false, error: threadCreateError?.message || "Failed to create thread." }, { status: 500 });
      }

      resolvedThreadId = String((createdThread as { id?: string } | null)?.id || "");
      if (!resolvedThreadId) {
        return NextResponse.json({ ok: false, error: "Failed to create thread." }, { status: 500 });
      }
    }

    const { error: userMessageError } = await auth.supabase.from("ai_messages").insert({
      thread_id: resolvedThreadId,
      user_id: auth.user.id,
      role: "user",
      content: message,
    });

    if (userMessageError) {
      return NextResponse.json({ ok: false, error: userMessageError.message }, { status: 500 });
    }

    const queryEmbedding = await createEmbedding(message);
    const knowledgeResult = await auth.supabase.rpc("match_ai_knowledge", {
      query_embedding: toPgVectorLiteral(queryEmbedding),
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

    const completion = await generateAssistantAnswer({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: message,
      knowledgeContext: buildKnowledgeContext(knowledgeRows),
    });

    const citations = pickCitations(completion.answer, knowledgeRows);

    let assistantInsert = await auth.supabase.from("ai_messages").insert({
      thread_id: resolvedThreadId,
      user_id: auth.user.id,
      role: "assistant",
      content: completion.answer,
      tokens: completion.tokens,
      meta: { citations },
    });

    if (
      assistantInsert.error &&
      (assistantInsert.error.message.includes("column ai_messages.tokens does not exist") ||
        assistantInsert.error.message.includes("column ai_messages.meta does not exist"))
    ) {
      assistantInsert = await auth.supabase.from("ai_messages").insert({
        thread_id: resolvedThreadId,
        user_id: auth.user.id,
        role: "assistant",
        content: completion.answer,
      });
    }

    if (assistantInsert.error) {
      return NextResponse.json({ ok: false, error: assistantInsert.error.message }, { status: 500 });
    }

    if (completion.tokens && completion.tokens > 0) {
      await incrementUsageSafe({
        supabase: auth.supabase,
        userId: auth.user.id,
        day: usageDay,
        messageInc: 0,
        tokenInc: completion.tokens,
        messageLimit: DAILY_MESSAGE_LIMIT,
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
