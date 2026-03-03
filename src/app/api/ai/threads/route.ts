import { NextRequest, NextResponse } from "next/server";
import { requireRouteUser } from "@/lib/ai/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRouteUser(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const projectCode = new URL(request.url).searchParams.get("projectCode") || "A27";

    const { data, error } = await auth.supabase
      .from("ai_threads")
      .select("id,title,project_code,created_at")
      .eq("user_id", auth.user.id)
      .eq("project_code", projectCode)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data || []) as Array<{ id: string; title: string | null; project_code: string; created_at: string }>;

    const enriched = await Promise.all(
      rows.map(async (thread) => {
        const { data: latestMessage } = await auth.supabase
          .from("ai_messages")
          .select("content,created_at")
          .eq("thread_id", thread.id)
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const latest = latestMessage as { content?: string | null; created_at?: string | null } | null;

        return {
          ...thread,
          updated_at: latest?.created_at || thread.created_at,
          last_message_preview: latest?.content?.replace(/\s+/g, " ").trim().slice(0, 140) || null,
        };
      })
    );

    return NextResponse.json({ ok: true, data: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected threads error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRouteUser(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => null)) as { projectCode?: unknown; title?: unknown } | null;
    const projectCode = typeof body?.projectCode === "string" && body.projectCode.trim() ? body.projectCode.trim() : "A27";
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "New thread";

    const { data, error } = await auth.supabase
      .from("ai_threads")
      .insert({ user_id: auth.user.id, project_code: projectCode, title })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const threadId = String((data as { id?: string } | null)?.id || "");
    if (!threadId) {
      return NextResponse.json({ ok: false, error: "Failed to create thread." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { threadId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected thread create error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
