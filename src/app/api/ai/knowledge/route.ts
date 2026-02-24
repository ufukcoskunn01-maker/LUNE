import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/ai/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const projectCode = new URL(request.url).searchParams.get("projectCode") || "A27";

    const { data, error } = await auth.adminClient
      .from("ai_knowledge")
      .select("id,project_code,title,tags,updated_at")
      .eq("project_code", projectCode)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected knowledge list error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
