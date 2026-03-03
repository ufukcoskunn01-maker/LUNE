import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstallationStorageFile } from "@/lib/installations/discover";
import type { InstallationRowInput } from "@/lib/installations/parser";

export type InstallationFileRow = {
  id: string;
  project_code: string;
  work_date: string;
  rev: number;
  filename: string;
  storage_path: string;
  file_size: number | null;
  last_modified: string | null;
  parsed_rows: number;
  created_at: string;
};

export type InstallationSummaryRow = {
  project_code: string;
  work_date: string;
  latest_file_id: string;
  rows_count: number;
  total_manhours: number | null;
  total_qty: number | null;
  updated_at: string;
};

function sameTimestamp(a: string | null, b: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function monthRange(year: number, month: number): { start: string; end: string; daysInMonth: number } {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
    daysInMonth,
  };
}

type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function isMissingTableError(error: PostgrestErrorLike | null | undefined, tableName: string): boolean {
  if (!error) return false;

  const target = tableName.toLowerCase();
  const joined = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  const mentionsTarget =
    joined.includes(`public.${target}`) ||
    joined.includes(`'public.${target}'`) ||
    joined.includes(`"${target}"`) ||
    joined.includes(`"${`public.${target}`}"`);

  if (error.code === "PGRST205" && mentionsTarget) return true;
  if (error.code === "42P01" && mentionsTarget) return true;

  return (
    mentionsTarget &&
    (joined.includes("could not find the table") ||
      joined.includes("schema cache") ||
      joined.includes("relation") ||
      joined.includes("does not exist"))
  );
}

async function loadLatestFilesByDate(args: {
  supabase: SupabaseClient;
  projectCode: string;
  start: string;
  end: string;
}): Promise<
  Map<
    string,
    {
      id: string;
      work_date: string;
      rev: number;
      filename: string;
    }
  >
> {
  const { supabase, projectCode, start, end } = args;
  const filesResult = await supabase
    .from("installation_files")
    .select("id,work_date,rev,filename,last_modified,created_at")
    .eq("project_code", projectCode)
    .gte("work_date", start)
    .lte("work_date", end)
    .order("work_date", { ascending: true })
    .order("rev", { ascending: false })
    .order("last_modified", { ascending: false })
    .order("created_at", { ascending: false });

  if (filesResult.error) throw new Error(filesResult.error.message);

  const byDate = new Map<
    string,
    {
      id: string;
      work_date: string;
      rev: number;
      filename: string;
    }
  >();
  for (const file of filesResult.data || []) {
    if (!byDate.has(file.work_date)) {
      byDate.set(file.work_date, {
        id: file.id,
        work_date: file.work_date,
        rev: file.rev,
        filename: file.filename,
      });
    }
  }
  return byDate;
}

export async function upsertInstallationFileMeta(args: {
  supabase: SupabaseClient;
  file: InstallationStorageFile;
}): Promise<{ row: InstallationFileRow; needsParsing: boolean }> {
  const { supabase, file } = args;
  const { data: existing, error: existingError } = await supabase
    .from("installation_files")
    .select("*")
    .eq("storage_path", file.storagePath)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingRow = (existing || null) as InstallationFileRow | null;
  const needsParsing =
    !existingRow ||
    (existingRow.parsed_rows || 0) === 0 ||
    existingRow.file_size !== file.fileSize ||
    !sameTimestamp(existingRow.last_modified, file.lastModified) ||
    existingRow.work_date !== file.workDate ||
    existingRow.rev !== file.rev;

  const payload = {
    project_code: file.projectCode,
    work_date: file.workDate,
    rev: file.rev,
    filename: file.filename,
    storage_path: file.storagePath,
    file_size: file.fileSize,
    last_modified: file.lastModified,
    parsed_rows: existingRow?.parsed_rows || 0,
  };

  const { data: upserted, error: upsertError } = await supabase
    .from("installation_files")
    .upsert(payload, { onConflict: "storage_path" })
    .select("*")
    .single();

  if (upsertError || !upserted) {
    throw new Error(upsertError?.message || "Failed to upsert installation file.");
  }

  return { row: upserted as InstallationFileRow, needsParsing };
}

