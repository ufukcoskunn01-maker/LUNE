import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getMonthRowsFromLatestFiles } from "@/lib/installations/queries";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportRow = {
  activity_code: string | null;
  description: string | null;
  days: Record<string, number>;
  total: number;
};

function normalizeInstallationsError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lowered = message.toLowerCase();
  const missingInstallTable =
    lowered.includes("installation_files") ||
    lowered.includes("installation_rows") ||
    lowered.includes("installation_day_summary");
  const looksLikeSchemaIssue =
    lowered.includes("schema cache") ||
    lowered.includes("could not find the table") ||
    lowered.includes("relation") ||
    lowered.includes("does not exist");

  if (missingInstallTable && looksLikeSchemaIssue) {
    return "Installation schema is missing in Supabase. Run migrations 202602251300_installations.sql and 202602251430_installations_grants.sql, then retry.";
  }
  return message;
}

function isValidYearMonth(yearRaw: string, monthRaw: string): { year: number; month: number; daysInMonth: number } | null {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, daysInMonth };
}

function dayColumns(): string[] {
  return Array.from({ length: 31 }, (_, idx) => String(idx + 1).padStart(2, "0"));
}

function csvLine(values: Array<string | number>): string {
  return values
    .map((value) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    })
    .join(",");
}

function aggregateRows(args: {
  rows: Array<{
    work_date: string;
    activity_code: string | null;
    description: string | null;
    manhours: number | null;
    qty: number | null;
  }>;
  metric: "qty" | "manhours";
}): ExportRow[] {
  const bucket = new Map<string, ExportRow>();
  const metricKey = args.metric;

  for (const row of args.rows) {
    const activityCode = (row.activity_code || "").trim();
    const description = (row.description || "").trim();
    const groupKey = activityCode || description || "UNSPECIFIED";
    const day = row.work_date.slice(8, 10);
    const value = Number(metricKey === "qty" ? row.qty || 0 : row.manhours || 0);

    if (!bucket.has(groupKey)) {
      const dayMap: Record<string, number> = {};
      for (const token of dayColumns()) dayMap[token] = 0;
      bucket.set(groupKey, {
        activity_code: activityCode || null,
        description: description || null,
        days: dayMap,
        total: 0,
      });
    }

    const current = bucket.get(groupKey)!;
    current.days[day] = (current.days[day] || 0) + value;
    current.total += value;
  }

  return Array.from(bucket.values()).sort((a, b) => {
    const codeA = a.activity_code || "";
    const codeB = b.activity_code || "";
    return codeA.localeCompare(codeB) || (a.description || "").localeCompare(b.description || "");
  });
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const url = new URL(req.url);
    const projectCode = (url.searchParams.get("projectCode") || "A27").trim();
    const yearRaw = (url.searchParams.get("year") || "").trim();
    const monthRaw = (url.searchParams.get("month") || "").trim();
    const format = (url.searchParams.get("format") || "csv").trim().toLowerCase();
    const metric = (url.searchParams.get("metric") || "qty").trim().toLowerCase();

    if (!projectCode) {
      return NextResponse.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }
    const parsed = isValidYearMonth(yearRaw, monthRaw);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "year/month are required (YYYY, MM)." }, { status: 400 });
    }
    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json({ ok: false, error: "format must be csv or xlsx." }, { status: 400 });
    }
    if (metric !== "qty" && metric !== "manhours") {
      return NextResponse.json({ ok: false, error: "metric must be qty or manhours." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const monthToken = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    const rawRows = await getMonthRowsFromLatestFiles({
      supabase: db,
      projectCode,
      year: parsed.year,
      month: parsed.month,
    });
    const rows = aggregateRows({ rows: rawRows, metric: metric as "qty" | "manhours" });
    const days = dayColumns();
    const fileBase = `${projectCode}-Installations-${monthToken}-${metric}`;
    const encodedBase = encodeURIComponent(fileBase);

    if (format === "csv") {
      const header = ["activity_code", "description", ...days, "TOTAL"];
      const lines = [csvLine(header)];
      for (const row of rows) {
        const values: Array<string | number> = [
          row.activity_code || "",
          row.description || "",
          ...days.map((day) => {
            const dayNum = Number(day);
            if (dayNum > parsed.daysInMonth) return "";
            const value = row.days[day] || 0;
            return value === 0 ? "" : value;
          }),
          row.total,
        ];
        lines.push(csvLine(values));
      }

      const csv = `${lines.join("\n")}\n`;
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileBase}.csv"; filename*=UTF-8''${encodedBase}.csv`,
          "Cache-Control": "no-store",
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LUNE";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Installation Month");
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    sheet.addRow(["activity_code", "description", ...days, "TOTAL"]);
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow([
        row.activity_code || "",
        row.description || "",
        ...days.map((day) => {
          const dayNum = Number(day);
          if (dayNum > parsed.daysInMonth) return "";
          const value = row.days[day] || 0;
          return value === 0 ? "" : value;
        }),
        row.total,
      ]);
    }

    sheet.columns = [{ width: 16 }, { width: 32 }, ...days.map(() => ({ width: 6 })), { width: 12 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileBase}.xlsx"; filename*=UTF-8''${encodedBase}.xlsx`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = normalizeInstallationsError(error, "Installation month export failed.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
