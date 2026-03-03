import { NextResponse } from "next/server";
import { dayColumns31, DEFAULT_PROJECT_CODE, monthRange, parseMonthToken } from "@/lib/transportation/common";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuthedUser } from "@/lib/transportation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransportRunRow = {
  project_code: string;
  work_date: string;
  shift: "morning" | "evening";
  plate: string;
  trips: number;
};

type DailyAggregate = {
  date: string;
  day: string;
  totalTrips: number;
  morningTrips: number;
  eveningTrips: number;
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
    const month = (url.searchParams.get("month") || "").trim();

    if (!projectCode) {
      return NextResponse.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }
    if (!parseMonthToken(month)) {
      return NextResponse.json({ ok: false, error: "month must be YYYY-MM." }, { status: 400 });
    }

    const range = monthRange(month);
    if (!range) {
      return NextResponse.json({ ok: false, error: "Invalid month." }, { status: 400 });
    }

    const [runsResult, platesResult] = await Promise.all([
      supabase
        .from("transport_runs")
        .select("project_code,work_date,shift,plate,trips")
        .eq("project_code", projectCode)
        .gte("work_date", range.start)
        .lte("work_date", range.end)
        .order("work_date")
        .order("plate"),
      supabase.from("transport_plates").select("plate,is_active").eq("project_code", projectCode).eq("is_active", true).order("plate"),
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

    const dailyByDate = new Map<string, DailyAggregate>();
    for (let day = 1; day <= range.daysInMonth; day += 1) {
      const dayToken = String(day).padStart(2, "0");
      const date = `${month}-${dayToken}`;
      dailyByDate.set(date, {
        date,
        day: dayToken,
        totalTrips: 0,
        morningTrips: 0,
        eveningTrips: 0,
      });
    }

    const byPlateMap = new Map<
      string,
      {
        plate: string;
        totalTrips: number;
        morningTrips: number;
        eveningTrips: number;
        days: Record<string, number>;
      }
    >();

    for (const plate of plates) {
      const days: Record<string, number> = {};
      for (const day of dayColumns31()) days[day] = 0;
      byPlateMap.set(plate, {
        plate,
        totalTrips: 0,
        morningTrips: 0,
        eveningTrips: 0,
        days,
      });
    }

    for (const run of runs) {
      const date = run.work_date;
      const dayToken = date.slice(8, 10);
      const trips = Number(run.trips || 0);

      const daily = dailyByDate.get(date);
      if (daily) {
        daily.totalTrips += trips;
        if (run.shift === "morning") daily.morningTrips += trips;
        if (run.shift === "evening") daily.eveningTrips += trips;
      }

      const plateBucket = byPlateMap.get(run.plate);
      if (plateBucket) {
        plateBucket.totalTrips += trips;
        if (run.shift === "morning") plateBucket.morningTrips += trips;
        if (run.shift === "evening") plateBucket.eveningTrips += trips;
        plateBucket.days[dayToken] = (plateBucket.days[dayToken] || 0) + trips;
      }
    }

    const byPlate = Array.from(byPlateMap.values()).sort((a, b) => a.plate.localeCompare(b.plate));
    const dailyTotals = Array.from(dailyByDate.values());
    const totalTrips = dailyTotals.reduce((sum, item) => sum + item.totalTrips, 0);

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        month,
        startDate: range.start,
        endDate: range.end,
        daysInMonth: range.daysInMonth,
        dailyTotals,
        byPlate,
        totals: {
          totalTrips,
          totalPlates: plates.length,
          totalEntries: runs.length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load transportation month analytics.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
