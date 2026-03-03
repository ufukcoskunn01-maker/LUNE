import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  discoverInstallationFiles,
  resolveFieldReportsBucket,
  upsertFieldReportMetadata,
} from "@/lib/field-reports/storage-scan";
import { discoverInstallationFiles as discoverInstallationFilesLegacy } from "@/lib/installations/discover";
import { parseInstallationWorkbook } from "@/lib/installations/parser";
import {
  recomputeDaySummaries,
  replaceInstallationRows,
  upsertInstallationFileMeta,
} from "@/lib/installations/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  rootPrefix: z.string().trim().optional(),
});

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Storage sync failed.";
}

function isMissingFieldReportsSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const lowered = message.toLowerCase();
  return (
    (lowered.includes("field_reports") || lowered.includes("field_report_items")) &&
    (lowered.includes("schema cache") ||
      lowered.includes("could not find the table") ||
      lowered.includes("relation") ||
      lowered.includes("does not exist"))
  );
}

function sanitizeRootPrefix(rootPrefix: string, bucket: string): string {
  const trimmed = rootPrefix.replace(/^\/+|\/+$/g, "");
  const bucketPrefix = `${bucket}/`;
  if (trimmed.toLowerCase().startsWith(bucketPrefix.toLowerCase())) {
    return trimmed.slice(bucketPrefix.length);
  }
  return trimmed;
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

    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: body.error.issues[0]?.message || "Invalid payload." }, { status: 400 });
    }

    const projectCode = body.data.projectCode;
    const explicitRoot = body.data.rootPrefix?.trim() || "";
    const defaultRoot = `${projectCode}/2-Daily Field Reports`;
    const configuredRoot =
      process.env.FIELD_REPORTS_ROOT_PREFIX?.trim() || process.env.INSTALLATIONS_ROOT_PREFIX?.trim() || "";
    const rootCandidates = Array.from(
      new Set(
        [explicitRoot, configuredRoot, defaultRoot]
          .filter(Boolean)
          .map((candidate) => sanitizeRootPrefix(candidate, resolveFieldReportsBucket()))
      )
    );

    const admin = supabaseAdmin();
    const bucketCandidates = new Set<string>([resolveFieldReportsBucket(), "imports", "project-files"]);

    const listedBuckets = await admin.storage.listBuckets();
    if (!listedBuckets.error && listedBuckets.data) {
      for (const bucket of listedBuckets.data) {
        if (bucket?.name) bucketCandidates.add(bucket.name);
      }
    }

    let bestFiles: Awaited<ReturnType<typeof discoverInstallationFiles>>["files"] = [];
    let bestSkipped = 0;
    let selectedBucket = resolveFieldReportsBucket();
    let selectedRoot = rootCandidates[0] || defaultRoot;
    const errors: string[] = [];

    for (const bucket of bucketCandidates) {
      for (const rootPrefix of rootCandidates) {
        try {
          const scan = await discoverInstallationFiles({
            supabase: admin,
            projectCode,
            bucket,
            rootPrefix,
          });
          if (scan.files.length > bestFiles.length) {
            bestFiles = scan.files;
            bestSkipped = scan.skippedNoDate;
            selectedBucket = bucket;
            selectedRoot = scan.rootPrefix;
          }
          if (scan.files.length > 0) break;
        } catch (error) {
          errors.push(normalizeError(error));
        }
      }
      if (bestFiles.length > 0) break;
    }

    let upserted = 0;
    let parsedFiles = 0;
    let affectedDays = 0;
    let usedLegacyFallback = false;
    const affectedDates = new Set<string>();

    for (const file of bestFiles) {
      try {
        const done = await upsertFieldReportMetadata({ supabase: admin, file });
        if (done) upserted += 1;
      } catch (error) {
        if (!isMissingFieldReportsSchemaError(error)) {
          errors.push(`${file.storagePath}: ${normalizeError(error)}`);
          continue;
        }
        usedLegacyFallback = true;
        break;
      }
    }

    if (usedLegacyFallback) {
      const legacyFiles = await discoverInstallationFilesLegacy({
        supabase: admin,
        bucket: selectedBucket,
        projectCode,
        rootPrefix: selectedRoot,
      });

      upserted = 0;
      parsedFiles = 0;
      for (const file of legacyFiles) {
        try {
          const meta = await upsertInstallationFileMeta({ supabase: admin, file });
          upserted += 1;
          if (!meta.needsParsing) continue;

          const download = await admin.storage.from(selectedBucket).download(file.storagePath);
          if (download.error || !download.data) {
            throw new Error(`Storage download failed for ${file.storagePath}: ${download.error?.message || "unknown"}`);
          }

          const fileBuffer = Buffer.from(await download.data.arrayBuffer());
          const parsedRows = parseInstallationWorkbook(fileBuffer, file.workDate);
          await replaceInstallationRows({
            supabase: admin,
            file: meta.row,
            rows: parsedRows.rows,
          });

          parsedFiles += 1;
          affectedDates.add(file.workDate);
        } catch (error) {
          errors.push(`${file.storagePath}: ${normalizeError(error)}`);
        }
      }

      if (affectedDates.size) {
        affectedDays = await recomputeDaySummaries({
          supabase: admin,
          projectCode,
          workDates: Array.from(affectedDates),
        });
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      data: {
        projectCode,
        scanned: bestFiles.length,
        upserted,
        parsedFiles,
        affectedDays,
        skippedNoDate: bestSkipped,
        bucket: selectedBucket,
        rootPrefix: selectedRoot,
        sourceTable: usedLegacyFallback ? "installation_files" : "field_reports",
      },
      errors,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: normalizeError(error) }, { status: 500 });
  }
}
