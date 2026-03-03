export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { importScheduleRevision } from "@/lib/schedule-control";

function asText(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const projectCode = asText(form.get("projectCode")) || "A27";
    const revisionCode = asText(form.get("revisionCode"));
    const revisionTypeRaw = asText(form.get("revisionType")).toLowerCase();
    const groupRaw = asText(form.get("group")).toLowerCase();
    const comment = asText(form.get("comment"));
    const importedBy = asText(form.get("importedBy")) || "planner";
    const file = form.get("file");

    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "file is required." }, { status: 400 });
    }
    if (!revisionCode) {
      return Response.json({ ok: false, error: "revisionCode is required (example: B03 or U07)." }, { status: 400 });
    }

    const revisionType = revisionTypeRaw === "baseline" || revisionTypeRaw === "b" ? "baseline" : "update";
    const group =
      groupRaw === "electrical" || groupRaw === "e"
        ? "electrical"
        : groupRaw === "mechanical" || groupRaw === "m"
          ? "mechanical"
          : groupRaw === "construction" || groupRaw === "c"
            ? "construction"
            : null;
    const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()));

    const data = await importScheduleRevision({
      projectCode,
      fileName: file.name || "schedule-import.dat",
      fileBuffer: buffer,
      revisionCode,
      revisionType,
      group,
      comment,
      importedBy,
    });

    return Response.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
