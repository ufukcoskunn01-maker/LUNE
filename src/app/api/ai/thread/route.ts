import { NextResponse } from "next/server";
import { requireRouteUser } from "@/lib/ai/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await requireRouteUser(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const projectCode = String(body.projectCode || "A27");
    const title = String(body.title || "New thread");

    const { data, error } = await auth.supabase
      .from("ai_threads")
      .insert({ user_id: auth.user.id, project_code: projectCode, title })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: { threadId: data.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected thread create error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
