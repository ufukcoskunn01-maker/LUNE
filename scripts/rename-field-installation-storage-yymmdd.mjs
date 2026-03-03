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
const rootPrefix = getArg("--root", `${projectCode}/2-Daily Field Reports`);
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

function isFolder(item) {
  const name = String(item?.name || "").trim();
  if (!name) return false;
  const metadata = item?.metadata || {};
  if (typeof metadata.size === "number" || typeof metadata.mimetype === "string") return false;
  return !name.includes(".");
}

const MONTH_NAMES = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function parseMonthFromSegment(segment) {
  const lowered = String(segment || "").toLowerCase();
  for (const [name, token] of Object.entries(MONTH_NAMES)) {
    if (lowered.includes(name)) return token;
  }

  const m = lowered.match(/^(\d{1,2})(?:\D|$)/);
  if (!m) return null;
  const month = Number(m[1]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return String(month).padStart(2, "0");
}

function inferYearMonthFromPath(storagePath) {
  const parts = String(storagePath || "")
    .split("/")
    .filter(Boolean);

  const yearIndex = parts.findIndex((part) => /^20\d{2}$/.test(part));
  const year = yearIndex >= 0 ? parts[yearIndex] : null;
  let month = null;

  // Prefer month segments that come after the explicit year folder.
  if (yearIndex >= 0) {
    for (let i = yearIndex + 1; i < parts.length; i += 1) {
      month = parseMonthFromSegment(parts[i]);
      if (month) break;
    }
  }

  // Fallback for atypical paths.
  if (!month) {
    for (const part of parts) {
      if (/^\d+-daily\b/i.test(part)) continue;
      month = parseMonthFromSegment(part);
      if (month) break;
    }
  }

  if (!year || !month) return null;
  return { year, month, yy: year.slice(2) };
}

function classifyToken(token, yy, mm) {
  const isYYMMDD = token.slice(0, 2) === yy && token.slice(2, 4) === mm;
  if (isYYMMDD) return "yymmdd";
  const isDDMMYY = token.slice(2, 4) === mm && token.slice(4, 6) === yy;
  if (isDDMMYY) return "ddmmyy";
  return "unknown";
}

function parseRenamableFileName(fileName) {
  const ins = /^([A-Z0-9]+)-E-INS-(\d{6})(_rev\d{1,3}\.(?:xlsx|xlsm|xls))$/i.exec(fileName);
  if (ins) {
    return {
      token: ins[2],
      prefix: `${ins[1]}-E-INS-`,
      suffix: ins[3],
    };
  }

  const withRevision = /^(.*)(\d{6})(_rev\d{1,3}\.(?:xlsx|xlsm|xls))$/i.exec(fileName);
  if (withRevision) {
    return {
      token: withRevision[2],
      prefix: withRevision[1],
      suffix: withRevision[3],
    };
  }

  const plain = /^(.*)(\d{6})(\.(?:xlsx|xlsm|xls))$/i.exec(fileName);
  if (plain) {
    return {
      token: plain[2],
      prefix: plain[1],
      suffix: plain[3],
    };
  }

  return null;
}

async function listPrefix(path) {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(path, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`List failed for ${path}: ${error.message}`);
    const batch = data || [];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return out;
}

async function listFilesRecursive(prefix) {
  const files = [];
  const queue = [prefix.replace(/^\/+|\/+$/g, "")];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const items = await listPrefix(current);
    for (const item of items) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const full = `${current}/${name}`;
      if (isFolder(item)) queue.push(full);
      else files.push(full);
    }
  }

  return files;
}

async function updateFieldInstallationFiles(oldPath, newPath, newName) {
  const { error } = await sb
    .from("field_installation_files")
    .update({ storage_path: newPath, file_name: newName })
    .eq("bucket_id", bucket)
    .eq("storage_path", oldPath);
  if (error) {
    console.warn(`field_installation_files update warning (${oldPath} -> ${newPath}): ${error.message}`);
  }
}

async function updateGenericFilesTable(oldPath, newPath) {
  const variants = [
    { from: oldPath, to: newPath },
    { from: `${bucket}/${oldPath}`, to: `${bucket}/${newPath}` },
  ];
  for (const item of variants) {
    const { error } = await sb.from("files").update({ storage_path: item.to }).eq("storage_path", item.from);
    if (error) {
      // Some projects don't have/need this table linkage.
    }
  }
}

async function main() {
  const allFiles = await listFilesRecursive(rootPrefix);
  const seenNamesByDir = new Map();

  let scanned = 0;
  let renamed = 0;
  let already = 0;
  let skipped = 0;
  let failed = 0;

  for (const storagePath of allFiles) {
    const fileName = storagePath.split("/").pop() || "";
    const parsedName = parseRenamableFileName(fileName);
    if (!parsedName) continue;

    scanned += 1;
    const token = parsedName.token;

    const ym = inferYearMonthFromPath(storagePath);
    if (!ym) {
      skipped += 1;
      console.warn(`Skipping (cannot infer year/month from path): ${storagePath}`);
      continue;
    }

    const format = classifyToken(token, ym.yy, ym.month);
    if (format === "yymmdd") {
      already += 1;
      continue;
    }
    if (format !== "ddmmyy") {
      skipped += 1;
      console.warn(`Skipping unknown token format: ${storagePath}`);
      continue;
    }

    const day = token.slice(0, 2);
    const newToken = `${ym.yy}${ym.month}${day}`;
    const newName = `${parsedName.prefix}${newToken}${parsedName.suffix}`;
    const dir = storagePath.slice(0, storagePath.length - fileName.length - 1);
    const newPath = `${dir}/${newName}`;

    const dirSet = seenNamesByDir.get(dir) || new Set();
    if (!seenNamesByDir.has(dir)) {
      for (const p of allFiles) {
        if (p.startsWith(`${dir}/`)) dirSet.add(p.split("/").pop() || "");
      }
      seenNamesByDir.set(dir, dirSet);
    }

    if (dirSet.has(newName)) {
      skipped += 1;
      console.warn(`Skipping because destination exists: ${newPath}`);
      continue;
    }

    if (dryRun) {
      renamed += 1;
      console.log(`[dry-run] move ${storagePath} -> ${newPath}`);
      dirSet.delete(fileName);
      dirSet.add(newName);
      continue;
    }

    const { error: moveErr } = await sb.storage.from(bucket).move(storagePath, newPath);
    if (moveErr) {
      failed += 1;
      console.error(`Move failed ${storagePath} -> ${newPath}: ${moveErr.message}`);
      continue;
    }

    await updateFieldInstallationFiles(storagePath, newPath, newName);
    await updateGenericFilesTable(storagePath, newPath);

    renamed += 1;
    dirSet.delete(fileName);
    dirSet.add(newName);
    console.log(`Moved ${storagePath} -> ${newPath}`);
  }

  console.log(
    JSON.stringify(
      { ok: failed === 0, projectCode, bucket, rootPrefix, scanned, renamed, already, skipped, failed, dryRun },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
