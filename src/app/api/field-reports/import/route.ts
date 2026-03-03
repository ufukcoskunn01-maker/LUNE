import crypto from "crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { uploadFile } from "@/features/files/uploadFile";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseInstallationXlsx } from "@/lib/field-reports/parse-installation-xlsx";
import {
  getFieldReportByDate,
  monthFolderName,
  replaceFieldReportItems,
  setFieldReportParseFailed,
  setFieldReportParseOk,
  toYYMMDD,
  upsertFieldReportRow,
} from "@/lib/field-reports/service";
import { resolveFieldReportsBucket } from "@/lib/field-reports/storage-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JsonImportSchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  workDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

class ImportError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Field report import failed.";
}

function detectRevisionFromFileName(fileName: string): string {
  const match = fileName.match(/_rev(\d{2})/i);
  if (!match) return "rev00";
  return `rev${match[1]}`;
}

async function parseAndPersistReport(args: {
  admin: ReturnType<typeof supabaseAdmin>;
  reportId: string;
  buffer: Buffer;
}) {
  let parsed;
  try {
    parsed = parseInstallationXlsx(args.buffer);
  } catch (error) {
    const message = normalizeError(error);
    await setFieldReportParseFailed({
      supabase: args.admin,
      reportId: args.reportId,
      message,
    });
    throw new ImportError(message, 422);
  }

  try {
    const inserted = await replaceFieldReportItems({
      supabase: args.admin,
      reportId: args.reportId,
      items: parsed.items,
    });

    await setFieldReportParseOk({
      supabase: args.admin,
      reportId: args.reportId,
      summary: {
        ...parsed.summary,
        worksheet: parsed.worksheet,
        headerRow: parsed.headerRow,
        parsedItems: inserted,
      },
    });

    return {
      worksheet: parsed.worksheet,
      headerRow: parsed.headerRow,
      parsedItems: parsed.items.length,
      upsertedItems: inserted,
    };
  } catch (error) {
    const message = normalizeError(error);
    await setFieldReportParseFailed({
      supabase: args.admin,
      reportId: args.reportId,
      message,
    });
    throw new ImportError(message, 500);
  }
}

async function importByDateFromStorage(args: {
  admin: ReturnType<typeof supabaseAdmin>;
  projectCode: string;
  workDate: string;
}) {
  const report = await getFieldReportByDate({
    supabase: args.admin,
    projectCode: args.projectCode,
    workDate: args.workDate,
  });

  if (!report) {
    throw new ImportError(`No field report metadata found for ${args.workDate}. Run sync first.`, 404);
  }

  const download = await args.admin.storage.from(report.storage_bucket).download(report.storage_path);
  if (download.error || !download.data) {
    const message = `Storage download failed: ${download.error?.message || "unknown error"}`;
    await setFieldReportParseFailed({
      supabase: args.admin,
      reportId: report.id,
      message,
    });
    throw new ImportError(message, 500);
  }

  const buffer = Buffer.from(await download.data.arrayBuffer());
  const parse = await parseAndPersistReport({
    admin: args.admin,
    reportId: report.id,
    buffer,
  });

  return {
    mode: "storage",
    reportId: report.id,
    workDate: args.workDate,
    fileName: report.file_name,
    storagePath: report.storage_path,
    ...parse,
  };
}

async function importFromUpload(args: {
  admin: ReturnType<typeof supabaseAdmin>;
  ownerId: string;
  projectCode: string;
  workDate: string;
  file: File;
}) {
  const bucket = resolveFieldReportsBucket();
  const revision = detectRevisionFromFileName(args.file.name);
  const targetFileName = `${args.projectCode}-E-INS-${toYYMMDD(args.workDate)}_${revision}.xlsx`;
  const storagePath = `${args.projectCode}/2-Daily Field Reports/${monthFolderName(args.workDate)}/${targetFileName}`;

  const buffer = Buffer.from(await args.file.arrayBuffer());
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

  await uploadFile({
    supabase: args.admin,
    ownerId: args.ownerId,
    bucket,
    path: storagePath,
    data: buffer,
    fileName: targetFileName,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
    entityType: "field_report",
    entityId: `${args.projectCode}:${args.workDate}`,
    metadata: {
      projectCode: args.projectCode,
      workDate: args.workDate,
      revision,
    },
  });

  const report = await upsertFieldReportRow({
    supabase: args.admin,
    projectCode: args.projectCode,
    workDate: args.workDate,
    bucket,
    storagePath,
    fileName: targetFileName,
    revision,
    fileHash,
    fileSize: buffer.length,
    lastModified: new Date().toISOString(),
  });

  const parse = await parseAndPersistReport({
    admin: args.admin,
    reportId: report.id,
    buffer,
  });

  return {
    mode: "upload",
    reportId: report.id,
    workDate: args.workDate,
    fileName: targetFileName,
    storagePath,
    ...parse,
  };
}

export async function POST(req: Request) {
  try {
    const userClient = await supabaseServer();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No authenticated Supabase session found." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    const admin = supabaseAdmin();

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const projectCode = String(formData.get("projectCode") || "A27").trim();
      const workDate = String(formData.get("workDate") || "").trim();
      const fileValue = formData.get("file");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
        return NextResponse.json({ ok: false, error: "workDate must be YYYY-MM-DD." }, { status: 400 });
      }
      if (!fileValue || !(fileValue instanceof File)) {
        return NextResponse.json({ ok: false, error: "file is required." }, { status: 400 });
      }
      if (!/\.(xlsx|xlsm)$/i.test(fileValue.name)) {
        return NextResponse.json({ ok: false, error: "Only .xlsx or .xlsm files are supported." }, { status: 400 });
      }

      const result = await importFromUpload({
        admin,
        ownerId: user.id,
        projectCode,
        workDate,
        file: fileValue,
      });

      return NextResponse.json({ ok: true, data: result });
    }

    const body = JsonImportSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: body.error.issues[0]?.message || "Invalid payload." }, { status: 400 });
    }

    const result = await importByDateFromStorage({
      admin,
      projectCode: body.data.projectCode,
      workDate: body.data.workDate,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: normalizeError(error) }, { status: 500 });
  }
}
