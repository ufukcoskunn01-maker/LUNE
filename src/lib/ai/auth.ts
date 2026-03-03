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

function readSupabaseCookieToken(request: NextRequest): string | null {
  const all = request.cookies.getAll();
  if (!all.length) return null;

  const chunkGroups = new Map<string, Array<{ index: number; value: string }>>();

  for (const cookie of all) {
    if (!cookie.name.startsWith("sb-")) continue;

    const chunkMatch = cookie.name.match(/^(.*)\.(\d+)$/);
    if (chunkMatch) {
      const baseName = chunkMatch[1]!;
      const index = Number(chunkMatch[2]);
      if (!chunkGroups.has(baseName)) chunkGroups.set(baseName, []);
      chunkGroups.get(baseName)!.push({ index, value: cookie.value });
      continue;
    }

    if (!chunkGroups.has(cookie.name)) chunkGroups.set(cookie.name, []);
    chunkGroups.get(cookie.name)!.push({ index: 0, value: cookie.value });
  }

  const candidates: string[] = [];

  for (const [, chunks] of chunkGroups) {
    const combined = chunks
      .sort((a, b) => a.index - b.index)
      .map((item) => item.value)
      .join("");
    if (combined) candidates.push(combined);
  }

  for (const rawValue of candidates) {
    const value = decodeURIComponent(rawValue);

    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
      return value;
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return parsed[0];
      }

      if (parsed && typeof parsed === "object") {
        const parsedObj = parsed as { access_token?: unknown; currentSession?: { access_token?: unknown } };

        if (typeof parsedObj.access_token === "string") {
          return parsedObj.access_token;
        }

        if (typeof parsedObj.currentSession?.access_token === "string") {
          return parsedObj.currentSession.access_token;
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return null;
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const token = readBearerToken(request) || readSupabaseCookieToken(request);
  if (!token) {
    return { ok: false as const, error: "No authenticated Supabase session found. Sign in to use AI routes.", status: 401 };
  }

  const userClient = supabaseServerWithToken(token);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false as const, error: "No authenticated Supabase session found. Sign in to use AI routes.", status: 401 };
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
