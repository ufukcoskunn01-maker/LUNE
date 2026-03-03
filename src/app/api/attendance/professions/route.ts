export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase/admin";

type ProfessionRecord = {
  status: string | null;
  profession_grouped: string | null;
  profession_official: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectCode = url.searchParams.get("projectCode") || "A27";
  const date = url.searchParams.get("date");
  const segment = url.searchParams.get("segment");
  const discipline = url.searchParams.get("discipline");
  const status = url.searchParams.get("status") || "All";
  const mode = url.searchParams.get("mode") || "grouped"; // grouped|raw

  if (!date) return Response.json({ ok: false, error: "date required (YYYY-MM-DD)" }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: proj, error: projErr } = await sb
    .from("projects")
    .select("id")
    .eq("code", projectCode)
    .maybeSingle();

  if (projErr) return Response.json({ ok: false, error: projErr.message }, { status: 500 });
  if (!proj) return Response.json({ ok: false, error: `Project not found: ${projectCode}` }, { status: 404 });

  // For now we compute pivot in JS (fast enough for hundreds / few thousands)
  let q = sb
    .from("attendance_records")
    .select("status,profession_grouped,profession_official")
    .eq("project_id", proj.id)
    .eq("work_date", date);

  if (segment && segment !== "All") q = q.eq("segment", segment);
  if (discipline && discipline !== "Total") q = q.eq("discipline", discipline);

  if (status !== "All") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const map = new Map<string, { profession: string; present: number; absent: number; total: number }>();

  const sourceRows = (data ?? []) as ProfessionRecord[];
  for (const r of sourceRows) {
    const prof = (mode === "raw" ? r.profession_official : r.profession_grouped) || "(Blank)";
    if (!map.has(prof)) map.set(prof, { profession: prof, present: 0, absent: 0, total: 0 });
    const item = map.get(prof)!;

    if (r.status === "Present") item.present++;
    else if (r.status === "Absent") item.absent++;
    item.total++;
  }

  const rows = Array.from(map.values()).sort(
    (a, b) => b.total - a.total || a.profession.localeCompare(b.profession)
  );

  return Response.json({
    ok: true,
    data: {
      rows,
      hasData: sourceRows.length > 0,
      rowCount: sourceRows.length,
    },
  });
}
