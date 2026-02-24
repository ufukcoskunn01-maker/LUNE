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

    const projectCode = new URL(request.url).searchParams.get("projectCode") || "A27";

    const { data, error } = await auth.userClient
      .from("ai_threads")
      .select("id,title,project_code,created_at")
      .eq("user_id", auth.user.id)
      .eq("project_code", projectCode)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected threads error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
