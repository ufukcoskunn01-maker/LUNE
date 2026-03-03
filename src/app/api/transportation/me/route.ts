import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isTransportReporter, requireAuthedUser } from "@/lib/transportation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const auth = await requireAuthedUser(supabase);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const reporter = await isTransportReporter(supabase, auth.user.id);
    return NextResponse.json({
      ok: true,
      data: {
        user: { id: auth.user.id, email: auth.user.email ?? null },
        isReporter: reporter,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load transportation profile.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
