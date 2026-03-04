import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importFieldInstallationSourceFile } from "@/lib/field-installation/import-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  fileId: z.string().uuid(),
});

function adminEmails(): Set<string> {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function POST(req: Request) {
  try {
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }
    const email = String(user.email || "").toLowerCase();
    if (!adminEmails().has(email)) {
      return NextResponse.json({ ok: false, error: "Forbidden: operator/admin access required." }, { status: 403 });
    }

    const body = BodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: body.error.issues[0]?.message || "Invalid request body." }, { status: 400 });
    }

    const admin = createAdminClient();
    const result = await importFieldInstallationSourceFile({
      admin,
      fileId: body.data.fileId,
      force: true,
    });

    return NextResponse.json({
      ok: true,
      data: {
        fileId: result.fileId,
        ingestStatus: result.ingestStatus,
        parsedMaterialRows: result.parsedMaterialRows,
        parsedLaborRows: result.parsedLaborRows,
        insertedMaterialRows: result.insertedMaterialRows,
        insertedLaborRows: result.insertedLaborRows,
        distinctRowDates: result.distinctRowDates,
        warningCount: result.warnings.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Reprocess failed." },
      { status: 500 }
    );
  }
}
