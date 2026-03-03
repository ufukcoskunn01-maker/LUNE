import { z } from "zod";
import { NextResponse } from "next/server";
import { uploadFile } from "@/features/files/uploadFile";
import { supabaseServer } from "@/lib/supabase/server";
import {
  buildTransportPhotoPath,
  DEFAULT_PROJECT_CODE,
  isIsoDate,
  isTransportShift,
  normalizePlate,
  TRANSPORT_BUCKET,
} from "@/lib/transportation/common";
import { isTransportReporter, requireAuthedUser } from "@/lib/transportation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PayloadSchema = z.object({
  projectCode: z.string().trim().min(1).max(64),
  workDate: z.string().trim(),
  shift: z.string().trim(),
  plate: z.string().trim().min(1).max(64),
  trips: z.coerce.number().int().min(0).max(10),
  comment: z.string().optional().default(""),
});

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const auth = await requireAuthedUser(supabase);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const reporter = await isTransportReporter(supabase, auth.user.id);
    if (!reporter) {
      return NextResponse.json({ ok: false, error: "Only transportation reporters can submit reports." }, { status: 403 });
    }

    const form = await req.formData();
    const parsed = PayloadSchema.safeParse({
      projectCode: form.get("projectCode") || DEFAULT_PROJECT_CODE,
      workDate: form.get("workDate") || "",
      shift: form.get("shift") || "",
      plate: form.get("plate") || "",
      trips: form.get("trips") || "1",
      comment: form.get("comment") || "",
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Invalid transportation report payload.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const workDate = parsed.data.workDate;
    if (!isIsoDate(workDate)) {
      return NextResponse.json({ ok: false, error: "workDate must be YYYY-MM-DD." }, { status: 400 });
    }

    const shift = parsed.data.shift.toLowerCase();
    if (!isTransportShift(shift)) {
      return NextResponse.json({ ok: false, error: "shift must be morning or evening." }, { status: 400 });
    }

    const filePart = form.get("file");
    if (!(filePart instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "file is required." }, { status: 400 });
    }

    if (!filePart.type || !filePart.type.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Only image uploads are allowed." }, { status: 400 });
    }

    const plate = normalizePlate(parsed.data.plate);
    if (!plate) {
      return NextResponse.json({ ok: false, error: "plate is required." }, { status: 400 });
    }

    const projectCode = parsed.data.projectCode.trim() || DEFAULT_PROJECT_CODE;
    const nowIso = new Date().toISOString();
    const uuid = crypto.randomUUID();
    const photoPath = buildTransportPhotoPath({
      projectCode,
      workDate,
      shift,
      plate,
      uuid,
    });

    const fileBuffer = Buffer.from(await filePart.arrayBuffer());
    const uploaded = await uploadFile({
      supabase,
      ownerId: auth.user.id,
      bucket: TRANSPORT_BUCKET,
      path: photoPath,
      data: fileBuffer,
      fileName: `${plate}-${shift}.jpg`,
      contentType: filePart.type || "image/jpeg",
      upsert: false,
      cacheControl: "3600",
      entityType: "transport_day",
      entityId: `${projectCode}:${workDate}`,
      metadata: {
        projectCode,
        workDate,
        plate,
        shift,
        reportedBy: auth.user.id,
      },
    });

    const plateUpsert = await supabase
      .from("transport_plates")
      .upsert({ plate, project_code: projectCode, is_active: true }, { onConflict: "plate" });

    if (plateUpsert.error) {
      return NextResponse.json({ ok: false, error: plateUpsert.error.message }, { status: 500 });
    }

    const comment = parsed.data.comment.trim();
    const runUpsert = await supabase
      .from("transport_runs")
      .upsert(
        {
          project_code: projectCode,
          work_date: workDate,
          shift,
          plate,
          trips: parsed.data.trips,
          photo_file_id: uploaded.id,
          comment: comment || null,
          reported_by: auth.user.id,
          reported_at: nowIso,
        },
        { onConflict: "project_code,work_date,shift,plate" }
      )
      .select("*")
      .single();

    if (runUpsert.error) {
      return NextResponse.json({ ok: false, error: runUpsert.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { row: runUpsert.data } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transportation report failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
