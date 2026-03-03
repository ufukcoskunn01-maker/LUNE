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
    const fileRes = await admin
      .from("daily_installation_report_files")
      .select("id,storage_bucket,storage_path")
      .eq("id", parsed.data.fileId)
      .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();

    if (fileRes.error) return NextResponse.json({ ok: false, error: fileRes.error.message }, { status: 500 });
    if (!fileRes.data) return NextResponse.json({ ok: false, error: "File record not found." }, { status: 404 });

    const signed = await admin.storage.from(fileRes.data.storage_bucket).createSignedUrl(fileRes.data.storage_path, 60 * 15);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ ok: false, error: signed.error?.message || "Failed to generate signed url." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        url: signed.data.signedUrl,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Signed URL request failed." }, { status: 500 });
  }
}
