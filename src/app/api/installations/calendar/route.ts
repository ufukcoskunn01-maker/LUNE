import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCalendarMonth } from "@/lib/installations/queries";

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

function parseYearMonth(args: { yearRaw: string; monthRaw: string }): { year: number; month: number } | null {
  const year = Number(args.yearRaw);
  const month = Number(args.monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
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
    const yearRaw = (url.searchParams.get("year") || "").trim();
    const monthRaw = (url.searchParams.get("month") || "").trim();
    const parsed = parseYearMonth({ yearRaw, monthRaw });

    if (!projectCode) {
      return NextResponse.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "year/month are required (YYYY, MM)." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const days = await getCalendarMonth({
      supabase: db,
      projectCode,
      year: parsed.year,
      month: parsed.month,
    });

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        year: parsed.year,
        month: String(parsed.month).padStart(2, "0"),
        days,
      },
    });
  } catch (error) {
    const message = normalizeInstallationsError(error, "Failed to load installation calendar.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
