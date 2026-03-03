export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase/admin";

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "imports";

type StorageObject = {
  storagePath: string;
  fileName: string;
  sourceRoot: string;
  detectedDate: string | null;
  alreadyImported: boolean;
};

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
}

function monthLabel(monthIndex: number): string {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return names[monthIndex] || "Unknown";
}

function monthBounds(dateIso: string) {
  const dt = new Date(`${dateIso}T00:00:00Z`);
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { year, month, first, last };
}

function parseDateFromToken(token: string, contextYear: number, contextMonth: number): string | null {
  if (!/^\d{6}$/.test(token)) return null;

  // DDMMYY
  const dd = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const yy = Number(token.slice(4, 6));
  const yearFromDdMmYy = yy >= 90 ? 1900 + yy : 2000 + yy;
  if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
    if (yearFromDdMmYy === contextYear && mm === contextMonth + 1) {
      return `${yearFromDdMmYy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  // YYMMDD
  const yy2 = Number(token.slice(0, 2));
  const mm2 = Number(token.slice(2, 4));
  const dd2 = Number(token.slice(4, 6));
  const yearFromYyMmDd = yy2 >= 90 ? 1900 + yy2 : 2000 + yy2;
  if (dd2 >= 1 && dd2 <= 31 && mm2 >= 1 && mm2 <= 12) {
    if (yearFromYyMmDd === contextYear && mm2 === contextMonth + 1) {
      return `${yearFromYyMmDd}-${String(mm2).padStart(2, "0")}-${String(dd2).padStart(2, "0")}`;
    }
  }

  return null;
}

function detectDateFromFilename(fileName: string, contextYear: number, contextMonth: number): string | null {
  const tokenMatch = fileName.match(/(\d{6})(?=_rev|\b)/i);
  if (!tokenMatch) return null;
  return parseDateFromToken(tokenMatch[1], contextYear, contextMonth);
}

function isFolderRow(row: { name?: unknown; metadata?: unknown }): boolean {
  const name = asString(row.name);
  if (!name) return false;
  const metadata = ((row.metadata as UnknownRecord) || {}) as UnknownRecord;
  if (typeof metadata.size === "number" || typeof metadata.mimetype === "string") return false;
  return !/\.[a-z0-9]{1,8}$/i.test(name);
}

async function listPrefixFilesRecursive(prefix: string): Promise<string[]> {
  const sb = supabaseAdmin();
  const paths: string[] = [];
  const queue: string[] = [prefix];
  const visited = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    let offset = 0;
    for (;;) {
      const { data, error } = await sb.storage.from(STORAGE_BUCKET).list(current, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) break;

      const rows = data || [];
      for (const row of rows) {
        const name = asString(row.name);
        if (!name) continue;
        const full = `${current}/${name}`;
        if (isFolderRow(row)) queue.push(full);
        else paths.push(full);
      }
      if (rows.length < 1000) break;
      offset += 1000;
    }
  }

  return paths;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectCode = url.searchParams.get("projectCode") || "A27";
    const date = url.searchParams.get("date");
    if (!date) {
      return Response.json({ ok: false, error: "date is required (YYYY-MM-DD)." }, { status: 400 });
    }

    const { year, month, first, last } = monthBounds(date);
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const folder = `${year}/${String(month + 1).padStart(2, "0")}-${monthLabel(month)}`;
    const roots = [
      `${projectCode}/attendance/${year}`,
      `${projectCode}/1-Daily Personal Reports/${year}`,
      `${projectCode}/attendance/${folder}`,
      `${projectCode}/1-Daily Personal Reports/${folder}`,
    ];

    const sb = supabaseAdmin();
    const { data: project, error: projectErr } = await sb
      .from("projects")
      .select("id")
      .eq("code", projectCode)
      .maybeSingle();
    if (projectErr) throw new Error(projectErr.message);
    if (!project?.id) throw new Error(`Project not found: ${projectCode}`);

    const [{ data: attendanceRows, error: attendanceErr }, { data: fileRows, error: fileErr }, { data: jobRows, error: jobErr }] =
      await Promise.all([
        sb
          .from("attendance_records")
          .select("work_date")
          .eq("project_id", project.id)
          .gte("work_date", first)
          .lte("work_date", last),
        sb
          .from("files")
          .select("storage_path,meta")
          .eq("project_id", project.id)
          .eq("logical_name", "attendance_daily")
          .order("created_at", { ascending: false })
          .limit(5000),
        sb
          .from("import_jobs")
          .select("status,request_meta")
          .eq("project_id", project.id)
          .eq("type", "import-attendance")
          .order("started_at", { ascending: false })
          .limit(5000),
      ]);

    if (attendanceErr) throw new Error(attendanceErr.message);
    if (fileErr) throw new Error(fileErr.message);
    if (jobErr) throw new Error(jobErr.message);

    const monthDatesWithData = Array.from(
      new Set((attendanceRows || []).map((row) => asString((row as UnknownRecord).work_date)).filter(Boolean))
    ).sort();

    const importedPathSet = new Set<string>();
    const importedDateSet = new Set<string>();
    for (const row of (fileRows || []) as UnknownRecord[]) {
      const storagePath = asString(row.storage_path);
      if (storagePath) importedPathSet.add(storagePath);
      const meta = row.meta as UnknownRecord;
      const metaDate = asString(meta?.workDate);
      if (metaDate.startsWith(monthPrefix)) importedDateSet.add(metaDate);
    }

    const importJobDateSet = new Set<string>();
    for (const row of (jobRows || []) as UnknownRecord[]) {
      const status = asString(row.status).toLowerCase();
      if (status !== "succeeded") continue;
      const requestMeta = (row.request_meta || {}) as UnknownRecord;
      const requestDate = asString(requestMeta.workDate);
      if (requestDate.startsWith(monthPrefix)) importJobDateSet.add(requestDate);
    }

    const objects: StorageObject[] = [];
    for (const root of roots) {
      const paths = await listPrefixFilesRecursive(root);
      for (const storagePath of paths) {
        const fileName = storagePath.split("/").pop() || storagePath;
        const detectedDate = detectDateFromFilename(fileName, year, month);
        if (!detectedDate) continue;
        objects.push({
          storagePath,
          fileName,
          sourceRoot: root,
          detectedDate,
          alreadyImported: importedPathSet.has(storagePath) || importedDateSet.has(detectedDate),
        });
      }
    }

    const dedup = new Map<string, StorageObject>();
    for (const obj of objects) {
      const prev = dedup.get(obj.storagePath);
      if (!prev) dedup.set(obj.storagePath, obj);
    }

    const files = Array.from(dedup.values()).sort((a, b) => {
      if (a.detectedDate !== b.detectedDate) return String(a.detectedDate).localeCompare(String(b.detectedDate));
      return a.fileName.localeCompare(b.fileName);
    });

    return Response.json({
      ok: true,
      data: {
        projectCode,
        date,
        folderCandidates: roots,
        monthDatesWithData,
        hasImportedFileForDate: importedDateSet.has(date),
        hasImportJobForDate: importJobDateSet.has(date),
        filesForDate: files.filter((item) => item.detectedDate === date),
        files,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
