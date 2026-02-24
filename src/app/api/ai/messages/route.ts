import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/ai/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const threadId = new URL(request.url).searchParams.get("threadId");
    if (!threadId) {
      return NextResponse.json({ ok: false, error: "threadId is required." }, { status: 400 });
    }

    const { data: thread, error: threadError } = await auth.userClient
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

    const { data, error } = await auth.userClient
      .from("ai_messages")
      .select("id,thread_id,role,content,created_at,tokens,meta")
      .eq("thread_id", threadId)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected messages error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
