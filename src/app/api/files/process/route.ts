import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FilesRow = {
  id: string;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
};

type DatabaseWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Partial<FilesRow> | null;
  old_record?: Partial<FilesRow> | null;
};

function getSecret(headers: Headers) {
  return headers.get("x-webhook-secret") || headers.get("x-supabase-webhook-secret");
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getMetadataPatch(mimeType: string | null | undefined): Record<string, unknown> {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) {
    return { previewReady: true };
  }
  if (mime === "application/pdf") {
    return { needsOcr: false, pageCount: null };
  }
  return {};
}

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.FILES_WEBHOOK_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ ok: false, error: "FILES_WEBHOOK_SECRET is not configured." }, { status: 500 });
    }

    const providedSecret = getSecret(req.headers);
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized webhook request." }, { status: 401 });
    }

    const payload = (await req.json()) as DatabaseWebhookPayload;
    const record = payload.record;
    const fileId = String(record?.id || "").trim();
    if (!fileId) {
      return NextResponse.json({ ok: false, error: "Missing files row id in webhook payload." }, { status: 400 });
    }

    const admin = createAdminClient();
    const fileResult = await admin.from("files").select("id,mime_type,metadata").eq("id", fileId).maybeSingle();
    if (fileResult.error) {
      return NextResponse.json({ ok: false, error: fileResult.error.message }, { status: 500 });
    }
    if (!fileResult.data) {
      return NextResponse.json({ ok: false, error: "File row not found." }, { status: 404 });
    }

    const fileRow = fileResult.data as FilesRow;
    const metadataPatch = getMetadataPatch(fileRow.mime_type);
    if (!Object.keys(metadataPatch).length) {
      return NextResponse.json({ ok: true, data: { id: fileId, updated: false } });
    }

    const mergedMetadata = {
      ...asObject(fileRow.metadata),
      ...metadataPatch,
      processedAt: new Date().toISOString(),
    };

    const updateResult = await admin.from("files").update({ metadata: mergedMetadata }).eq("id", fileId).select("id,metadata").single();
    if (updateResult.error) {
      return NextResponse.json({ ok: false, error: updateResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { id: fileId, updated: true, metadata: updateResult.data.metadata } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process files webhook.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
