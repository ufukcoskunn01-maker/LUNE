import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const bucket = process.env.SUPABASE_STORAGE_BUCKET || "imports";
const project = "A27";
const prefixes = [
  "A27/1-Daily Personal Reports/2025/10-October",
  "A27/1-Daily Personal Reports/2025/11-November",
];
const base = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

function parseWorkDate(token) {
  if (!/^\d{6}$/.test(token)) return null;

  const yy = token.slice(0, 2);
  const mm = token.slice(2, 4);
  const dd = token.slice(4, 6);
  if (yy === "25" && (mm === "10" || mm === "11")) return `20${yy}-${mm}-${dd}`;

  const dd2 = token.slice(0, 2);
  const mm2 = token.slice(2, 4);
  const yy2 = token.slice(4, 6);
  if (yy2 === "25" && (mm2 === "10" || mm2 === "11")) return `20${yy2}-${mm2}-${dd2}`;

  return null;
}

async function listAll(prefix) {
  const out = [];
  const queue = [prefix];

  while (queue.length) {
    const current = queue.shift();
    const { data, error } = await sb.storage.from(bucket).list(current, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw error;

    for (const entry of data || []) {
      const full = `${current}/${entry.name}`;
      if (entry.id) out.push(full);
      else queue.push(full);
    }
  }

  return out;
}

async function run() {
  let total = 0;
  let ok = 0;
  let fail = 0;
  const errors = [];

  for (const prefix of prefixes) {
    const files = (await listAll(prefix)).filter((f) => /\.xlsx$/i.test(f));

    for (const full of files) {
      const name = full.split("/").pop();
      const match = /^A27-E-IN-(\d{6})_rev\d+\.xlsx$/i.exec(name || "");
      if (!match) continue;

      const workDate = parseWorkDate(match[1]);
      if (!workDate) continue;

      total += 1;
      const fd = new FormData();
      fd.append("projectCode", project);
      fd.append("workDate", workDate);
      fd.append("sourcePath", `${bucket}/${full}`);

      try {
        const res = await fetch(`${base}/api/jobs/import-daily-personal-reports`, {
          method: "POST",
          body: fd,
        });

        if (res.ok) {
          ok += 1;
        } else {
          fail += 1;
          errors.push(`${full} -> ${res.status} ${await res.text()}`);
        }
      } catch (error) {
        fail += 1;
        errors.push(`${full} -> ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  console.log(JSON.stringify({ total, ok, fail, errors: errors.slice(0, 30) }, null, 2));
  if (fail > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
