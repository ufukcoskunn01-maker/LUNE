import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  try {
    const allowAnon = process.env.AI_ALLOW_ANON_DEV === "true";
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user && !allowAnon) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      projectCode: url.searchParams.get("projectCode") || "A27",
      date: url.searchParams.get("date") || "",
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { projectCode, date } = parsed.data;
    const result = await admin
      .from("field_installation_files")
      .select("id,bucket_id,storage_path,file_name,revision,work_date")
      .eq("project_code", projectCode)
      .eq("work_date", date)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      const message = result.error.message || "Failed to query metadata.";
      if (message.toLowerCase().includes("field_installation_files") && message.toLowerCase().includes("does not exist")) {
        return NextResponse.json(
          { ok: false, error: "field_installation_files table is missing. Run migration 202602261030_field_installation_files.sql." },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    if (!result.data) {
      return NextResponse.json({ ok: false, error: "No file for this date" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: result.data.id,
        bucket_id: result.data.bucket_id,
        storage_path: result.data.storage_path,
        file_name: result.data.file_name,
        revision: result.data.revision,
        work_date: result.data.work_date,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to fetch file." }, { status: 500 });
  }
}
