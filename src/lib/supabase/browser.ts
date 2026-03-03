import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function supabaseBrowser() {
  return createBrowserSupabaseClient();
}
