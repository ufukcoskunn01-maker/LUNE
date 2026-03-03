import { NextResponse } from "next/server";
import { getDayDetail } from "@/lib/installations/queries";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeInstallationsError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lowered = message.toLowerCase();
  const missingInstallTable =
    lowered.includes("installation_files") ||
    lowered.includes("installation_rows") ||
    lowered.includes("installation_day_summary");
  const looksLikeSchemaIssue =
    lowered.includes("schema cache") ||
    lowered.includes("could not find the table") ||
    lowered.includes("relation") ||
    lowered.includes("does not exist");

  if (missingInstallTable && looksLikeSchemaIssue) {
    return "Installation schema is missing in Supabase. Run migrations 202602251300_installations.sql and 202602251430_installations_grants.sql, then retry.";
  }
  return message;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

type AttendanceDetailsPayload = {
  data?: {
    rows?: Array<{ employee_id: string; full_name: string; company: string | null }>;
  };
};

async function loadAttendancePeople(args: {
  request: Request;
  projectCode: string;
  date: string;
}): Promise<{
  present_count: number;
  present_people: Array<{ employee_id: string; full_name: string; company: string | null }>;
  error: string | null;
}> {
  try {
    const url = new URL(args.request.url);
    const params = new URLSearchParams({
      projectCode: args.projectCode,
      date: args.date,
      status: "Present",
      page: "1",
      pageSize: "500",
    });

    const headers: Record<string, string> = {};
    const cookie = args.request.headers.get("cookie");
    if (cookie) headers.cookie = cookie;

    const res = await fetch(`${url.origin}/api/attendance/details?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers,
    });

    if (!res.ok) {
      return {
        present_count: 0,
        present_people: [],
        error: `Attendance route returned ${res.status}.`,
      };
    }

    const payload = (await res.json().catch(() => null)) as AttendanceDetailsPayload | null;
    const rows = payload?.data?.rows || [];
    return {
      present_count: rows.length,
      present_people: rows,
      error: null,
    };
  } catch (error) {
    return {
      present_count: 0,
      present_people: [],
      error: error instanceof Error ? error.message : "Attendance lookup failed.",
    };
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const url = new URL(req.url);
    const projectCode = (url.searchParams.get("projectCode") || "A27").trim();
    const date = (url.searchParams.get("date") || "").trim();

    if (!projectCode) {
      return NextResponse.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }
    if (!isIsoDate(date)) {
      return NextResponse.json({ ok: false, error: "date must be YYYY-MM-DD." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const [detail, attendance] = await Promise.all([
      getDayDetail({
        supabase: db,
        projectCode,
        date,
      }),
      loadAttendancePeople({ request: req, projectCode, date }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        date,
        latest_file: detail.latestFile
          ? {
              id: detail.latestFile.id,
              work_date: detail.latestFile.work_date,
              rev: detail.latestFile.rev,
              filename: detail.latestFile.filename,
              storage_path: detail.latestFile.storage_path,
              parsed_rows: detail.latestFile.parsed_rows,
              last_modified: detail.latestFile.last_modified,
            }
          : null,
        totals: detail.totals,
        rows: detail.rows,
        pivot_by_activity: detail.pivotActivity,
        pivot_by_budget: detail.pivotBudget,
        attendance,
      },
    });
  } catch (error) {
    const message = normalizeInstallationsError(error, "Failed to load installation day details.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
