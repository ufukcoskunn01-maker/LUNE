import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processUploadedFile } from "@/lib/daily-installation-reports/service";
import type { DailyInstallationFileRow } from "@/lib/daily-installation-reports/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  fileId: z.string().uuid(),
});

export async function POST(_: Request, context: { params: Promise<{ fileId: string }> }) {
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

    const file = fileRes.data as DailyInstallationFileRow;
    const dl = await admin.storage.from(file.storage_bucket).download(file.storage_path);
    if (dl.error || !dl.data) {
      return NextResponse.json({ ok: false, error: dl.error?.message || "Storage download failed." }, { status: 500 });
    }

    const binary = Buffer.from(await dl.data.arrayBuffer());
    const result = await processUploadedFile({
      admin,
      fileRow: file,
      binary,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Retry failed." }, { status: 500 });
  }
}
