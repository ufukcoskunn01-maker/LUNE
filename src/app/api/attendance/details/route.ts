export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectCode = url.searchParams.get("projectCode") || "A27";
  const date = url.searchParams.get("date");
  const segment = url.searchParams.get("segment");
  const discipline = url.searchParams.get("discipline");
  const status = url.searchParams.get("status") || "All";

  const q = (url.searchParams.get("q") || "").trim();
  const company = (url.searchParams.get("company") || "").trim();
  const professionMode = url.searchParams.get("professionMode") || "grouped"; // grouped|raw
  const profession = (url.searchParams.get("profession") || "").trim();
  const absenceReason = (url.searchParams.get("absenceReason") || "").trim();

  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(200, Math.max(10, Number(url.searchParams.get("pageSize") || "50")));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!date) return Response.json({ ok: false, error: "date required (YYYY-MM-DD)" }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: proj, error: projErr } = await sb
    .from("projects")
    .select("id")
    .eq("code", projectCode)
    .maybeSingle();

  if (projErr) return Response.json({ ok: false, error: projErr.message }, { status: 500 });
  if (!proj) return Response.json({ ok: false, error: `Project not found: ${projectCode}` }, { status: 404 });

  let query = sb
    .from("attendance_records")
    .select(
      "employee_id,full_name,segment,discipline,company,status,absence_reason,profession_actual,profession_official,profession_grouped",
      { count: "exact" }
    )
    .eq("project_id", proj.id)
    .eq("work_date", date);

  if (segment && segment !== "All") query = query.eq("segment", segment);
  if (discipline && discipline !== "Total") query = query.eq("discipline", discipline);

  if (status !== "All") query = query.eq("status", status);
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (company) query = query.eq("company", company);

  if (profession) {
    const col = professionMode === "raw" ? "profession_official" : "profession_grouped";
    query = query.eq(col, profession);
  }

  if (absenceReason) query = query.eq("absence_reason", absenceReason);

  const { data, error, count } = await query.order("full_name", { ascending: true }).range(from, to);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    data: {
      page,
      pageSize,
      total: count ?? 0,
      rows: data ?? [],
      hasData: (count ?? 0) > 0,
      rowCount: count ?? 0,
    },
  });
}
