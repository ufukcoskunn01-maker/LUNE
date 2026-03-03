import { createAdminClient } from "@/lib/supabase/admin";
import { runAttendanceImport } from "@/lib/attendance/import";

export type SyncRequest = {
  projectCode?: string;
  lookbackDays?: number;
  startDate?: string;
  endDate?: string;
};

type StorageListItem = {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

type CandidateFile = {
  bucket: string;
  storagePath: string;
  fileName: string;
  workDate: string;
  revision: number;
};

const DEFAULT_PROJECT_CODE = "A27";
const DEFAULT_BUCKET = "imports";
const MIN_SYNC_WORK_DATE = process.env.ATTENDANCE_SYNC_START_DATE || "2025-07-31";

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizePrefix(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeSourcePath(rawPath: string, bucket: string): string {
  const cleaned = rawPath.replace(/^\/+/, "");
  if (cleaned.startsWith(`${bucket}/`)) return cleaned.slice(bucket.length + 1);
  if (cleaned.startsWith("imports/")) return cleaned.slice("imports/".length);
  if (cleaned.startsWith("import/")) return cleaned.slice("import/".length);
  return cleaned;
}

function parseRevision(fileName: string): number {
  const m = fileName.match(/(?:_|-)rev(\d{1,3})/i);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

function validDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function parseYymmdd(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const yy = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const dd = Number(token.slice(4, 6));
  const year = 2000 + yy;
  if (!validDate(year, mm, dd)) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function parseDdmmyy(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const dd = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const yy = Number(token.slice(4, 6));
  const year = 2000 + yy;
  if (!validDate(year, mm, dd)) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function inferFolderYearMonth(storagePath: string): { year: number | null; month: number | null } {
  const parts = storagePath.split("/").filter(Boolean);
  let year: number | null = null;
  let month: number | null = null;

  for (const part of parts) {
    if (year === null && /^20\d{2}$/.test(part)) {
      year = Number(part);
      continue;
    }

    if (month === null) {
      const lowered = part.toLowerCase();
      const named = Object.entries(MONTH_NAMES).find(([name]) => lowered.includes(name));
      if (named) {
        month = named[1];
        continue;
      }

      const numbered = lowered.match(/^(\d{1,2})(?:\D|$)/);
      if (numbered) {
        const n = Number(numbered[1]);
        if (n >= 1 && n <= 12) month = n;
      }
    }
  }

  return { year, month };
}

function inferWorkDate(fileName: string, storagePath: string): string | null {
  // Primary pattern for personal reports.
  const direct = fileName.match(/-E-IN-(\d{6})_rev\d{1,3}\.xls[xm]?$/i);
  if (direct?.[1]) {
    const date = parseYymmdd(direct[1]);
    if (date) return date;
  }

  const tokens = Array.from(fileName.matchAll(/(\d{6})(?=\D|$)/g)).map((m) => m[1]);
  if (!tokens.length) return null;

  const parsedPrimary = tokens.map(parseYymmdd).filter((v): v is string => Boolean(v));
  const parsedFallback = tokens.map(parseDdmmyy).filter((v): v is string => Boolean(v));
  const candidates = [...parsedPrimary, ...parsedFallback];
  if (!candidates.length) return null;

  const { year, month } = inferFolderYearMonth(storagePath);

  const withBoth = candidates.find((iso) => {
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));
    return (year === null || y === year) && (month === null || m === month);
  });
  if (withBoth) return withBoth;

  const withYear = candidates.find((iso) => (year === null ? false : Number(iso.slice(0, 4)) === year));
  if (withYear) return withYear;

  const withMonth = candidates.find((iso) => (month === null ? false : Number(iso.slice(5, 7)) === month));
  if (withMonth) return withMonth;

  return candidates[0] || null;
}

function monthSpan(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end || start > end) return out;

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= last) {
    out.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return out;
}

function isFolder(item: StorageListItem): boolean {
  const name = String(item.name || "").trim();
  if (!name) return false;
  const metadata = item.metadata || {};
  if (typeof metadata.size === "number" || typeof metadata.mimetype === "string") return false;
  return !/\.[a-z0-9]{1,8}$/i.test(name);
}

function isAttendanceWorkbook(fileName: string): boolean {
  if (!/\.xls[xm]?$/i.test(fileName)) return false;
  return /-E-IN-/i.test(fileName) || /daily personal/i.test(fileName) || /attendance/i.test(fileName);
}

async function listAll(supabase: ReturnType<typeof createAdminClient>, bucket: string, prefix: string): Promise<StorageListItem[]> {
  const out: StorageListItem[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const response = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (response.error) {
      throw new Error(`Supabase storage list failed for ${bucket}/${prefix}: ${response.error.message}`);
    }

    const batch = (response.data || []) as StorageListItem[];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return out;
}

async function listFilesRecursive(args: {
  supabase: ReturnType<typeof createAdminClient>;
  bucket: string;
  root: string;
}): Promise<string[]> {
  const files: string[] = [];
  const queue: string[] = [args.root];
  const visited = new Set<string>();

  while (queue.length) {
    const prefix = queue.shift()!;
    if (visited.has(prefix)) continue;
    visited.add(prefix);

    const items = await listAll(args.supabase, args.bucket, prefix);
    for (const item of items) {
      const name = String(item.name || "").trim();
      if (!name) continue;
      const full = `${prefix}/${name}`;
      if (isFolder(item)) queue.push(full);
      else files.push(full);
    }
  }

  return files;
}

export async function runAttendanceHourlySync(input: SyncRequest = {}): Promise<{
  ok: boolean;
  projectCode: string;
  scannedPaths: number;
  imported: number;
  skippedExisting: number;
  failed: number;
  coverageOk: boolean;
  minWorkDate: string;
  matchedMonths: string[];
  missingMonths: string[];
  warnings: string[];
  errors: string[];
}> {
  const projectCode = (input.projectCode || DEFAULT_PROJECT_CODE).trim();
  const now = new Date();
  const todayIso = toIsoDate(now);

  const legacyLookback = input.lookbackDays && Number.isFinite(input.lookbackDays)
    ? Math.max(1, Math.min(Number(input.lookbackDays), 3660))
    : null;

  const computedStartFromLookback = legacyLookback
    ? toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (legacyLookback - 1))))
    : null;

  const startDate = input.startDate || computedStartFromLookback || MIN_SYNC_WORK_DATE;
  const endDate = input.endDate || todayIso;

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || start > end) {
    return {
      ok: false,
      projectCode,
      scannedPaths: 0,
      imported: 0,
      skippedExisting: 0,
      failed: 1,
      coverageOk: false,
      minWorkDate: startDate,
      matchedMonths: [],
      missingMonths: [],
      warnings: [],
      errors: [`Invalid sync range: ${startDate}..${endDate}`],
    };
  }

  const supabase = createAdminClient();
  const bucketCandidates = new Set<string>([process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET, "imports", "project-files"]);
  const listedBuckets = await supabase.storage.listBuckets();
  if (!listedBuckets.error && listedBuckets.data) {
    for (const b of listedBuckets.data) {
      if (b?.name) bucketCandidates.add(b.name);
    }
  }

  const configuredRoot = (process.env.ATTENDANCE_ROOT_PREFIX || "").trim();
  const rootCandidates = new Set<string>([
    `${projectCode}/1-Daily Personal Reports`,
    `${projectCode}/attendance`,
    `${projectCode}/daily-personal-reports`,
  ]);
  if (configuredRoot) {
    rootCandidates.add(normalizePrefix(configuredRoot.replace(/^imports\//i, "").replace(/^project-files\//i, "")));
  }

  const errors: string[] = [];
  const matchedMonths = new Set<string>();
  const discoveredByDate = new Map<string, CandidateFile>();
  const seenPath = new Set<string>();
  let scannedPaths = 0;

  for (const bucket of bucketCandidates) {
    for (const root of rootCandidates) {
      const normalizedRoot = normalizePrefix(root);
      if (!normalizedRoot) continue;

      let files: string[] = [];
      try {
        files = await listFilesRecursive({ supabase, bucket, root: normalizedRoot });
      } catch (error: unknown) {
        errors.push(getErrorMessage(error, `Storage scan failed for ${bucket}/${normalizedRoot}`));
        continue;
      }

      for (const storagePath of files) {
        const dedupe = `${bucket}/${storagePath}`;
        if (seenPath.has(dedupe)) continue;
        seenPath.add(dedupe);

        const fileName = storagePath.split("/").pop() || "";
        if (!isAttendanceWorkbook(fileName)) continue;

        const workDate = inferWorkDate(fileName, storagePath);
        if (!workDate) continue;
        if (workDate < startDate || workDate > endDate) continue;

        scannedPaths += 1;
        matchedMonths.add(workDate.slice(0, 7));

        const candidate: CandidateFile = {
          bucket,
          storagePath,
          fileName,
          workDate,
          revision: parseRevision(fileName),
        };

        const previous = discoveredByDate.get(workDate);
        if (!previous) {
          discoveredByDate.set(workDate, candidate);
          continue;
        }

        if (candidate.revision > previous.revision) {
          discoveredByDate.set(workDate, candidate);
          continue;
        }

        if (candidate.revision === previous.revision && candidate.fileName.localeCompare(previous.fileName) > 0) {
          discoveredByDate.set(workDate, candidate);
        }
      }
    }
  }

  const projectRes = await supabase
    .from("projects")
    .select("id")
    .eq("code", projectCode)
    .maybeSingle();

  if (projectRes.error || !projectRes.data?.id) {
    errors.push(projectRes.error?.message || `Project not found: ${projectCode}`);
    const expectedMonths = monthSpan(startDate, endDate);
    return {
      ok: false,
      projectCode,
      scannedPaths,
      imported: 0,
      skippedExisting: 0,
      failed: 1,
      coverageOk: false,
      minWorkDate: startDate,
      matchedMonths: Array.from(matchedMonths).sort(),
      missingMonths: expectedMonths.filter((m) => !matchedMonths.has(m)),
      warnings: [],
      errors,
    };
  }

  const existingFilesRes = await supabase
    .from("files")
    .select("storage_path")
    .eq("project_id", projectRes.data.id)
    .eq("logical_name", "attendance_daily")
    .limit(50000);

  const existingPathSet = new Set<string>();
  if (existingFilesRes.error) {
    errors.push(existingFilesRes.error.message);
  } else {
    for (const row of existingFilesRes.data || []) {
      const p = String((row as { storage_path?: string }).storage_path || "").trim();
      if (p) existingPathSet.add(p);
    }
  }

  const existingDatesRes = await supabase
    .from("attendance_records")
    .select("work_date")
    .eq("project_id", projectRes.data.id)
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .limit(50000);

  const existingDateSet = new Set<string>();
  if (existingDatesRes.error) {
    errors.push(existingDatesRes.error.message);
  } else {
    for (const row of existingDatesRes.data || []) {
      const d = String((row as { work_date?: string }).work_date || "").trim();
      if (d) existingDateSet.add(d);
    }
  }

  let imported = 0;
  let skippedExisting = 0;
  let failed = 0;

  const selectedFiles = Array.from(discoveredByDate.values()).sort((a, b) => a.workDate.localeCompare(b.workDate));

  for (const file of selectedFiles) {
    const normalizedPath = normalizeSourcePath(file.storagePath, file.bucket);
    const hasPath = existingPathSet.has(normalizedPath);
    const hasDateRows = existingDateSet.has(file.workDate);
    if (hasPath && hasDateRows) {
      skippedExisting += 1;
      continue;
    }

    try {
      await runAttendanceImport({
        projectCode,
        workDate: file.workDate,
        sourcePath: `${file.bucket}/${file.storagePath}`,
      });
      imported += 1;
      existingPathSet.add(normalizedPath);
      existingDateSet.add(file.workDate);
    } catch (error: unknown) {
      failed += 1;
      errors.push(getErrorMessage(error, `Import failed for ${file.bucket}/${file.storagePath}`));
    }
  }

  const expectedMonths = monthSpan(startDate, endDate);
  const missingMonths = expectedMonths.filter((token) => !matchedMonths.has(token));
  const warnings: string[] = [];
  if (missingMonths.length > 0) {
    warnings.push(
      `Monthly coverage warning: no attendance file found for ${missingMonths.length} month(s): ${missingMonths.join(", ")}`
    );
  }
  const coverageOk = missingMonths.length === 0;

  return {
    ok: failed === 0 && coverageOk,
    projectCode,
    scannedPaths,
    imported,
    skippedExisting,
    failed,
    coverageOk,
    minWorkDate: startDate,
    matchedMonths: Array.from(matchedMonths).sort(),
    missingMonths,
    warnings,
    errors,
  };
}
