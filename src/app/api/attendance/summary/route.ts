export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase/admin";

const SEGMENTS = ["Indirect", "Direct", "Mobilization"] as const;
const DISCS = ["Electrical", "Mechanical", "Shared"] as const;
type Segment = (typeof SEGMENTS)[number];
type Discipline = (typeof DISCS)[number];
type DisciplineOrTotal = Discipline | "Total";
type CellCounts = { present: number; absent: number; total: number };
type MatrixRow = Record<DisciplineOrTotal, CellCounts>;
type SummaryMatrix = Record<Segment, MatrixRow>;
type ColumnTotals = Record<DisciplineOrTotal, CellCounts>;

function createCellCounts(): CellCounts {
  return { present: 0, absent: 0, total: 0 };
}

function createMatrixRow(): MatrixRow {
  return {
    Electrical: createCellCounts(),
    Mechanical: createCellCounts(),
    Shared: createCellCounts(),
    Total: createCellCounts(),
  };
}

function isSegment(value: string): value is Segment {
  return SEGMENTS.includes(value as Segment);
}

function isDiscipline(value: string): value is Discipline {
  return DISCS.includes(value as Discipline);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectCode = url.searchParams.get("projectCode") || "A27";
  const date = url.searchParams.get("date");
  if (!date) return Response.json({ ok: false, error: "date required (YYYY-MM-DD)" }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: proj, error: projErr } = await sb
    .from("projects")
    .select("id")
    .eq("code", projectCode)
    .maybeSingle();

  if (projErr) return Response.json({ ok: false, error: projErr.message }, { status: 500 });
  if (!proj) return Response.json({ ok: false, error: `Project not found: ${projectCode}` }, { status: 404 });

  const { data, error } = await sb
    .from("attendance_records")
    .select("segment,discipline,status")
    .eq("project_id", proj.id)
    .eq("work_date", date);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // matrix[segment][discipline] = {present, absent, total}
  const matrix: SummaryMatrix = {
    Indirect: createMatrixRow(),
    Direct: createMatrixRow(),
    Mobilization: createMatrixRow(),
  };
  const grand: CellCounts = { present: 0, absent: 0, total: 0 };

  for (const r of data ?? []) {
    const seg = r.segment as string;
    const disc = r.discipline as string;
    const st = r.status as string;

    if (!isSegment(seg) || !isDiscipline(disc)) continue;

    if (st === "Present") matrix[seg][disc].present++;
    else if (st === "Absent") matrix[seg][disc].absent++;
    matrix[seg][disc].total++;

    if (st === "Present") matrix[seg]["Total"].present++;
    else if (st === "Absent") matrix[seg]["Total"].absent++;
    matrix[seg]["Total"].total++;
  }

  // Add column totals
  const colTotals: ColumnTotals = {
    Electrical: createCellCounts(),
    Mechanical: createCellCounts(),
    Shared: createCellCounts(),
    Total: createCellCounts(),
  };
  for (const d of [...DISCS, "Total"] as const) colTotals[d] = { present: 0, absent: 0, total: 0 };

  for (const s of SEGMENTS) {
    for (const d of [...DISCS, "Total"] as const) {
      colTotals[d].present += matrix[s][d].present;
      colTotals[d].absent += matrix[s][d].absent;
      colTotals[d].total += matrix[s][d].total;
    }
  }
  grand.present = colTotals["Total"].present;
  grand.absent = colTotals["Total"].absent;
  grand.total = colTotals["Total"].total;

  const rowCount = data?.length ?? 0;

  return Response.json({
    ok: true,
    data: {
      projectCode,
      date,
      matrix,
      totals: colTotals,
      grandTotal: grand,
      hasData: rowCount > 0,
      rowCount,
    },
  });
}
