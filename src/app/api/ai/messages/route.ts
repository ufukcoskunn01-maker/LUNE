import { NextRequest, NextResponse } from "next/server";
import { requireRouteUser } from "@/lib/ai/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRouteUser(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const threadId = new URL(request.url).searchParams.get("threadId");
    if (!threadId) {
      return NextResponse.json({ ok: false, error: "threadId is required." }, { status: 400 });
    }
    if (!isUuid(threadId)) {
      return NextResponse.json({ ok: false, error: "threadId must be a valid UUID." }, { status: 400 });
    }

    const { data: thread, error: threadError } = await auth.supabase
      .from("ai_threads")
      .select("id")
      .eq("id", threadId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (threadError) {
      return NextResponse.json({ ok: false, error: threadError.message }, { status: 500 });
    }

    if (!thread) {
      return NextResponse.json({ ok: false, error: "Thread not found." }, { status: 404 });
    }

    let { data, error } = await auth.supabase
      .from("ai_messages")
      .select("id,thread_id,role,content,created_at,tokens,meta")
      .eq("thread_id", threadId)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true });

    if (error && error.message.includes("column ai_messages.tokens does not exist")) {
      const fallback = await auth.supabase
        .from("ai_messages")
        .select("id,thread_id,role,content,created_at")
        .eq("thread_id", threadId)
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: true });
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected messages error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
