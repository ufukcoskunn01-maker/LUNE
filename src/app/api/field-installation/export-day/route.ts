import ExcelJS from "exceljs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
      date: url.searchParams.get("date") || "",
      format: (url.searchParams.get("format") || "xlsx").toLowerCase(),
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const { projectCode, date, format } = parsed.data;
    const admin = createAdminClient();

    const [materialsRes, laborRes] = await Promise.all([
      admin
        .from("field_installation_rows")
        .select("zone,floor,budget_code,activity_code,description,unit,qty,crew,raw")
        .eq("project_code", projectCode)
        .eq("work_date", date)
        .order("created_at", { ascending: true }),
      admin
        .from("field_installation_labor_rows")
        .select("team_no,employee_id,full_name,title,hours_indirect,hours_direct")
        .eq("project_code", projectCode)
        .eq("work_date", date)
        .order("created_at", { ascending: true }),
    ]);

    if (materialsRes.error) throw new Error(materialsRes.error.message);
    if (laborRes.error) throw new Error(laborRes.error.message);

    const materials = materialsRes.data || [];
    const labor = laborRes.data || [];
    const baseName = `${projectCode}-FieldInstallation-${date}`;

    if (format === "csv") {
      const materialLines = [csvLine(["zone", "floor", "budget_code", "activity_code", "description", "unit", "qty", "crew"])];
      for (const row of materials) {
        materialLines.push(
          csvLine([
            String(row.zone || ""),
            String(row.floor || ""),
            String(row.budget_code || ""),
            String(row.activity_code || ""),
            String(row.description || ""),
            String(row.unit || ""),
            Number(row.qty || 0),
            Number(row.crew || 0),
          ])
        );
      }
      materialLines.push("");
      materialLines.push(csvLine(["team_no", "employee_id", "full_name", "title", "hours_indirect", "hours_direct"]));
      for (const row of labor) {
        materialLines.push(
          csvLine([
            String(row.team_no || ""),
            String(row.employee_id || ""),
            String(row.full_name || ""),
            String(row.title || ""),
            Number(row.hours_indirect || 0),
            Number(row.hours_direct || 0),
          ])
        );
      }
      return new Response(`${materialLines.join("\n")}\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const materialsSheet = workbook.addWorksheet("Materials");
    materialsSheet.addRow(["zone", "floor", "budget_code", "activity_code", "description", "unit", "qty", "crew", "install_or_remove", "orientation"]);
    materialsSheet.getRow(1).font = { bold: true };
    for (const row of materials) {
      const raw = (row.raw || {}) as Record<string, unknown>;
      materialsSheet.addRow([
        row.zone || "",
        row.floor || "",
        row.budget_code || "",
        row.activity_code || "",
        row.description || "",
        row.unit || "",
        Number(row.qty || 0),
        Number(row.crew || 0),
        String(raw.install_or_remove || ""),
        String(raw.orientation || ""),
      ]);
    }

    const laborSheet = workbook.addWorksheet("Labor");
    laborSheet.addRow(["team_no", "employee_id", "full_name", "title", "hours_indirect", "hours_direct"]);
    laborSheet.getRow(1).font = { bold: true };
    for (const row of labor) {
      laborSheet.addRow([
        row.team_no || "",
        row.employee_id || "",
        row.full_name || "",
        row.title || "",
        Number(row.hours_indirect || 0),
        Number(row.hours_direct || 0),
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
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Export day failed." }, { status: 500 });
  }
}
