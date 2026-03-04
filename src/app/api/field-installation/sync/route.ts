import { z } from "zod";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
});
const RAW_MIN_SYNC_WORK_DATE = (process.env.FIELD_INSTALLATION_MIN_WORK_DATE || "").trim();
const MIN_SYNC_WORK_DATE = /^\d{4}-\d{2}-\d{2}$/.test(RAW_MIN_SYNC_WORK_DATE) ? RAW_MIN_SYNC_WORK_DATE : null;

type StorageItem = {
  name?: string | null;
  metadata?: Record<string, unknown> | null;
};

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

function normalizePrefix(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isFolder(item: StorageItem): boolean {
  const name = String(item.name || "").trim();
  if (!name) return false;
  const meta = item.metadata || {};
  if (typeof meta.size === "number" || typeof meta.mimetype === "string") return false;
  return !/\.[a-z0-9]{1,8}$/i.test(name);
}

async function listPrefix(admin: ReturnType<typeof createAdminClient>, bucket: string, prefix: string): Promise<StorageItem[]> {
  const out: StorageItem[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const res = await admin.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (res.error) throw new Error(`Storage list failed at ${bucket}/${prefix}: ${res.error.message}`);

    const batch = (res.data || []) as StorageItem[];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return out;
}

async function listFilesRecursive(args: {
  admin: ReturnType<typeof createAdminClient>;
  bucket: string;
  prefix: string;
}): Promise<string[]> {
  const files: string[] = [];
  const queue: string[] = [args.prefix];
  const visited = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const items = await listPrefix(args.admin, args.bucket, current);
    for (const item of items) {
      const name = String(item.name || "").trim();
      if (!name) continue;
      const fullPath = `${current}/${name}`;
      if (isFolder(item)) queue.push(fullPath);
      else files.push(fullPath);
    }
  }

  return files;
}

function parseRevision(fileName: string): string {
  const match = fileName.match(/(?:_|-)rev(\d{1,3})/i);
  const n = match ? Number(match[1] || 0) : 0;
  return `rev${String(Number.isFinite(n) ? n : 0).padStart(2, "0")}`;
}

function parseYymmddStrict(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const year = 2000 + Number(token.slice(0, 2));
  const month = Number(token.slice(2, 4));
  const day = Number(token.slice(4, 6));
  if (!validDate(year, month, day)) return null;
  return buildIso(year, month, day);
}

function isInstallationWorkbook(fileName: string): boolean {
  if (!/\.xls[xm]?$/i.test(fileName)) return false;
  return /(?:^|[-_])ins[a-z0-9]*(?:[-_.]|$)/i.test(fileName) || /installation/i.test(fileName);
}

function parseMonthFromSegment(segment: string): number | null {
  const lowered = segment.toLowerCase();
  const byName = Object.entries(MONTH_NAMES).find(([name]) => lowered.includes(name));
  if (byName) return byName[1];

  const m = lowered.match(/^(\d{1,2})(?:\D|$)/);
  if (!m) return null;
  const month = Number(m[1]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}

function inferFolderDate(path: string): { year: number | null; month: number | null } {
  const parts = path.split("/").filter(Boolean);
  let year: number | null = null;
  let month: number | null = null;

  for (const part of parts) {
    if (year === null && /^20\d{2}$/.test(part)) {
      year = Number(part);
      continue;
    }

    if (month === null) {
      const m = parseMonthFromSegment(part);
      if (m !== null) month = m;
    }
  }

  return { year, month };
}

function buildIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function validDate(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isReasonableWorkDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  if (!validDate(year, month, day)) return false;
  const currentYear = new Date().getUTCFullYear();
  return year >= 2020 && year <= currentYear + 1;
}

function dateCandidatesFromToken(token: string): Array<{ year: number; month: number; day: number }> {
  if (!/^\d{6}$/.test(token)) return [];

  const yy = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const dd = Number(token.slice(4, 6));
  const yymmdd = { year: 2000 + yy, month: mm, day: dd };

  const dd2 = Number(token.slice(0, 2));
  const mm2 = Number(token.slice(2, 4));
  const yy2 = Number(token.slice(4, 6));
  const ddmmyy = { year: 2000 + yy2, month: mm2, day: dd2 };

  const out: Array<{ year: number; month: number; day: number }> = [];
  // Installation files are expected as YYMMDD.
  // Keep DDMMYY only as a low-priority fallback for legacy anomalies.
  if (validDate(yymmdd.year, yymmdd.month, yymmdd.day)) out.push(yymmdd);
  if (validDate(ddmmyy.year, ddmmyy.month, ddmmyy.day)) {
    if (!out.some((item) => item.year === ddmmyy.year && item.month === ddmmyy.month && item.day === ddmmyy.day)) {
      out.push(ddmmyy);
    }
  }
  return out;
}

function inferWorkDate(fileName: string, storagePath: string): string | null {
  // Primary expected pattern from operations:
  // A27-E-INS-YYMMDD_rev00.xlsx
  const exactPattern = fileName.match(/^[A-Z0-9]+-E-INS-(\d{6})_rev\d{1,3}\.xls[xm]?$/i);
  if (exactPattern?.[1]) {
    const strictDate = parseYymmddStrict(exactPattern[1]);
    if (strictDate) return strictDate;
  }

  const tokens = Array.from(fileName.matchAll(/(\d{6})(?=\D|$)/g)).map((m) => m[1]);
  if (!tokens.length) return null;

  const { year: folderYear, month: folderMonth } = inferFolderDate(storagePath);
  const candidates = tokens.flatMap((token) => dateCandidatesFromToken(token));
  if (!candidates.length) return null;
  const currentYear = new Date().getUTCFullYear();
  const plausible = (c: { year: number }) => c.year >= 2020 && c.year <= currentYear + 1;

  const withBoth = candidates.find(
    (c) =>
      plausible(c) &&
      (folderYear === null || c.year === folderYear) &&
      (folderMonth === null || c.month === folderMonth)
  );
  if (withBoth) return buildIso(withBoth.year, withBoth.month, withBoth.day);

  const withYear = candidates.find((c) => plausible(c) && folderYear !== null && c.year === folderYear);
  if (withYear) return buildIso(withYear.year, withYear.month, withYear.day);

  const withMonth = candidates.find((c) => plausible(c) && folderMonth !== null && c.month === folderMonth);
  if (withMonth) return buildIso(withMonth.year, withMonth.month, withMonth.day);

  const best = candidates.find((c) => plausible(c)) || candidates[0];
  return buildIso(best.year, best.month, best.day);
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Source workbooks are authored in Moscow time; normalize before slicing date.
    const shifted = new Date(value.getTime() + 3 * 60 * 60 * 1000);
    const iso = shifted.toISOString().slice(0, 10);
    return isReasonableWorkDate(iso) ? iso : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const iso = `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      return isReasonableWorkDate(iso) ? iso : null;
    }
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  const ymd = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymd) {
    const iso = `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    if (isReasonableWorkDate(iso)) return iso;
  }

  const dmy = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
  if (dmy) {
    const first = Number(dmy[1]);
    const month = Number(dmy[2]);
    const third = Number(dmy[3]);

    // Ambiguous 2-digit tokens like "25.10.31" are common in this feed.
    // Prefer YY.MM.DD when it yields a plausible work date.
    if (dmy[3].length <= 2) {
      const yyMmDd = `${2000 + first}-${String(month).padStart(2, "0")}-${String(third).padStart(2, "0")}`;
      if (isReasonableWorkDate(yyMmDd)) return yyMmDd;
    }

    const year = third < 100 ? 2000 + third : third;
    const ddMmYy = `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    if (isReasonableWorkDate(ddMmYy)) return ddMmYy;
  }

  const maybeDate = new Date(text);
  if (!Number.isNaN(maybeDate.getTime())) {
    const shifted = new Date(maybeDate.getTime() + 3 * 60 * 60 * 1000);
    const iso = shifted.toISOString().slice(0, 10);
    if (isReasonableWorkDate(iso)) return iso;
  }
  return null;
}

function findSheet(workbook: XLSX.WorkBook, aliases: string[]): XLSX.WorkSheet | null {
  const wanted = aliases.map(normalizeText);
  for (const name of workbook.SheetNames) {
    const normalized = normalizeText(name);
    if (wanted.some((alias) => normalized.includes(alias))) {
      return workbook.Sheets[name] || null;
    }
  }
  return null;
}

async function readWorkbookReportDate(args: {
  admin: ReturnType<typeof createAdminClient>;
  bucket: string;
  storagePath: string;
}): Promise<string | null> {
  const dl = await args.admin.storage.from(args.bucket).download(args.storagePath);
  if (dl.error || !dl.data) return null;

  const workbook = XLSX.read(Buffer.from(await dl.data.arrayBuffer()), {
    type: "buffer",
    cellDates: true,
    raw: true,
  });

  const materialSheet = findSheet(workbook, ["линия материал", "field material"]);
  if (!materialSheet) return null;

  const matrix = XLSX.utils.sheet_to_json(materialSheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  const dateFromB3 = toIsoDate(matrix[2]?.[1]);
  if (dateFromB3) return dateFromB3;

  for (let r = 3; r < matrix.length && r < 80; r += 1) {
    const rowDate = toIsoDate(matrix[r]?.[1]);
    if (rowDate) return rowDate;
  }

  return null;
}

function isOnOrAfterDate(leftIso: string, rightIso: string): boolean {
  return leftIso.localeCompare(rightIso) >= 0;
}

function monthToken(dateIso: string): string {
  return dateIso.slice(0, 7);
}

function monthSpan(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= last) {
    out.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const sb = await createServerSupabaseClient();
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const {
      data: { user },
    } = await sb.auth.getUser();

    const hasCronAuth = Boolean(secret && authHeader === `Bearer ${secret}`);
    if (!user && !hasCronAuth) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({ projectCode: url.searchParams.get("projectCode") || "A27" });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const projectCode = parsed.data.projectCode;
    const admin = createAdminClient();
    const warnings: string[] = [];

    const bucketCandidates = new Set<string>([
      process.env.SUPABASE_STORAGE_BUCKET || "imports",
      "imports",
      "project-files",
    ]);

    const listedBuckets = await admin.storage.listBuckets();
    if (!listedBuckets.error && listedBuckets.data) {
      for (const bucket of listedBuckets.data) {
        if (bucket?.name) bucketCandidates.add(bucket.name);
      }
    }

    const configuredRoot = (process.env.FIELD_INSTALLATION_ROOT_PREFIX || process.env.INSTALLATIONS_ROOT_PREFIX || "").trim();
    const rootCandidates = new Set<string>([
      `${projectCode}/2-Daily Field Reports`,
      `${projectCode}/2-Daily Installation Reports`,
      `${projectCode}/2-Installation Reports`,
      `${projectCode}/field-installation`,
    ]);

    if (configuredRoot) {
      rootCandidates.add(normalizePrefix(configuredRoot.replace(/^imports\//i, "").replace(/^project-files\//i, "")));
    }

    let scannedFiles = 0;
    let matched = 0;
    let upserted = 0;
    let skippedBeforeStartDate = 0;
    const matchedMonths = new Set<string>();

    const processedPaths = new Set<string>();

    for (const bucket of bucketCandidates) {
      for (const rootPrefix of rootCandidates) {
        const normalizedRoot = normalizePrefix(rootPrefix);
        if (!normalizedRoot) continue;

        let files: string[] = [];
        try {
          files = await listFilesRecursive({ admin, bucket, prefix: normalizedRoot });
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : `Storage scan failed for ${bucket}/${normalizedRoot}`);
          continue;
        }

        for (const storagePath of files) {
          const dedupeKey = `${bucket}/${storagePath}`;
          if (processedPaths.has(dedupeKey)) continue;
          processedPaths.add(dedupeKey);

          const fileName = storagePath.split("/").pop()?.trim() || "";
          if (!isInstallationWorkbook(fileName)) continue;

          scannedFiles += 1;
          const nameDate = inferWorkDate(fileName, storagePath);
          let workDate = nameDate;
          let excelDate: string | null = null;

          if (!workDate) {
            excelDate = await readWorkbookReportDate({ admin, bucket, storagePath });
            if (excelDate) {
              // Fallback only when filename date cannot be parsed.
              workDate = excelDate;
            }
          }

          if (!workDate) {
            warnings.push(`Could not infer date for ${bucket}/${storagePath}`);
            continue;
          }
          if (!isReasonableWorkDate(workDate)) {
            warnings.push(`Ignored out-of-range work date for ${bucket}/${storagePath}: ${workDate}`);
            continue;
          }

          if (excelDate && nameDate && excelDate !== nameDate) {
            warnings.push(`Date mismatch detected for ${bucket}/${storagePath}: name=${nameDate}, sheet=${excelDate}. Kept filename date.`);
          }
          if (MIN_SYNC_WORK_DATE && !isOnOrAfterDate(workDate, MIN_SYNC_WORK_DATE)) {
            skippedBeforeStartDate += 1;
            continue;
          }

          matched += 1;
          matchedMonths.add(monthToken(workDate));

          const upsertRes = await admin.from("field_installation_files").upsert(
            {
              project_code: projectCode,
              work_date: workDate,
              bucket_id: bucket,
              storage_path: storagePath,
              file_name: fileName,
              file_kind: "installation",
              revision: parseRevision(fileName),
              source_created_at: new Date().toISOString(),
              ingest_status: "queued",
              parse_error: null,
              last_error: null,
              uploaded_at: new Date().toISOString(),
              processing_started_at: null,
              processing_finished_at: null,
            },
            { onConflict: "bucket_id,storage_path" }
          );

          if (upsertRes.error) {
            warnings.push(`${bucket}/${storagePath}: ${upsertRes.error.message}`);
            continue;
          }

          upserted += 1;
        }
      }
    }

    let missingMonths: string[] = [];
    if (MIN_SYNC_WORK_DATE) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const expectedMonths = monthSpan(MIN_SYNC_WORK_DATE, todayIso);
      missingMonths = expectedMonths.filter((token) => !matchedMonths.has(token));
    }

    return NextResponse.json({
      ok: true,
      data: {
        scannedFiles,
        matched,
        upserted,
        minWorkDate: MIN_SYNC_WORK_DATE,
        skippedBeforeStartDate,
        matchedMonths: Array.from(matchedMonths).sort(),
        missingMonths,
        warnings,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Sync failed." }, { status: 500 });
  }
}
