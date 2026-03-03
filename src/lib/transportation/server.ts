import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DEFAULT_PROJECT_CODE } from "@/lib/transportation/common";
import type { Database } from "@/types/database.types";

type SupabaseAny = SupabaseClient<Database>;

export async function requireAuthedUser(
  supabase: SupabaseAny
): Promise<{ ok: true; user: User } | { ok: false; status: number; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "No authenticated Supabase session found." };
  }

  return { ok: true, user };
}

export async function isTransportReporter(supabase: SupabaseAny, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("transport_reporters").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return false;
  return Boolean(data?.user_id);
}

export async function resolveProjectId(
  supabase: SupabaseAny,
  projectCode: string
): Promise<{ ok: true; id: string; code: string } | { ok: false; status: number; error: string }> {
  const normalized = (projectCode || DEFAULT_PROJECT_CODE).trim();
  if (!normalized) {
    return { ok: false, status: 400, error: "projectCode is required." };
  }

  const { data, error } = await supabase.from("projects").select("id,code").eq("code", normalized).maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!data?.id) return { ok: false, status: 404, error: `Project not found: ${normalized}` };
  return { ok: true, id: data.id, code: data.code };
}
