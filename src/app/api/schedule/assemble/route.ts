export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createMergedScheduleRevision } from "@/lib/schedule-control";

type AssemblePayload = {
  projectCode?: string;
  importedBy?: string;
  comment?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as AssemblePayload;
    const projectCode = (body.projectCode || "A27").trim() || "A27";
    const importedBy = (body.importedBy || "schedule-merge-bot").trim() || "schedule-merge-bot";
    const comment = (body.comment || "").trim();

    const data = await createMergedScheduleRevision({ projectCode, importedBy, comment });
    return Response.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isValidationError =
      message.toLowerCase().includes("cannot assemble") ||
      message.toLowerCase().includes("missing imports") ||
      message.toLowerCase().includes("not found");
    return Response.json({ ok: false, error: message }, { status: isValidationError ? 400 : 500 });
  }
}

