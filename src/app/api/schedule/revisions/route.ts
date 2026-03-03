export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getScheduleRevisions } from "@/lib/schedule-control";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectCode = url.searchParams.get("projectCode") || "A27";
    const data = await getScheduleRevisions(projectCode);
    return Response.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

