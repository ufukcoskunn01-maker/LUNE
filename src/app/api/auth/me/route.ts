import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({
      ok: true,
      user: null,
      profile: null,
      data: { user: null, profile: null },
    });
  }

  const profileResult = await sb
    .from("profiles")
    .select("role,profession,must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileResult.error
    ? null
    : {
        role: profileResult.data?.role ?? null,
        profession: profileResult.data?.profession ?? null,
        must_change_password: profileResult.data?.must_change_password ?? null,
      };

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    profile,
    data: {
      user: { id: user.id, email: user.email },
      profile,
    },
  });
}
