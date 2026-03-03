export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { compareScheduleRevisions } from "@/lib/schedule-control";

type ComparePayload = {
  projectCode?: string;
  oldRevisionId?: string;
  newRevisionId?: string;
  baselineRevId?: string;
  updateRevId?: string;
  options?: {
    confidenceThreshold?: number;
  };
};

async function runCompare(input: {
  projectCode?: string;
  oldRevisionId?: string;
  newRevisionId?: string;
  baselineRevId?: string;
  updateRevId?: string;
}) {
  const projectCode = input.projectCode || "A27";
  const oldRevisionId = input.oldRevisionId || input.baselineRevId;
  const newRevisionId = input.newRevisionId || input.updateRevId;

  if (!oldRevisionId || !newRevisionId) {
    return Response.json({ ok: false, error: "oldRevisionId/newRevisionId (or baselineRevId/updateRevId) are required." }, { status: 400 });
  }

  const data = await compareScheduleRevisions({ projectCode, oldRevisionId, newRevisionId });
  return Response.json({ ok: true, data });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    return await runCompare({
      projectCode: url.searchParams.get("projectCode") || "A27",
      oldRevisionId: url.searchParams.get("oldRevisionId") || undefined,
      newRevisionId: url.searchParams.get("newRevisionId") || undefined,
      baselineRevId: url.searchParams.get("baselineRevId") || undefined,
      updateRevId: url.searchParams.get("updateRevId") || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isValidationError =
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("must be older than update revision") ||
      message.toLowerCase().includes("not found");
    return Response.json({ ok: false, error: message }, { status: isValidationError ? 400 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ComparePayload;
    return await runCompare(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isValidationError =
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("must be older than update revision") ||
      message.toLowerCase().includes("not found");
    return Response.json({ ok: false, error: message }, { status: isValidationError ? 400 : 500 });
  }
}
