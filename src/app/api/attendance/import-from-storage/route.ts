export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runAttendanceImport } from "@/lib/attendance/import";

type ImportFromStoragePayload = {
  projectCode?: string;
  date?: string;
  storagePath?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? "Unknown error");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ImportFromStoragePayload;
    const projectCode = (body.projectCode || "A27").trim();
    const workDate = (body.date || "").trim();
    const sourcePath = (body.storagePath || "").trim();

    if (!workDate) {
      return Response.json({ ok: false, error: "date is required (YYYY-MM-DD)." }, { status: 400 });
    }
    if (!sourcePath) {
      return Response.json({ ok: false, error: "storagePath is required." }, { status: 400 });
    }

    const result = await runAttendanceImport({
      projectCode,
      workDate,
      sourcePath,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return Response.json({ ok: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
