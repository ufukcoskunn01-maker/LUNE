import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFieldReportByDate, listFieldReportItems } from "@/lib/field-reports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type AttendanceRow = {
  employee_id: string;
  full_name: string;
  company: string | null;
  profession_grouped: string | null;
  status: "Present" | "Absent";
  segment: string;
  discipline: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

async function loadAttendanceSnapshot(args: {
  admin: ReturnType<typeof supabaseAdmin>;
  projectCode: string;
  workDate: string;
}) {
  const project = await args.admin.from("projects").select("id").eq("code", args.projectCode).maybeSingle();
  if (project.error || !project.data?.id) {
    return {
      matrix: {},
      presentCount: 0,
      totalCount: 0,
      peoplePreview: [] as Array<{ employee_id: string; full_name: string; company: string | null; profession_grouped: string | null }>,
    };
  }

  const records = await args.admin
    .from("attendance_records")
    .select("employee_id,full_name,company,profession_grouped,status,segment,discipline")
    .eq("project_id", project.data.id)
    .eq("work_date", args.workDate);

  if (records.error) {
    return {
      matrix: {},
      presentCount: 0,
      totalCount: 0,
      peoplePreview: [] as Array<{ employee_id: string; full_name: string; company: string | null; profession_grouped: string | null }>,
    };
  }

  const matrix: Record<string, Record<string, { present: number; absent: number; total: number }>> = {};
  const peoplePreview: Array<{ employee_id: string; full_name: string; company: string | null; profession_grouped: string | null }> = [];
  let presentCount = 0;

  for (const row of (records.data || []) as AttendanceRow[]) {
    if (!matrix[row.segment]) matrix[row.segment] = {};
    if (!matrix[row.segment][row.discipline]) {
      matrix[row.segment][row.discipline] = { present: 0, absent: 0, total: 0 };
    }
    const cell = matrix[row.segment][row.discipline];
    if (row.status === "Present") {
      cell.present += 1;
      presentCount += 1;
      peoplePreview.push({
        employee_id: row.employee_id,
        full_name: row.full_name,
        company: row.company,
        profession_grouped: row.profession_grouped,
      });
    } else {
      cell.absent += 1;
    }
    cell.total += 1;
  }

  return {
    matrix,
    presentCount,
    totalCount: (records.data || []).length,
    peoplePreview: peoplePreview.slice(0, 80),
  };
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
      date: url.searchParams.get("date") || "",
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid query." }, { status: 400 });
    }

    const { projectCode, date } = parsed.data;
    const admin = supabaseAdmin();

    const report = await getFieldReportByDate({
      supabase: admin,
      projectCode,
      workDate: date,
    });

    const fieldReportItems = report
      ? await listFieldReportItems({
          supabase: admin,
          reportId: report.id,
        })
      : [];

    let totalQty = 0;
    const zoneSet = new Set<string>();
    const floorSet = new Set<string>();
    const materialSet = new Set<string>();
    const attendance = await loadAttendanceSnapshot({ admin, projectCode, workDate: date });

    if (!report) {
      return NextResponse.json({
        ok: true,
        data: {
          projectCode,
          date,
          meta: null,
          summary: {},
          totals: {
            itemCount: 0,
            totalQty: 0,
            distinctZones: 0,
            distinctFloors: 0,
            distinctMaterials: 0,
          },
          items: [],
          attendance,
        },
      });
    }

    for (const item of fieldReportItems) {
      totalQty += toNumber(item.qty);
      if (item.zone) zoneSet.add(item.zone);
      if (item.floor) floorSet.add(item.floor);
      if (item.material_code) materialSet.add(item.material_code);
    }

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        date,
        meta: report,
        summary: report.summary || {},
        totals: {
          itemCount: fieldReportItems.length,
          totalQty,
          distinctZones: zoneSet.size,
          distinctFloors: floorSet.size,
          distinctMaterials: materialSet.size,
        },
        items: fieldReportItems,
        attendance,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load day report.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
