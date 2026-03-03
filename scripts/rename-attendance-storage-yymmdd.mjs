import { createClient } from "@supabase/supabase-js";

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectCode = getArg("--project", "A27");
const bucket = getArg("--bucket", process.env.SUPABASE_STORAGE_BUCKET || "imports");
const dryRun = hasFlag("--dry-run");

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  process.exit(1);
}
if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function isYearFolder(name) {
  return /^\d{4}$/.test(name);
}

function parseMonthFromFolder(name) {
  const m = /^(\d{2})-/.exec(name);
  return m ? m[1] : null;
}

function classifyToken(token, yearSuffix, month) {
  const looksYYMMDD = token.slice(0, 2) === yearSuffix && token.slice(2, 4) === month;
  if (looksYYMMDD) return "yymmdd";

  const looksDDMMYY = token.slice(2, 4) === month && token.slice(4, 6) === yearSuffix;
  if (looksDDMMYY) return "ddmmyy";

  return "unknown";
}

async function listFolder(path) {
  const { data, error } = await sb.storage.from(bucket).list(path, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(`List failed for ${path}: ${error.message}`);
  return data || [];
}

async function updateFilesTablePath(oldPath, newPath) {
  const updates = [
    { from: oldPath, to: newPath },
    { from: `${bucket}/${oldPath}`, to: `${bucket}/${newPath}` },
  ];

  for (const entry of updates) {
    const { error } = await sb
      .from("files")
      .update({ storage_path: entry.to })
      .eq("storage_path", entry.from);
    if (error) {
      console.warn(`files table update warning (${entry.from} -> ${entry.to}): ${error.message}`);
    }
  }
}

async function main() {
  const basePrefix = `${projectCode}/1-Daily Personal Reports`;
  const years = await listFolder(basePrefix);

  let scanned = 0;
  let renamed = 0;
  let already = 0;
  let skipped = 0;
  let failed = 0;

  for (const yearEntry of years) {
    const yearName = yearEntry?.name || "";
    if (!isYearFolder(yearName)) continue;

    const monthsPrefix = `${basePrefix}/${yearName}`;
    const monthEntries = await listFolder(monthsPrefix);

    for (const monthEntry of monthEntries) {
      const monthName = monthEntry?.name || "";
      const month = parseMonthFromFolder(monthName);
      if (!month) continue;

      const monthPrefix = `${monthsPrefix}/${monthName}`;
      const fileEntries = await listFolder(monthPrefix);
      const existingNames = new Set(fileEntries.map((f) => f?.name || ""));
      const yy = yearName.slice(2);

      for (const file of fileEntries) {
        const name = file?.name || "";
        const m = new RegExp(`^${projectCode}-E-IN-(\\d{6})_rev(\\d+)\\.xlsx$`, "i").exec(name);
        if (!m) continue;

        scanned += 1;
        const token = m[1];
        const rev = m[2];
        const format = classifyToken(token, yy, month);

        if (format === "yymmdd") {
          already += 1;
          continue;
        }

        if (format !== "ddmmyy") {
          skipped += 1;
          console.warn(`Skipping unknown token format: ${monthPrefix}/${name}`);
          continue;
        }

        const dd = token.slice(0, 2);
        const newToken = `${yy}${month}${dd}`;
        const newName = `${projectCode}-E-IN-${newToken}_rev${rev}.xlsx`;
        const oldPath = `${monthPrefix}/${name}`;
        const newPath = `${monthPrefix}/${newName}`;

        if (existingNames.has(newName)) {
          skipped += 1;
          console.warn(`Skipping because destination exists: ${newPath}`);
          continue;
        }

        if (dryRun) {
          renamed += 1;
          console.log(`[dry-run] move ${oldPath} -> ${newPath}`);
          continue;
        }

        const { error: moveErr } = await sb.storage.from(bucket).move(oldPath, newPath);
        if (moveErr) {
          failed += 1;
          console.error(`Move failed ${oldPath} -> ${newPath}: ${moveErr.message}`);
          continue;
        }

        await updateFilesTablePath(oldPath, newPath);
        renamed += 1;
        existingNames.delete(name);
        existingNames.add(newName);
        console.log(`Moved ${oldPath} -> ${newPath}`);
      }
    }
  }

  console.log(
    JSON.stringify(
      { ok: failed === 0, projectCode, bucket, scanned, renamed, already, skipped, failed, dryRun },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
