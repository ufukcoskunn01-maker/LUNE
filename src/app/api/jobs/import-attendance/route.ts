export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runAttendanceImport } from "@/lib/attendance/import";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? "Unknown error");
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const projectCode = String(form.get("projectCode") || "").trim();
    const workDate = String(form.get("workDate") || "").trim();
    const sourcePath = String(form.get("sourcePath") || "").trim();
    const fileEntry = form.get("file");

    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    if (fileEntry instanceof File) {
      const ab = await fileEntry.arrayBuffer();
      fileBuffer = Buffer.from(new Uint8Array(ab));
      fileName = fileEntry.name;
    }

    const result = await runAttendanceImport({
      projectCode,
      workDate,
      sourcePath: sourcePath || undefined,
      fileBuffer,
      fileName,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return Response.json({ ok: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
