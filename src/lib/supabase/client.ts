import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(url, key);
}
