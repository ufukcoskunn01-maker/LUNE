import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServerWithToken } from "@/lib/supabase/server";

function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const token = readBearerToken(request);
  if (!token) {
    return { ok: false as const, error: "Missing bearer token.", status: 401 };
  }

  const userClient = supabaseServerWithToken(token);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false as const, error: "Invalid or expired token.", status: 401 };
  }

  return {
    ok: true as const,
    token,
    user: data.user,
    userClient,
    adminClient: supabaseAdmin(),
  };
}

export async function requireAdminUser(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const { data, error } = await auth.userClient.rpc("is_ai_admin", { user_uuid: auth.user.id });
  if (error) {
    return { ok: false as const, error: error.message, status: 500 };
  }

  if (!data) {
    return { ok: false as const, error: "Admin access required.", status: 403 };
  }

  return auth;
}
