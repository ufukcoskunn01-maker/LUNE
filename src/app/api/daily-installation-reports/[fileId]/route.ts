import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  fileId: z.string().uuid(),
});

export async function GET(_: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const params = await context.params;
    const parsed = ParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid file id." }, { status: 400 });
    }

    const admin = createAdminClient();
    const fileRes = await admin.from("daily_installation_report_files").select("*").eq("id", parsed.data.fileId).maybeSingle();
    if (fileRes.error) return NextResponse.json({ ok: false, error: fileRes.error.message }, { status: 500 });
    if (!fileRes.data) return NextResponse.json({ ok: false, error: "File record not found." }, { status: 404 });

    const reportRes = await admin
      .from("daily_installation_reports")
      .select("id,file_id,project_id,report_date,report_title,contractor_name,zone,floor,summary_json,created_at,updated_at")
      .eq("file_id", parsed.data.fileId)
      .maybeSingle();

    if (reportRes.error) return NextResponse.json({ ok: false, error: reportRes.error.message }, { status: 500 });

    let items: Array<Record<string, unknown>> = [];
    if (reportRes.data?.id) {
      const itemsRes = await admin
        .from("daily_installation_report_items")
        .select("id,report_id,sort_order,category,item_code,item_name,unit,planned_qty,actual_qty,cumulative_qty,remarks,raw_json,created_at")
        .eq("report_id", reportRes.data.id)
        .order("sort_order", { ascending: true });
      if (itemsRes.error) return NextResponse.json({ ok: false, error: itemsRes.error.message }, { status: 500 });
      items = (itemsRes.data || []) as Array<Record<string, unknown>>;
    }

    return NextResponse.json({
      ok: true,
      data: {
        file: fileRes.data,
        report: reportRes.data || null,
        items,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load report details." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const params = await context.params;
    const parsed = ParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid file id." }, { status: 400 });
    }

    const admin = createAdminClient();
    const fileRes = await admin
      .from("daily_installation_report_files")
      .select("id,storage_bucket,storage_path")
      .eq("id", parsed.data.fileId)
      .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();

    if (fileRes.error) return NextResponse.json({ ok: false, error: fileRes.error.message }, { status: 500 });
    if (!fileRes.data) return NextResponse.json({ ok: false, error: "File record not found." }, { status: 404 });

    const removeStorage = await admin.storage.from(fileRes.data.storage_bucket).remove([fileRes.data.storage_path]);
    if (removeStorage.error) {
      return NextResponse.json({ ok: false, error: `Failed to delete storage file: ${removeStorage.error.message}` }, { status: 500 });
    }

    const del = await admin.from("daily_installation_report_files").delete().eq("id", parsed.data.fileId);
    if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to delete report." }, { status: 500 });
  }
}
