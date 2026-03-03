import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const ALLOWED_FILE = path.join(SRC_DIR, "features", "files", "uploadFile.ts");
const UPLOAD_PATTERN = /storage\.from\([\s\S]*?\)\.upload\(/g;
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", ".git"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];
for (const file of walk(SRC_DIR)) {
  if (path.resolve(file) === path.resolve(ALLOWED_FILE)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (UPLOAD_PATTERN.test(text)) {
    offenders.push(path.relative(ROOT, file));
  }
}

if (offenders.length > 0) {
  console.error("Direct Supabase upload usage is forbidden outside src/features/files/uploadFile.ts");
  offenders.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log("OK: no direct Supabase upload usage outside uploadFile.ts");
