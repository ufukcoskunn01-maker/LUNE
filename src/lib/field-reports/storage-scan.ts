import type { SupabaseClient } from "@supabase/supabase-js";

export const INSTALLATION_REPORT_RE = /ins/i;
export const INSTALLATION_EXT_RE = /\.(xlsx|xlsm)$/i;

type StorageListRow = {
  name?: string | null;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ScannedInstallationFile = {
  projectCode: string;
  reportType: "INSTALLATION";
  workDate: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  revision: string | null;
  fileHash: string | null;
  fileSize: number | null;
  lastModified: string | null;
};

export type SyncScanResult = {
  scanned: number;
  upserted: number;
  skippedNoDate: number;
  bucket: string;
  rootPrefix: string;
};

const LIST_LIMIT = 100;

function normalizePrefix(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function asName(row: StorageListRow): string {
  return String(row.name || "").trim();
}

function isFolderLike(row: StorageListRow): boolean {
  const name = asName(row);
  if (!name) return false;
  const metadata = row.metadata || null;
  const hasFileMetadata =
    !!metadata &&
    (typeof metadata.size !== "undefined" ||
      typeof metadata.mimetype === "string" ||
      typeof metadata.eTag === "string");
  if (hasFileMetadata) return false;
  return !/\.[a-z0-9]{1,8}$/i.test(name);
}

function parseTokenYYMMDD(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const yy = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const dd = Number(token.slice(4, 6));
  const year = yy >= 90 ? 1900 + yy : 2000 + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function detectWorkDateFromFileName(fileName: string): string | null {
  const normalized = fileName.toLowerCase();
  const match = normalized.match(/(?:ins[-_])(\d{6})(?=_rev|\b)/i) || normalized.match(/(\d{6})(?=_rev|\b)/i);
  if (!match) return null;
  return parseTokenYYMMDD(match[1]);
}

function detectRevision(fileName: string): string | null {
  const match = fileName.match(/_rev(\d{2})/i);
  return match ? `rev${match[1]}` : null;
}

function toFileSize(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata) return null;
  const raw = metadata.size;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function toFileHash(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const etag = metadata.eTag;
  if (typeof etag === "string" && etag.trim()) return etag.trim();
  const checksum = metadata.checksum;
  if (typeof checksum === "string" && checksum.trim()) return checksum.trim();
  return null;
}

async function listAllAtPrefix(args: {
  supabase: SupabaseClient;
  bucket: string;
  prefix: string;
}): Promise<StorageListRow[]> {
  const rows: StorageListRow[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await args.supabase.storage.from(args.bucket).list(args.prefix, {
      limit: LIST_LIMIT,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`Storage list failed at ${args.prefix}: ${error.message}`);
    }
    const batch = (data || []) as StorageListRow[];
    rows.push(...batch);
    if (batch.length < LIST_LIMIT) break;
    offset += LIST_LIMIT;
  }

  return rows;
}

export function resolveFieldReportsBucket(): string {
  // Reuse the same bucket convention used by existing attendance imports.
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "imports";
}

export async function discoverInstallationFiles(args: {
  supabase: SupabaseClient;
  projectCode: string;
  bucket: string;
  rootPrefix?: string;
}): Promise<{ files: ScannedInstallationFile[]; skippedNoDate: number; rootPrefix: string }> {
  const rootPrefix = normalizePrefix(args.rootPrefix || `${args.projectCode}/2-Daily Field Reports`);
  const queue: Array<{ prefix: string; depth: number }> = [{ prefix: rootPrefix, depth: 0 }];
  const visited = new Set<string>();
  const files: ScannedInstallationFile[] = [];
  const maxDepth = 6;
  let skippedNoDate = 0;

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.prefix)) continue;
    visited.add(current.prefix);

    const rows = await listAllAtPrefix({
      supabase: args.supabase,
      bucket: args.bucket,
      prefix: current.prefix,
    });

    for (const row of rows) {
      const name = asName(row);
      if (!name) continue;
      const childPath = `${current.prefix}/${name}`;

      if (isFolderLike(row)) {
        if (current.depth < maxDepth) {
          queue.push({ prefix: childPath, depth: current.depth + 1 });
        }
        continue;
      }

      if (!INSTALLATION_EXT_RE.test(name)) continue;
      if (!INSTALLATION_REPORT_RE.test(name)) continue;

      const workDate = detectWorkDateFromFileName(name);
      if (!workDate) {
        skippedNoDate += 1;
        continue;
      }

      files.push({
        projectCode: args.projectCode,
        reportType: "INSTALLATION",
        workDate,
        storageBucket: args.bucket,
        storagePath: childPath,
        fileName: name,
        revision: detectRevision(name),
        fileHash: toFileHash(row.metadata || null),
        fileSize: toFileSize(row.metadata || null),
        lastModified: (row.updated_at || row.created_at || null) as string | null,
      });
    }
  }

  files.sort((a, b) => {
    if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
    return a.fileName.localeCompare(b.fileName);
  });

  return { files, skippedNoDate, rootPrefix };
}

