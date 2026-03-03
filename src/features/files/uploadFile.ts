import type { SupabaseClient } from "@supabase/supabase-js";

export type FileRow = {
  id: string;
  owner_id: string;
  bucket: string;
  path: string;
  mime_type: string | null;
  size: number | null;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UploadFileInput = {
  supabase: SupabaseClient;
  data?: Blob | File | Buffer | ArrayBuffer | Uint8Array;
  file?: File;
  fileName?: string;
  entityType: string;
  entityId: string;
  bucket: string;
  ownerId?: string;
  contentType?: string;
  pathPrefix?: string;
  path?: string;
  upsert?: boolean;
  cacheControl?: string;
  metadata?: Record<string, unknown>;
};

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function getExtension(filename: string) {
  const normalized = filename.trim();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return "";
  }
  return normalized.slice(dotIndex);
}

function buildStoragePath(input: UploadFileInput) {
  if (input.path) {
    return trimSlashes(input.path);
  }
  const prefix = input.pathPrefix ? trimSlashes(input.pathPrefix) : "";
  const scopedEntityPath = `${trimSlashes(input.entityType)}/${trimSlashes(input.entityId)}`;
  const filename = `${Date.now()}-${crypto.randomUUID()}${getExtension(input.fileName || "file.bin")}`;

  return [prefix, scopedEntityPath, filename].filter(Boolean).join("/");
}

export async function uploadFile(input: UploadFileInput): Promise<FileRow> {
  // RULE: direct `supabase.storage.from(...).upload(...)` is forbidden outside this module.
  const supabase = input.supabase;
  const storagePath = buildStoragePath(input);

  const payload = input.data ?? input.file;
  if (!payload) {
    throw new Error("uploadFile requires input.data or input.file.");
  }
  const uploadResult = await supabase.storage.from(input.bucket).upload(storagePath, payload, {
    contentType: input.contentType,
    upsert: input.upsert ?? false,
    cacheControl: input.cacheControl,
  });

  if (uploadResult.error) {
    throw new Error(`File upload failed: ${uploadResult.error.message}`);
  }

  const insertResult = await supabase
    .from("files")
    .insert({
      owner_id: input.ownerId,
      bucket: input.bucket,
      path: storagePath,
      mime_type: input.contentType || null,
      size:
        typeof Blob !== "undefined" && payload instanceof Blob
          ? payload.size
          : typeof Buffer !== "undefined" && Buffer.isBuffer(payload)
            ? payload.length
            : null,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (insertResult.error || !insertResult.data) {
    await supabase.storage.from(input.bucket).remove([storagePath]);
    throw new Error(`Failed to create files row: ${insertResult.error?.message ?? "Unknown error"}`);
  }

  return insertResult.data as FileRow;
}
