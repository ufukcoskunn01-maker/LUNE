import { createClient } from "@supabase/supabase-js";

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function joinPath(base, name) {
  return base ? `${base}/${name}` : name;
}

function isFolderEntry(entry) {
  return !entry?.id;
}

async function listFolderPage(sb, bucket, prefix, offset, limit) {
  const { data, error } = await sb.storage.from(bucket).list(prefix, {
    limit,
    offset,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) {
    throw new Error(`List failed for "${prefix}" (offset ${offset}): ${error.message}`);
  }
  return data || [];
}

async function listAllFolderEntries(sb, bucket, prefix) {
  const all = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const page = await listFolderPage(sb, bucket, prefix, offset, limit);
    all.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return all;
}

async function listAllFilesRecursive(sb, bucket, rootPrefix) {
  const files = [];
  const queue = [rootPrefix];

  while (queue.length > 0) {
    const prefix = queue.shift();
    const entries = await listAllFolderEntries(sb, bucket, prefix);
    for (const entry of entries) {
      const name = entry?.name;
      if (!name) continue;
      const fullPath = joinPath(prefix, name);
      if (isFolderEntry(entry)) {
        queue.push(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = getArg("--bucket", "export");
  const fromPrefixRaw = getArg("--from", "");
  const toPrefixRaw = getArg("--to", "");
  const dryRun = hasFlag("--dry-run");

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  }
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!fromPrefixRaw || !toPrefixRaw) {
    throw new Error('Usage: node --env-file=.env.local scripts/move-storage-prefix.mjs --bucket export --from "src/prefix" --to "dest/prefix" [--dry-run]');
  }

  const fromPrefix = trimSlashes(fromPrefixRaw);
  const toPrefix = trimSlashes(toPrefixRaw);

  if (toPrefix === fromPrefix || toPrefix.startsWith(`${fromPrefix}/`)) {
    throw new Error(`Destination "${toPrefix}" must not be equal to or inside source "${fromPrefix}"`);
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const sourceFiles = await listAllFilesRecursive(sb, bucket, fromPrefix);
  if (sourceFiles.length === 0) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          bucket,
          fromPrefix,
          toPrefix,
          sourceFiles: 0,
          moved: 0,
          failed: 0,
          dryRun,
          message: "No files found under source prefix.",
        },
        null,
        2
      )
    );
    return;
  }

  let moved = 0;
  let failed = 0;
  const errors = [];

  for (const oldPath of sourceFiles) {
    const relative = oldPath.slice(fromPrefix.length + 1);
    const newPath = relative ? `${toPrefix}/${relative}` : toPrefix;

    if (dryRun) {
      moved += 1;
      console.log(`[dry-run] ${oldPath} -> ${newPath}`);
      continue;
    }

    const { error } = await sb.storage.from(bucket).move(oldPath, newPath);
    if (error) {
      failed += 1;
      const msg = `${oldPath} -> ${newPath}: ${error.message}`;
      errors.push(msg);
      console.error(`Move failed: ${msg}`);
      continue;
    }

    moved += 1;
    console.log(`Moved: ${oldPath} -> ${newPath}`);
  }

  const sourceAfter = await listAllFilesRecursive(sb, bucket, fromPrefix);
  const destinationAfter = await listAllFilesRecursive(sb, bucket, toPrefix);

  console.log(
    JSON.stringify(
      {
        ok: failed === 0,
        bucket,
        fromPrefix,
        toPrefix,
        sourceFiles: sourceFiles.length,
        moved,
        failed,
        sourceRemaining: sourceAfter.length,
        destinationFiles: destinationAfter.length,
        dryRun,
        errors: errors.slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