function sameTimestamp(a: string | null, b: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

export async function upsertFieldReportMetadata(args: {
  supabase: SupabaseClient;
  file: ScannedInstallationFile;
}): Promise<{ rowId: string; created: boolean; changed: boolean; needsParse: boolean }> {
  const { supabase, file } = args;
  const existingRes = await supabase
    .from("field_reports")
    .select("id,project_code,report_type,work_date,storage_bucket,storage_path,file_name,revision,file_hash,file_size,last_modified,parse_status")
    .eq("storage_bucket", file.storageBucket)
    .eq("storage_path", file.storagePath)
    .maybeSingle();

  if (existingRes.error) {
    throw new Error(existingRes.error.message);
  }

  const existing = existingRes.data as
    | {
        id: string;
        project_code: string;
        report_type: string;
        work_date: string;
        storage_bucket: string;
        storage_path: string;
        file_name: string;
        revision: string | null;
        file_hash: string | null;
        file_size: number | null;
        last_modified: string | null;
        parse_status: "PENDING" | "OK" | "FAILED";
      }
    | null;

  if (!existing) {
    const insertRes = await supabase.from("field_reports").insert({
      project_code: file.projectCode,
      report_type: file.reportType,
      work_date: file.workDate,
      storage_bucket: file.storageBucket,
      storage_path: file.storagePath,
      file_name: file.fileName,
      revision: file.revision,
      file_hash: file.fileHash,
      file_size: file.fileSize,
      last_modified: file.lastModified,
      parse_status: "PENDING",
      parse_error: null,
    }).select("id").single();
    if (insertRes.error) throw new Error(insertRes.error.message);
    return {
      rowId: String(insertRes.data.id),
      created: true,
      changed: true,
      needsParse: true,
    };
  }

  const changed =
    existing.project_code !== file.projectCode ||
    existing.report_type !== file.reportType ||
    existing.work_date !== file.workDate ||
    existing.storage_bucket !== file.storageBucket ||
    existing.storage_path !== file.storagePath ||
    existing.file_name !== file.fileName ||
    (existing.revision || null) !== (file.revision || null) ||
    (existing.file_hash || null) !== (file.fileHash || null) ||
    (existing.file_size || null) !== (file.fileSize || null) ||
    !sameTimestamp(existing.last_modified || null, file.lastModified || null);

  const updatePayload: Record<string, unknown> = {
    project_code: file.projectCode,
    report_type: file.reportType,
    work_date: file.workDate,
    storage_bucket: file.storageBucket,
    storage_path: file.storagePath,
    file_name: file.fileName,
    revision: file.revision,
    file_hash: file.fileHash,
    file_size: file.fileSize,
    last_modified: file.lastModified,
  };

  if (changed) {
    updatePayload.parse_status = "PENDING";
    updatePayload.parse_error = null;
    updatePayload.summary = {};
  }

  const updateRes = await supabase.from("field_reports").update(updatePayload).eq("id", existing.id);
  if (updateRes.error) throw new Error(updateRes.error.message);
  return {
    rowId: existing.id,
    created: false,
    changed,
    needsParse: changed || existing.parse_status !== "OK",
  };
}

