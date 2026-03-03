import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importFieldInstallationDay } from "@/lib/field-installation/import-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  projectCode: z.string().trim().min(1).max(64),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    const allowAnon = process.env.AI_ALLOW_ANON_DEV === "true";
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user && !allowAnon) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    if (user && !adminEmails().has(String(user.email || "").toLowerCase())) {
      return NextResponse.json({ ok: false, error: "Only admin users can import field installation files." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body || {});
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid payload." }, { status: 400 });
    }

    const { projectCode, workDate } = parsed.data;
    const admin = createAdminClient();

    const result = await importFieldInstallationDay({
      admin,
      projectCode,
      workDate,
    });

    console.info("[jobs/import-field-installation] imported", {
      projectCode,
      workDate,
      fileId: result.fileId,
      parsedMaterialRows: result.parsedMaterialRows,
      parsedLaborRows: result.parsedLaborRows,
      warnings: result.warnings.length,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    console.error("[jobs/import-field-installation] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
