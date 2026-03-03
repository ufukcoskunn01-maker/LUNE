import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildStoragePath,
  createFileRow,
  hashBuffer,
  processUploadedFile,
  uploadToStorage,
  validateUploadFile,
} from "@/lib/daily-installation-reports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ListQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(64).default("A27"),
  limit: z.coerce.number().int().min(1).max(200).default(40),
});

export async function GET(req: Request) {
  try {
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = ListQuerySchema.safeParse({
      projectId: url.searchParams.get("projectId") || "A27",
      limit: url.searchParams.get("limit") || 40,
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const admin = createAdminClient();
    const filesRes = await admin
      .from("daily_installation_report_files")
      .select("*")
      .eq("project_id", parsed.data.projectId)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);

    if (filesRes.error) {
      return NextResponse.json({ ok: false, error: filesRes.error.message }, { status: 500 });
    }

    const fileIds = (filesRes.data || []).map((row) => String((row as { id?: string }).id || "")).filter(Boolean);
    const reportsByFileId = new Map<string, Record<string, unknown>>();
    if (fileIds.length) {
      const reportsRes = await admin
        .from("daily_installation_reports")
        .select("id,file_id,project_id,report_date,report_title,contractor_name,zone,floor,summary_json,created_at,updated_at")
        .in("file_id", fileIds);
      if (reportsRes.error) {
        return NextResponse.json({ ok: false, error: reportsRes.error.message }, { status: 500 });
      }
      for (const row of reportsRes.data || []) {
        const fileId = String((row as { file_id?: string }).file_id || "");
        if (fileId) reportsByFileId.set(fileId, row as Record<string, unknown>);
      }
    }

    const rows = (filesRes.data || []).map((file) => {
      const id = String((file as { id?: string }).id || "");
      return {
        ...(file as Record<string, unknown>),
        report: reportsByFileId.get(id) || null,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        projectId: parsed.data.projectId,
        rows,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load daily installation reports." },
      { status: 500 }
    );
  }
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

    const form = await req.formData();
    const projectId = String(form.get("projectId") || form.get("projectCode") || "A27").trim();
    const fileValue = form.get("file");
    if (!(fileValue instanceof File)) {
      return NextResponse.json({ ok: false, error: "file is required." }, { status: 400 });
    }

    validateUploadFile(fileValue);
    const binary = Buffer.from(await fileValue.arrayBuffer());
    const bucket = (process.env.SUPABASE_STORAGE_BUCKET || "project-files").trim();
    const storagePath = buildStoragePath(projectId, fileValue.name);
    const hash = hashBuffer(binary);

    const admin = createAdminClient();
    const uploadMeta = await uploadToStorage({
      admin,
      bucket,
      path: storagePath,
      fileName: fileValue.name,
      binary,
    });

    const fileRow = await createFileRow({
      admin,
      projectId,
      storageBucket: bucket,
      storagePath,
      originalFileName: fileValue.name,
      fileSize: binary.length,
      fileHash: hash,
      mimeType: uploadMeta.contentType,
      uploadedBy: user.id,
    });

    const result = await processUploadedFile({
      admin,
      fileRow,
      binary,
    });

    return NextResponse.json({
      ok: true,
      data: {
        fileId: result.fileId,
        reportId: result.reportId,
        status: result.status,
        reportDate: result.reportDate,
        itemCount: result.itemCount,
        summary: result.summary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload pipeline failed." },
      { status: 500 }
    );
  }
}
