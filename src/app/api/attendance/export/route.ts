import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "imports"; // <-- your bucket name (case-sensitive)
const STORAGE_SUBFOLDER = "1-Daily Personal Reports";
type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;
type StorageListItem = { name?: string | null };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? "unknown");
}

function toDDMMYY(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y.slice(2)}`;
}

function toYYMMDD(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${y.slice(2)}${m}${d}`;
}

function monthFolder(iso: string) {
  const [y, m] = iso.split("-");
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${y}/${m}-${names[Number(m) - 1]}`; // 2026/02-February
}

function russianAttendanceFilename(workDate: string, projectCode: string) {
  // You wanted Russian export name
  return `Учет выхода на работу ${projectCode}_ИС_${toYYMMDD(workDate)}_rev00.xlsx`;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(url, service, { auth: { persistSession: false } });
}

async function downloadOrNull(supabase: SupabaseAdminClient, path: string) {
  const r = await supabase.storage.from(BUCKET).download(path);
  if (r?.error || !r?.data) return { blob: null as Blob | null, err: r?.error };
  return { blob: r.data as Blob, err: null };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectCode = searchParams.get("projectCode") || "A27";
    const date = searchParams.get("date"); // YYYY-MM-DD
    if (!date) return Response.json({ ok: false, error: "Missing date (YYYY-MM-DD)" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // 1) project lookup
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select("id,code")
      .eq("code", projectCode)
      .maybeSingle();

    if (projErr) return Response.json({ ok: false, error: projErr.message }, { status: 500 });
    if (!proj) return Response.json({ ok: false, error: `Project not found: ${projectCode}` }, { status: 404 });

    // 2) candidates from DB (old + new paths)
    const { data: candidates, error: candErr } = await supabase
      .from("files")
      .select("id, storage_path, created_at, meta")
      .eq("project_id", proj.id)
      .eq("type", "import")
      .eq("logical_name", "attendance_daily")
      .eq("meta->>workDate", date)
      .order("created_at", { ascending: false })
      .limit(20);

    if (candErr) return Response.json({ ok: false, error: candErr.message }, { status: 500 });

    const tried: string[] = [];
    let lastErr: unknown = null;

    // 3) try candidates first
    for (const c of candidates || []) {
      const p = c?.storage_path;
      if (!p) continue;
      tried.push(p);

      const { blob, err } = await downloadOrNull(supabase, p);
      if (blob) {
        const buf = await blob.arrayBuffer();
        const filename = russianAttendanceFilename(date, projectCode);
        const encoded = encodeURIComponent(filename);

        return new Response(buf, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename="daily-personal-report.xlsx"; filename*=UTF-8''${encoded}`,
          },
        });
      }
      lastErr = err;
    }

    // 4) fallback #1: deterministic NEW path (your new convention)
    const expected =
      `${projectCode}/${STORAGE_SUBFOLDER}/${monthFolder(date)}/` +
      `${projectCode}-E-IN-${toYYMMDD(date)}_rev00.xlsx`;

    tried.push(expected);

    {
      const { blob, err } = await downloadOrNull(supabase, expected);
      if (blob) {
        const buf = await blob.arrayBuffer();
        const filename = russianAttendanceFilename(date, projectCode);
        const encoded = encodeURIComponent(filename);

        return new Response(buf, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename="daily-personal-report.xlsx"; filename*=UTF-8''${encoded}`,
          },
        });
      }
      lastErr = err;
    }

    // 5) fallback #2: list folder and match filename
    const folderPrefix = `${projectCode}/${STORAGE_SUBFOLDER}/${monthFolder(date)}`;
    const want = `${projectCode}-E-IN-${toYYMMDD(date)}_rev00.xlsx`.toLowerCase();
    const legacyWant = `${projectCode}-E-IN-${toDDMMYY(date)}_rev00.xlsx`.toLowerCase();

    const listRes = await supabase.storage.from(BUCKET).list(folderPrefix, { limit: 300 });
    if (!listRes.error && listRes.data?.length) {
      const match = (listRes.data as StorageListItem[]).find((o) => {
        const lower = (o?.name || "").toLowerCase();
        return lower === want || lower === legacyWant;
      });
      if (match?.name) {
        const fullPath = `${folderPrefix}/${match.name}`;
        tried.push(fullPath);

        const { blob, err } = await downloadOrNull(supabase, fullPath);
        if (blob) {
          const buf = await blob.arrayBuffer();
          const filename = russianAttendanceFilename(date, projectCode);
          const encoded = encodeURIComponent(filename);

          return new Response(buf, {
            headers: {
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Cache-Control": "no-store",
              "Content-Disposition": `attachment; filename="daily-personal-report.xlsx"; filename*=UTF-8''${encoded}`,
            },
          });
        }
        lastErr = err;
      }
    } else {
      lastErr = listRes.error;
    }

    // 6) fail with full debug
    return Response.json(
      {
        ok: false,
        error: "Storage download failed (candidates + fallbacks)",
        debug: {
          bucket: BUCKET,
          projectCode,
          date,
          candidatesFound: (candidates || []).length,
          tried,
          lastErr: getErrorMessage(lastErr),
        },
      },
      { status: 500 }
    );
  } catch (e: unknown) {
    return Response.json({ ok: false, error: getErrorMessage(e) }, { status: 500 });
  }
}