export async function replaceInstallationRows(args: {
  supabase: SupabaseClient;
  file: InstallationFileRow;
  rows: InstallationRowInput[];
}): Promise<number> {
  const { supabase, file, rows } = args;

  const deleteResult = await supabase.from("installation_rows").delete().eq("file_id", file.id);
  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  if (!rows.length) {
    const update = await supabase.from("installation_files").update({ parsed_rows: 0 }).eq("id", file.id);
    if (update.error) throw new Error(update.error.message);
    return 0;
  }

  const insertPayload = rows.map((row) => ({
    file_id: file.id,
    project_code: file.project_code,
    work_date: row.work_date || file.work_date,
    budget_code: row.budget_code,
    activity_code: row.activity_code,
    description: row.description,
    manhours: row.manhours,
    qty: row.qty,
    uom: row.uom,
    turk_count: row.turk_count,
    local_count: row.local_count,
    turk_adsa: row.turk_adsa,
    local_adsa: row.local_adsa,
  }));

  let inserted = 0;
  for (let idx = 0; idx < insertPayload.length; idx += 500) {
    const chunk = insertPayload.slice(idx, idx + 500);
    const { error } = await supabase.from("installation_rows").insert(chunk);
    if (error) {
      throw new Error(error.message);
    }
    inserted += chunk.length;
  }

  const update = await supabase.from("installation_files").update({ parsed_rows: inserted }).eq("id", file.id);
  if (update.error) throw new Error(update.error.message);

  return inserted;
}

