import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await createServerSupabaseClient();
  await sb.auth.signOut();
  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/login", url.origin));
}
