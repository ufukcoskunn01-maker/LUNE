import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { dayColumns31, DEFAULT_PROJECT_CODE, monthRange, parseMonthToken } from "@/lib/transportation/common";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuthedUser } from "@/lib/transportation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransportRunRow = {
  work_date: string;
  plate: string;
  trips: number;
};

function toCsvLine(values: Array<string | number | null>): string {
  return values
    .map((value) => {
      if (value === null || value === undefined) return "";
      const raw = String(value);
      if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
      return raw;
    })
    .join(",");
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const auth = await requireAuthedUser(supabase);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const projectCode = (url.searchParams.get("projectCode") || DEFAULT_PROJECT_CODE).trim();
    const month = (url.searchParams.get("month") || "").trim();
    const format = (url.searchParams.get("format") || "xlsx").trim().toLowerCase();

    if (!projectCode) {
      return NextResponse.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }
    if (!parseMonthToken(month)) {
      return NextResponse.json({ ok: false, error: "month must be YYYY-MM." }, { status: 400 });
    }
    if (format !== "xlsx" && format !== "csv") {
      return NextResponse.json({ ok: false, error: "format must be xlsx or csv." }, { status: 400 });
    }

    const range = monthRange(month);
    if (!range) {
      return NextResponse.json({ ok: false, error: "Invalid month." }, { status: 400 });
    }

    const [runsResult, platesResult] = await Promise.all([
      supabase
        .from("transport_runs")
        .select("work_date,plate,trips")
        .eq("project_code", projectCode)
        .gte("work_date", range.start)
        .lte("work_date", range.end),
      supabase.from("transport_plates").select("plate,is_active").eq("project_code", projectCode).eq("is_active", true),
    ]);

    if (runsResult.error) {
      return NextResponse.json({ ok: false, error: runsResult.error.message }, { status: 500 });
    }
    if (platesResult.error) {
      return NextResponse.json({ ok: false, error: platesResult.error.message }, { status: 500 });
    }

    const runs = (runsResult.data || []) as TransportRunRow[];
    const activePlates = (platesResult.data || []).map((row) => row.plate);
    const plates = Array.from(new Set([...activePlates, ...runs.map((row) => row.plate)])).sort((a, b) => a.localeCompare(b));

    const dayColumns = dayColumns31();
    const matrix = new Map<string, Record<string, number>>();
    for (const plate of plates) {
      const dayMap: Record<string, number> = {};
      for (const day of dayColumns) dayMap[day] = 0;
      matrix.set(plate, dayMap);
    }

    for (const run of runs) {
      const dayToken = run.work_date.slice(8, 10);
      const plateMap = matrix.get(run.plate);
      if (!plateMap || !plateMap[dayToken] && plateMap[dayToken] !== 0) continue;
      plateMap[dayToken] += Number(run.trips || 0);
    }

    const rows = plates.map((plate) => {
      const dayMap = matrix.get(plate) || {};
      const total = dayColumns.reduce((sum, day) => sum + Number(dayMap[day] || 0), 0);
      return { plate, dayMap, total };
    });

    const fileBase = `${projectCode}-Transportation-${month}`;
    const encodedBase = encodeURIComponent(fileBase);

    if (format === "csv") {
      const header = ["plate", ...dayColumns, "total"];
      const lines = [toCsvLine(header)];
      for (const row of rows) {
        const values: Array<string | number | null> = [
          row.plate,
          ...dayColumns.map((day) => {
            const dayNumber = Number(day);
            if (dayNumber > range.daysInMonth) return "";
            const value = row.dayMap[day] || 0;
            return value > 0 ? value : "";
          }),
          row.total,
        ];
        lines.push(toCsvLine(values));
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
    const sheet = workbook.addWorksheet("Transportation");
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const header = ["plate", ...dayColumns, "total"];
    sheet.addRow(header);
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow([
        row.plate,
        ...dayColumns.map((day) => {
          const dayNumber = Number(day);
          if (dayNumber > range.daysInMonth) return "";
          const value = row.dayMap[day] || 0;
          return value > 0 ? value : "";
        }),
        row.total,
      ]);
    }

    sheet.columns = [{ width: 16 }, ...dayColumns.map(() => ({ width: 6 })), { width: 10 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileBase}.xlsx"; filename*=UTF-8''${encodedBase}.xlsx`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transportation export failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
