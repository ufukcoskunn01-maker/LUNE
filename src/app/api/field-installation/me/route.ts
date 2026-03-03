import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminEmails(): Set<string> {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function GET() {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
  }

  const email = String(user.email || "").toLowerCase();
  return NextResponse.json({
    ok: true,
    data: {
      user: { id: user.id, email: user.email || null },
      isAdmin: adminEmails().has(email),
    },
  });
}
