import ExcelJS from "exceljs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listMonthFieldReports } from "@/lib/field-reports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/),
  format: z.enum(["csv", "xlsx"]).default("xlsx"),
});

type AggregatedRow = {
  date: string;
  parseStatus: string;
  zone: string;
  floor: string;
  system: string;
  activityCode: string;
  materialCode: string;
  itemName: string;
  unit: string;
  qty: number;
};

function csvCell(value: string | number): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function buildCsv(rows: AggregatedRow[]): string {
  const headers = [
    "date",
    "parse_status",
    "zone",
    "floor",
    "system",
    "activity_code",
    "material_code",
    "item_name",
    "unit",
    "qty_total",
  ];

  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.parseStatus,
        row.zone,
        row.floor,
        row.system,
        row.activityCode,
        row.materialCode,
        row.itemName,
        row.unit,
        row.qty,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

function aggregateRows(args: {
  reports: Awaited<ReturnType<typeof listMonthFieldReports>>;
  items: Array<{
    report_id: string;
    zone: string | null;
    floor: string | null;
    system: string | null;
    activity_code: string | null;
    material_code: string | null;
    item_name: string | null;
    unit: string | null;
    qty: number | null;
  }>;
}): AggregatedRow[] {
  const reportMeta = new Map(
    args.reports.map((report) => [report.id, { date: report.work_date, parseStatus: report.parse_status }])
  );
  const map = new Map<string, AggregatedRow>();

  for (const item of args.items) {
    const meta = reportMeta.get(item.report_id);
    if (!meta) continue;

    const row: AggregatedRow = {
      date: meta.date,
      parseStatus: meta.parseStatus,
      zone: item.zone || "",
      floor: item.floor || "",
      system: item.system || "",
      activityCode: item.activity_code || "",
      materialCode: item.material_code || "",
      itemName: item.item_name || "",
      unit: item.unit || "",
      qty: Number(item.qty || 0),
    };

    const key = [
      row.date,
      row.parseStatus,
      row.zone,
      row.floor,
      row.system,
      row.activityCode,
      row.materialCode,
      row.itemName,
      row.unit,
    ].join("|");

    const existing = map.get(key);
    if (existing) {
      existing.qty += row.qty;
    } else {
      map.set(key, row);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
    if (a.materialCode !== b.materialCode) return a.materialCode.localeCompare(b.materialCode);
    return a.itemName.localeCompare(b.itemName);
  });

  return rows;
}

export async function GET(req: Request) {
  try {
    const userClient = await supabaseServer();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      projectCode: url.searchParams.get("projectCode") || "A27",
      month: url.searchParams.get("month") || "",
      format: (url.searchParams.get("format") || "xlsx").toLowerCase(),
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const { projectCode, month, format } = parsed.data;
    const admin = supabaseAdmin();
    const reports = await listMonthFieldReports({
      supabase: admin,
      projectCode,
      monthToken: month,
    });

    const reportIds = reports.map((report) => report.id);
    const itemsResult = reportIds.length
      ? await admin
          .from("field_report_items")
          .select("report_id,zone,floor,system,activity_code,material_code,item_name,unit,qty")
          .in("report_id", reportIds)
      : { data: [], error: null };

    if (itemsResult.error) {
      throw new Error(itemsResult.error.message);
    }

    const rows = aggregateRows({
      reports,
      items: (itemsResult.data || []) as Array<{
        report_id: string;
        zone: string | null;
        floor: string | null;
        system: string | null;
        activity_code: string | null;
        material_code: string | null;
        item_name: string | null;
        unit: string | null;
        qty: number | null;
      }>,
    });

    const baseName = `${projectCode}-DailyInstallationReports-${month}`;
    const encodedName = encodeURIComponent(baseName);

    if (format === "csv") {
      const csv = buildCsv(rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${baseName}.csv"; filename*=UTF-8''${encodedName}.csv`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LUNE";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Daily Installation Reports");
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    sheet.addRow([
      "date",
      "parse_status",
      "zone",
      "floor",
      "system",
      "activity_code",
      "material_code",
      "item_name",
      "unit",
      "qty_total",
    ]);
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow([
        row.date,
        row.parseStatus,
        row.zone,
        row.floor,
        row.system,
        row.activityCode,
        row.materialCode,
        row.itemName,
        row.unit,
        row.qty,
      ]);
    }

    sheet.columns = [
      { width: 12 },
      { width: 12 },
      { width: 16 },
      { width: 10 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 42 },
      { width: 10 },
      { width: 12 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"; filename*=UTF-8''${encodedName}.xlsx`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
