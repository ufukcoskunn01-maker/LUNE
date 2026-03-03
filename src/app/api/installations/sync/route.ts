import { z } from "zod";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { discoverInstallationFiles } from "@/lib/installations/discover";
import { parseInstallationWorkbook } from "@/lib/installations/parser";
import {
  recomputeDaySummaries,
  replaceInstallationRows,
  upsertInstallationFileMeta,
} from "@/lib/installations/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SyncBodySchema = z.object({
  projectCode: z.string().trim().min(1).max(64).default("A27"),
  rootPrefix: z.string().trim().optional(),
});

function normalizeInstallationsError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lowered = message.toLowerCase();
  const missingInstallTable =
    lowered.includes("installation_files") ||
    lowered.includes("installation_rows") ||
    lowered.includes("installation_day_summary");
  const looksLikeSchemaIssue =
    lowered.includes("schema cache") ||
    lowered.includes("could not find the table") ||
    lowered.includes("relation") ||
    lowered.includes("does not exist");

  if (missingInstallTable && looksLikeSchemaIssue) {
    return "Installation schema is missing in Supabase. Run migrations 202602251300_installations.sql and 202602251430_installations_grants.sql, then retry.";
  }
  return message;
}

function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "project-files";
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

    const parsed = SyncBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid payload." }, { status: 400 });
    }

    const projectCode = parsed.data.projectCode;
    const explicitRoot = parsed.data.rootPrefix?.trim() || "";
    const configuredRoot = (process.env.INSTALLATIONS_ROOT_PREFIX || "").trim();
    const defaultRoot = `${projectCode}/2-Daily Field Reports`;
    const rootCandidates = Array.from(new Set([explicitRoot, configuredRoot, defaultRoot].filter(Boolean)));

    const configuredBucket = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();
    const defaultBucket = getStorageBucket();
    const admin = supabaseAdmin();
    let discoveredBucketNames: string[] = [];
    const bucketListResult = await admin.storage.listBuckets();
    if (!bucketListResult.error && bucketListResult.data?.length) {
      discoveredBucketNames = bucketListResult.data.map((bucket) => bucket.name).filter(Boolean);
    }

    const bucketCandidates = Array.from(
      new Set([configuredBucket, defaultBucket, "project-files", ...discoveredBucketNames].filter(Boolean))
    );

    let discovered: Awaited<ReturnType<typeof discoverInstallationFiles>> = [];
    let bucket = bucketCandidates[0] || "project-files";
    let rootPrefix = rootCandidates[0] || defaultRoot;
    let discoveryError: Error | null = null;

    for (const candidateBucket of bucketCandidates) {
      for (const candidateRoot of rootCandidates) {
        try {
          const files = await discoverInstallationFiles({
            supabase: admin,
            bucket: candidateBucket,
            projectCode,
            rootPrefix: candidateRoot,
          });
          if (files.length) {
            discovered = files;
            bucket = candidateBucket;
            rootPrefix = candidateRoot;
            discoveryError = null;
            break;
          }

          if (!discovered.length) {
            bucket = candidateBucket;
            rootPrefix = candidateRoot;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Storage discovery failed.";
          discoveryError = new Error(message);
        }
      }
      if (discovered.length) break;
    }

    if (!discovered.length && discoveryError) {
      throw discoveryError;
    }

    let parsedFiles = 0;
    const affectedDates = new Set<string>();
    const errors: string[] = [];

    for (const file of discovered) {
      try {
        const meta = await upsertInstallationFileMeta({ supabase: admin, file });
        if (!meta.needsParsing) continue;

        const download = await admin.storage.from(bucket).download(file.storagePath);
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
        const message = error instanceof Error ? error.message : `Failed to parse ${file.storagePath}`;
        errors.push(message);
      }
    }

    let affectedDays = 0;
    if (affectedDates.size) {
      affectedDays = await recomputeDaySummaries({
        supabase: admin,
        projectCode,
        workDates: Array.from(affectedDates),
      });
    }

    const status = errors.length ? 207 : 200;
    return NextResponse.json(
      {
        ok: errors.length === 0,
        data: {
          scannedFiles: discovered.length,
          parsedFiles,
          affectedDays,
          projectCode,
          rootPrefix,
          bucket,
          rootCandidates,
          bucketCandidates,
        },
        errors,
      },
      { status }
    );
  } catch (error) {
    const message = normalizeInstallationsError(error, "Installation sync failed.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