export async function recomputeDaySummaries(args: {
  supabase: SupabaseClient;
  projectCode: string;
  workDates: string[];
}): Promise<number> {
  const { supabase, projectCode } = args;
  const uniqueDates = Array.from(new Set(args.workDates)).sort();
  let affected = 0;

  for (const date of uniqueDates) {
    const latestFileResult = await supabase
      .from("installation_files")
      .select("id,work_date,rev,last_modified,created_at")
      .eq("project_code", projectCode)
      .eq("work_date", date)
      .order("rev", { ascending: false })
      .order("last_modified", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestFileResult.error) throw new Error(latestFileResult.error.message);
    const latestFile = latestFileResult.data as { id: string } | null;

    if (!latestFile?.id) {
      const del = await supabase
        .from("installation_day_summary")
        .delete()
        .eq("project_code", projectCode)
        .eq("work_date", date);
      if (del.error) {
        if (isMissingTableError(del.error, "installation_day_summary")) {
          return 0;
        }
        throw new Error(del.error.message);
      }
      affected += 1;
      continue;
    }

    const rowResult = await supabase
      .from("installation_rows")
      .select("manhours,qty", { count: "exact" })
      .eq("file_id", latestFile.id);
    if (rowResult.error) throw new Error(rowResult.error.message);

    const rows = rowResult.data || [];
    const rowsCount = Number(rowResult.count || 0);
    let totalManhours = 0;
    let totalQty = 0;
    for (const row of rows as Array<{ manhours: unknown; qty: unknown }>) {
      totalManhours += toNumber(row.manhours);
      totalQty += toNumber(row.qty);
    }

    const upsert = await supabase.from("installation_day_summary").upsert(
      {
        project_code: projectCode,
        work_date: date,
        latest_file_id: latestFile.id,
        rows_count: rowsCount,
        total_manhours: totalManhours,
        total_qty: totalQty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_code,work_date" }
    );
    if (upsert.error) {
      if (isMissingTableError(upsert.error, "installation_day_summary")) {
        return 0;
      }
      throw new Error(upsert.error.message);
    }
    affected += 1;
  }

  return affected;
}

export async function getCalendarMonth(args: {
  supabase: SupabaseClient;
  projectCode: string;
  year: number;
  month: number;
}): Promise<
  Array<{
    work_date: string;
    has_report: boolean;
    rows_count: number;
    total_manhours: number;
    total_qty: number;
    latest_rev: number | null;
    latest_filename: string | null;
  }>
> {
  const { supabase, projectCode, year, month } = args;
  const range = monthRange(year, month);

  const summaryResult = await supabase
    .from("installation_day_summary")
    .select("work_date,latest_file_id,rows_count,total_manhours,total_qty")
    .eq("project_code", projectCode)
    .gte("work_date", range.start)
    .lte("work_date", range.end)
    .order("work_date", { ascending: true });

  let summaries = summaryResult.data || [];

  if (summaryResult.error) {
    if (!isMissingTableError(summaryResult.error, "installation_day_summary")) {
      throw new Error(summaryResult.error.message);
    }

    const latestByDate = await loadLatestFilesByDate({
      supabase,
      projectCode,
      start: range.start,
      end: range.end,
    });

    const fileIds = Array.from(latestByDate.values()).map((item) => item.id);
    const rowAggByFile = new Map<string, { rows_count: number; total_manhours: number; total_qty: number }>();
    if (fileIds.length) {
      const rowsResult = await supabase
        .from("installation_rows")
        .select("file_id,manhours,qty")
        .in("file_id", fileIds);
      if (rowsResult.error) throw new Error(rowsResult.error.message);

      for (const row of rowsResult.data || []) {
        const key = row.file_id as string;
        const bucket = rowAggByFile.get(key) || { rows_count: 0, total_manhours: 0, total_qty: 0 };
        bucket.rows_count += 1;
        bucket.total_manhours += toNumber(row.manhours);
        bucket.total_qty += toNumber(row.qty);
        rowAggByFile.set(key, bucket);
      }
    }

    summaries = Array.from(latestByDate.values()).map((file) => {
      const agg = rowAggByFile.get(file.id) || { rows_count: 0, total_manhours: 0, total_qty: 0 };
      return {
        work_date: file.work_date,
        latest_file_id: file.id,
        rows_count: agg.rows_count,
        total_manhours: agg.total_manhours,
        total_qty: agg.total_qty,
      };
    });
  }

  const fileIds = summaries.map((row) => row.latest_file_id).filter(Boolean);
  const fileMap = new Map<string, { rev: number; filename: string }>();
  if (fileIds.length) {
    const filesResult = await supabase
      .from("installation_files")
      .select("id,rev,filename")
      .in("id", fileIds as string[]);
    if (filesResult.error) throw new Error(filesResult.error.message);
    for (const file of filesResult.data || []) {
      fileMap.set(file.id, { rev: file.rev, filename: file.filename });
    }
  }

  const summaryByDate = new Map(
    summaries.map((row) => [
      row.work_date,
      {
        rows_count: Number(row.rows_count || 0),
        total_manhours: toNumber(row.total_manhours),
        total_qty: toNumber(row.total_qty),
        latest_file_id: row.latest_file_id as string,
      },
    ])
  );

  const rows: Array<{
    work_date: string;
    has_report: boolean;
    rows_count: number;
    total_manhours: number;
    total_qty: number;
    latest_rev: number | null;
    latest_filename: string | null;
  }> = [];

  for (let day = 1; day <= range.daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const summary = summaryByDate.get(date);
    const latestMeta = summary?.latest_file_id ? fileMap.get(summary.latest_file_id) : null;
    rows.push({
      work_date: date,
      has_report: Boolean(summary),
      rows_count: summary?.rows_count || 0,
      total_manhours: summary?.total_manhours || 0,
      total_qty: summary?.total_qty || 0,
      latest_rev: latestMeta?.rev ?? null,
      latest_filename: latestMeta?.filename ?? null,
    });
  }

  return rows;
}

export async function getDayDetail(args: {
  supabase: SupabaseClient;
  projectCode: string;
  date: string;
}): Promise<{
  latestFile: InstallationFileRow | null;
  rows: Array<{
    id: number;
    budget_code: string | null;
    activity_code: string | null;
    description: string | null;
    manhours: number | null;
    qty: number | null;
    uom: string | null;
  }>;
  totals: {
    rows_count: number;
    total_manhours: number;
    total_qty: number;
    distinct_activity_codes: number;
    distinct_budget_codes: number;
  };
  pivotActivity: Array<{ key: string; qty: number; manhours: number }>;
  pivotBudget: Array<{ key: string; qty: number; manhours: number }>;
}> {
  const { supabase, projectCode, date } = args;
  const latestFileResult = await supabase
    .from("installation_files")
    .select("*")
    .eq("project_code", projectCode)
    .eq("work_date", date)
    .order("rev", { ascending: false })
    .order("last_modified", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestFileResult.error) throw new Error(latestFileResult.error.message);

  const latestFile = (latestFileResult.data || null) as InstallationFileRow | null;
  if (!latestFile) {
    return {
      latestFile: null,
      rows: [],
      totals: {
        rows_count: 0,
        total_manhours: 0,
        total_qty: 0,
        distinct_activity_codes: 0,
        distinct_budget_codes: 0,
      },
      pivotActivity: [],
      pivotBudget: [],
    };
  }

  const rowsResult = await supabase
    .from("installation_rows")
    .select("id,budget_code,activity_code,description,manhours,qty,uom")
    .eq("file_id", latestFile.id)
    .order("id", { ascending: true });
  if (rowsResult.error) throw new Error(rowsResult.error.message);

  const rows = (rowsResult.data || []) as Array<{
    id: number;
    budget_code: string | null;
    activity_code: string | null;
    description: string | null;
    manhours: number | null;
    qty: number | null;
    uom: string | null;
  }>;

  let totalManhours = 0;
  let totalQty = 0;
  const activitySet = new Set<string>();
  const budgetSet = new Set<string>();
  const activityMap = new Map<string, { qty: number; manhours: number }>();
  const budgetMap = new Map<string, { qty: number; manhours: number }>();

  for (const row of rows) {
    const qty = toNumber(row.qty);
    const manhours = toNumber(row.manhours);
    totalQty += qty;
    totalManhours += manhours;

    const activityKey = (row.activity_code || row.description || "UNSPECIFIED").trim() || "UNSPECIFIED";
    const budgetKey = (row.budget_code || "UNSPECIFIED").trim() || "UNSPECIFIED";

    if (row.activity_code) activitySet.add(row.activity_code);
    if (row.budget_code) budgetSet.add(row.budget_code);

    const activityBucket = activityMap.get(activityKey) || { qty: 0, manhours: 0 };
    activityBucket.qty += qty;
    activityBucket.manhours += manhours;
    activityMap.set(activityKey, activityBucket);

    const budgetBucket = budgetMap.get(budgetKey) || { qty: 0, manhours: 0 };
    budgetBucket.qty += qty;
    budgetBucket.manhours += manhours;
    budgetMap.set(budgetKey, budgetBucket);
  }

  const pivotActivity = Array.from(activityMap.entries())
    .map(([key, value]) => ({ key, qty: value.qty, manhours: value.manhours }))
    .sort((a, b) => b.qty - a.qty || b.manhours - a.manhours || a.key.localeCompare(b.key));

  const pivotBudget = Array.from(budgetMap.entries())
    .map(([key, value]) => ({ key, qty: value.qty, manhours: value.manhours }))
    .sort((a, b) => b.qty - a.qty || b.manhours - a.manhours || a.key.localeCompare(b.key));

  return {
    latestFile,
    rows,
    totals: {
      rows_count: rows.length,
      total_manhours: totalManhours,
      total_qty: totalQty,
      distinct_activity_codes: activitySet.size,
      distinct_budget_codes: budgetSet.size,
    },
    pivotActivity,
    pivotBudget,
  };
}

export async function getMonthRowsFromLatestFiles(args: {
  supabase: SupabaseClient;
  projectCode: string;
  year: number;
  month: number;
}): Promise<
  Array<{
    work_date: string;
    activity_code: string | null;
    description: string | null;
    manhours: number | null;
    qty: number | null;
  }>
> {
  const { supabase, projectCode, year, month } = args;
  const range = monthRange(year, month);

  const summaryResult = await supabase
    .from("installation_day_summary")
    .select("latest_file_id,work_date")
    .eq("project_code", projectCode)
    .gte("work_date", range.start)
    .lte("work_date", range.end);
  let fileIds = (summaryResult.data || []).map((row) => row.latest_file_id).filter(Boolean);
  if (summaryResult.error) {
    if (!isMissingTableError(summaryResult.error, "installation_day_summary")) {
      throw new Error(summaryResult.error.message);
    }

    const latestByDate = await loadLatestFilesByDate({
      supabase,
      projectCode,
      start: range.start,
      end: range.end,
    });
    fileIds = Array.from(latestByDate.values()).map((item) => item.id);
  }

  if (!fileIds.length) return [];

  const rowsResult = await supabase
    .from("installation_rows")
    .select("work_date,activity_code,description,manhours,qty")
    .in("file_id", fileIds as string[]);
  if (rowsResult.error) throw new Error(rowsResult.error.message);
  return (rowsResult.data || []) as Array<{
    work_date: string;
    activity_code: string | null;
    description: string | null;
    manhours: number | null;
    qty: number | null;
  }>;
}
