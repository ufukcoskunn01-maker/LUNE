import type { User } from "@supabase/supabase-js";
import { supabaseServer, supabaseServerWithToken } from "@/lib/supabase/server";

export type RouteSupabaseClient = Awaited<ReturnType<typeof supabaseServer>> | ReturnType<typeof supabaseServerWithToken>;

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function requireRouteUser(request: Request): Promise<
  | { ok: true; user: User; supabase: RouteSupabaseClient }
  | { ok: false; error: string; status: number }
> {
  const cookieClient = await supabaseServer();
  const {
    data: { user: cookieUser },
  } = await cookieClient.auth.getUser();

  if (cookieUser) {
    return { ok: true, user: cookieUser, supabase: cookieClient };
  }

  const token = readBearerToken(request);
  if (token) {
    const tokenClient = supabaseServerWithToken(token);
    const {
      data: { user: tokenUser },
    } = await tokenClient.auth.getUser(token);

    if (tokenUser) {
      return { ok: true, user: tokenUser, supabase: tokenClient };
    }
  }

  return { ok: false, error: "Not authenticated", status: 401 };
}
