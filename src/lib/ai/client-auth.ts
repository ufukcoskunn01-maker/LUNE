import { supabaseBrowser } from "@/lib/supabase/browser";

export async function getAccessToken(): Promise<string | null> {
  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}
