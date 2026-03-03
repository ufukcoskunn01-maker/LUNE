import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error";
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, service, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectCode = searchParams.get("projectCode") || "A27";
    const limit = Math.max(1, Number(searchParams.get("limit") || 120));
    const pageSize = 1000;

    const sb = getSupabaseAdmin();

    const { data: proj, error: projErr } = await sb
      .from("projects")
      .select("id")
      .eq("code", projectCode)
      .maybeSingle();

    if (projErr) return Response.json({ ok: false, error: projErr.message }, { status: 500 });
    if (!proj) return Response.json({ ok: false, error: `Project not found: ${projectCode}` }, { status: 404 });

    // Paginate through attendance rows and collect unique work dates.
    // This avoids missing dates when one day contains many records.
    const seen = new Set<string>();
    const dates: string[] = [];
    let offset = 0;

    while (dates.length < limit) {
      const { data, error } = await sb
        .from("attendance_records")
        .select("work_date")
        .eq("project_id", proj.id)
        .order("work_date", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      if (!data || data.length === 0) break;

      for (const r of data) {
        const d = typeof r?.work_date === "string" ? r.work_date : "";
        if (d && !seen.has(d)) {
          seen.add(d);
          dates.push(d);
          if (dates.length >= limit) break;
        }
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return Response.json({ ok: true, data: { projectCode, dates } });
  } catch (e: unknown) {
    return Response.json({ ok: false, error: getErrorMessage(e) }, { status: 500 });
  }
}
