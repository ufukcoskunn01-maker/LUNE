import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_PROJECT_CODE, isIsoDate } from "@/lib/transportation/common";
import { requireAuthedUser } from "@/lib/transportation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransportRunRow = {
  id: string;
  project_code: string;
  work_date: string;
  shift: "morning" | "evening";
  plate: string;
  trips: number;
  photo_file_id: string | null;
  comment: string | null;
  reported_by: string;
  reported_at: string;
};

type BoardShiftCell = {
  id: string;
  trips: number;
  photo_file_id: string | null;
  comment: string | null;
  reported_at: string;
  reported_by: string;
};

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const auth = await requireAuthedUser(supabase);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const projectCode = (url.searchParams.get("projectCode") || DEFAULT_PROJECT_CODE).trim();
    const date = (url.searchParams.get("date") || "").trim();

    if (!projectCode) {
      return NextResponse.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }
    if (!isIsoDate(date)) {
      return NextResponse.json({ ok: false, error: "date must be YYYY-MM-DD." }, { status: 400 });
    }

    const [platesResult, runsResult] = await Promise.all([
      supabase.from("transport_plates").select("plate,project_code,is_active").eq("project_code", projectCode).eq("is_active", true).order("plate"),
      supabase.from("transport_runs").select("*").eq("project_code", projectCode).eq("work_date", date).order("plate").order("shift"),
    ]);

    if (platesResult.error) {
      return NextResponse.json({ ok: false, error: platesResult.error.message }, { status: 500 });
    }
    if (runsResult.error) {
      return NextResponse.json({ ok: false, error: runsResult.error.message }, { status: 500 });
    }

    const runs = (runsResult.data || []) as TransportRunRow[];
    const activePlates = (platesResult.data || []).map((row) => row.plate);
    const allPlates = Array.from(new Set([...activePlates, ...runs.map((row) => row.plate)])).sort((a, b) => a.localeCompare(b));

    const board = allPlates.map((plate) => ({
      plate,
      morning: null as BoardShiftCell | null,
      evening: null as BoardShiftCell | null,
    }));

    const boardByPlate = new Map(board.map((row) => [row.plate, row]));
    for (const run of runs) {
      const row = boardByPlate.get(run.plate);
      if (!row) continue;
      const payload: BoardShiftCell = {
        id: run.id,
        trips: run.trips,
        photo_file_id: run.photo_file_id,
        comment: run.comment,
        reported_at: run.reported_at,
        reported_by: run.reported_by,
      };

      if (run.shift === "morning") row.morning = payload;
      if (run.shift === "evening") row.evening = payload;
    }

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        date,
        plates: activePlates,
        runs,
        board,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load transportation day board.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
