import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing Supabase public env vars.");
  }

  supabase = createClient(url, anon);
  return supabase;
}
