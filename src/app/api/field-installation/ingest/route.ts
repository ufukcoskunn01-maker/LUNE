import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importFieldInstallationSourceFile } from "@/lib/field-installation/import-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  fileId: z.string().uuid(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid request body." }, { status: 400 });
    }

    const admin = createAdminClient();
    const fileRes = await admin
      .from("field_installation_files")
      .select("id,project_code,work_date")
      .eq("id", parsed.data.fileId)
      .maybeSingle<{ id: string; project_code: string; work_date: string }>();

    if (fileRes.error) {
      return NextResponse.json({ ok: false, error: fileRes.error.message }, { status: 500 });
    }
    if (!fileRes.data) {
      return NextResponse.json({ ok: false, error: "File metadata not found." }, { status: 404 });
    }

    const result = await importFieldInstallationSourceFile({
      admin,
      fileId: fileRes.data.id,
      force: parsed.data.force ?? false,
    });

    return NextResponse.json({
      ok: true,
      insertedRows: result.insertedMaterialRows,
      parsedRows: result.parsedMaterialRows,
      insertedLaborRows: result.insertedLaborRows,
      ingestStatus: result.ingestStatus,
      distinctRowDates: result.distinctRowDates,
      summary: {
        material_total_mh: result.mh_material,
        people_total_mh: result.mh_direct,
        direct_total_mh: result.mh_direct,
        indirect_total_mh: result.mh_indirect,
      },
      warnings: result.warnings,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Ingestion failed." }, { status: 500 });
  }
}
