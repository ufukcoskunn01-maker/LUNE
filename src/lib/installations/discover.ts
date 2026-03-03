import type { SupabaseClient } from "@supabase/supabase-js";

export const INSTALLATION_FILE_RE = /-INS-(\d{6})_rev(\d{2})\.xlsx$/i;

export type InstallationStorageFile = {
  projectCode: string;
  rootPrefix: string;
  filename: string;
  storagePath: string;
  workDate: string;
  rev: number;
  fileSize: number | null;
  lastModified: string | null;
};

type StorageListItem = {
  name?: string | null;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DEFAULT_LIMIT = 100;

function normalizePrefix(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function listItemName(item: StorageListItem): string {
  return (item.name || "").trim();
}

function isLikelyFolder(item: StorageListItem): boolean {
  const name = listItemName(item);
  if (!name) return false;
  // Supabase folder list rows are not fully consistent across environments.
  // Do not rely on id; infer using filename extension + metadata hints.
  const metadata = item.metadata || null;
  const hasFileMetadata =
    !!metadata &&
    (typeof metadata.size !== "undefined" ||
      typeof metadata.mimetype === "string" ||
      typeof metadata.eTag === "string");
  if (hasFileMetadata) return false;
  return !/\.[a-z0-9]{1,8}$/i.test(name);
}

function parseYYMMDD(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const year = Number(`20${token.slice(0, 2)}`);
  const month = Number(token.slice(2, 4));
  const day = Number(token.slice(4, 6));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toFileSize(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata) return null;
  const candidate = metadata.size;
  if (typeof candidate === "number" && Number.isFinite(candidate)) return Math.trunc(candidate);
  if (typeof candidate === "string" && candidate.trim()) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

async function listAll(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<StorageListItem[]> {
  const rows: StorageListItem[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: DEFAULT_LIMIT,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`Storage list failed at ${prefix}: ${error.message}`);
    }

    const batch = (data || []) as StorageListItem[];
    rows.push(...batch);
    if (batch.length < DEFAULT_LIMIT) break;
    offset += DEFAULT_LIMIT;
  }

  return rows;
}

export async function discoverInstallationFiles(args: {
  supabase: SupabaseClient;
  bucket: string;
  projectCode: string;
  rootPrefix?: string;
}): Promise<InstallationStorageFile[]> {
  const rootPrefix = normalizePrefix(args.rootPrefix || `${args.projectCode}/2-Daily Field Reports`);
  const files: InstallationStorageFile[] = [];
  const visited = new Set<string>();
  const queue: Array<{ prefix: string; depth: number }> = [{ prefix: rootPrefix, depth: 0 }];
  const maxDepth = 6;

  while (queue.length) {
    const next = queue.shift()!;
    if (visited.has(next.prefix)) continue;
    visited.add(next.prefix);

    const items = await listAll(args.supabase, args.bucket, next.prefix);
    for (const item of items) {
      const filename = listItemName(item);
      if (!filename) continue;
      const childPath = `${next.prefix}/${filename}`;

      const match = INSTALLATION_FILE_RE.exec(filename);
      if (match) {
        const workDate = parseYYMMDD(match[1]);
        if (!workDate) continue;
        files.push({
          projectCode: args.projectCode,
          rootPrefix,
          filename,
          storagePath: childPath,
          workDate,
          rev: Number(match[2]),
          fileSize: toFileSize(item.metadata || null),
          lastModified: (item.updated_at || item.created_at || null) as string | null,
        });
        continue;
      }

      if (next.depth < maxDepth && isLikelyFolder(item)) {
        queue.push({ prefix: childPath, depth: next.depth + 1 });
      }
    }
  }

  return files.sort((a, b) => {
    if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
    if (a.rev !== b.rev) return a.rev - b.rev;
    return a.filename.localeCompare(b.filename);
  });
}
