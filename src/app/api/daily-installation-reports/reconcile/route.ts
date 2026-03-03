import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { reconcileDailyInstallationReportsFromStorage } from "@/lib/field-reports/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  rootPrefix: z.string().trim().optional(),
  fromDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  missingOnly: z.boolean().optional(),
  reprocessFailed: z.boolean().optional(),
  reprocessAll: z.boolean().optional(),
});

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Daily installation reports reconciliation failed.";
}

export async function POST(req: Request) {
  try {
    const userClient = await supabaseServer();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: body.error.issues[0]?.message || "Invalid payload." }, { status: 400 });
    }

    const data = body.data;
    const reconcile = await reconcileDailyInstallationReportsFromStorage({
      supabase: supabaseAdmin(),
      projectCode: data.projectCode,
      rootPrefix: data.rootPrefix,
      fromDate: data.fromDate ?? null,
      toDate: data.toDate ?? null,
      missingOnly: data.missingOnly ?? true,
      reprocessFailed: data.reprocessFailed ?? false,
      reprocessAll: data.reprocessAll ?? false,
    });

    return NextResponse.json({
      ok: reconcile.errors.length === 0,
      data: reconcile,
      errors: reconcile.errors,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: normalizeError(error) }, { status: 500 });
  }
}
