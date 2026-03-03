import ExcelJS from "exceljs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(["csv", "xlsx"]).default("xlsx"),
});

function csvLine(values: Array<string | number>): string {
  return values
    .map((value) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    })
    .join(",");
}

function monthRange(token: string): { start: string; end: string; days: number } {
  const [y, m] = token.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(days).padStart(2, "0")}`,
    days,
  };
}

export async function GET(req: Request) {
  try {
    const sb = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
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
    const range = monthRange(month);
    const admin = createAdminClient();

    const rowsRes = await admin
      .from("field_installation_rows")
      .select("work_date,budget_code,activity_code,description,qty")
      .eq("project_code", projectCode)
      .gte("work_date", range.start)
      .lte("work_date", range.end);
    if (rowsRes.error) throw new Error(rowsRes.error.message);

    const byKey = new Map<string, { activity_code: string; description: string; day: Record<string, number>; total: number }>();
    for (const row of rowsRes.data || []) {
      const activity = String(row.activity_code || "").trim();
      const description = String(row.description || "").trim();
      const key = activity || description || "UNSPECIFIED";
      const day = String(row.work_date || "").slice(8, 10);
      const qty = Number(row.qty || 0);
      if (!byKey.has(key)) {
        byKey.set(key, { activity_code: activity, description, day: {}, total: 0 });
      }
      const bucket = byKey.get(key)!;
      bucket.day[day] = (bucket.day[day] || 0) + qty;
      bucket.total += qty;
    }

    const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
    const exportRows = Array.from(byKey.values()).sort((a, b) =>
      (a.activity_code || a.description).localeCompare(b.activity_code || b.description)
    );
    const baseName = `${projectCode}-FieldInstallation-${month}`;

    if (format === "csv") {
      const lines = [csvLine(["activity_code", "description", ...days, "TOTAL"])];
      for (const row of exportRows) {
        lines.push(
          csvLine([
            row.activity_code || "",
            row.description || "",
            ...days.map((d) => row.day[d] || ""),
            row.total,
          ])
        );
      }
      return new Response(`${lines.join("\n")}\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Field Installation");
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.addRow(["activity_code", "description", ...days, "TOTAL"]);
    sheet.getRow(1).font = { bold: true };
    for (const row of exportRows) {
      sheet.addRow([
        row.activity_code || "",
        row.description || "",
        ...days.map((d) => row.day[d] || ""),
        row.total,
      ]);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Export failed." }, { status: 500 });
  }
}
