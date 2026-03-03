import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const projectCode = (url.searchParams.get("projectCode") || "A27").trim() || "A27";

  const headers: HeadersInit = secret ? { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

  try {
    const syncRes = await fetch(`${origin}/api/field-installation/sync?projectCode=${encodeURIComponent(projectCode)}`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    const syncJson = (await syncRes.json().catch(() => null)) as { ok?: boolean; error?: string; data?: unknown } | null;
    if (!syncRes.ok || syncJson?.ok === false) {
      return NextResponse.json(
        { ok: false, error: syncJson?.error || `Sync failed (${syncRes.status})`, sync: syncJson },
        { status: 500 }
      );
    }

    const ingestRes = await fetch(`${origin}/api/jobs/field-installation-auto-ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectCode }),
      cache: "no-store",
    });
    const ingestJson = (await ingestRes.json().catch(() => null)) as { ok?: boolean; error?: string; data?: unknown } | null;
    if (!ingestRes.ok || ingestJson?.ok === false) {
      return NextResponse.json(
        { ok: false, error: ingestJson?.error || `Auto-ingest failed (${ingestRes.status})`, sync: syncJson, ingest: ingestJson },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        projectCode,
        sync: syncJson?.data ?? null,
        ingest: ingestJson?.data ?? null,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Field installation cron failed." },
      { status: 500 }
    );
  }
}
