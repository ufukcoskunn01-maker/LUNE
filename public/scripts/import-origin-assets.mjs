// scripts/import-origin-assets.mjs
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyEntryTo(zip, entryName, outPath) {
  const entry = zip.getEntry(entryName);
  if (!entry) return false;
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, entry.getData());
  return true;
}

const zipPath = process.argv[2] || "saveweb2zip-com-useorigin-com.zip";
if (!fs.existsSync(zipPath)) {
  console.error(`Zip not found: ${zipPath}`);
  process.exit(1);
}

const zip = new AdmZip(zipPath);
const outBase = path.resolve("public", "origin");
const outImages = path.join(outBase, "images");
const outMedia = path.join(outBase, "media");
const outFonts = path.join(outBase, "fonts");

ensureDir(outImages);
ensureDir(outMedia);
ensureDir(outFonts);

// Copy all images/
for (const e of zip.getEntries()) {
  if (e.isDirectory) continue;

  if (e.entryName.startsWith("images/")) {
    const rel = e.entryName.replace(/^images\//, "");
    const out = path.join(outImages, rel);
    ensureDir(path.dirname(out));
    fs.writeFileSync(out, e.getData());
  }

  if (e.entryName.startsWith("fonts/")) {
    const rel = e.entryName.replace(/^fonts\//, "");
    const out = path.join(outFonts, rel);
    ensureDir(path.dirname(out));
    fs.writeFileSync(out, e.getData());
  }
}

// Copy clouds video with a clean filename
const mp4Entry = zip
  .getEntries()
  .find((e) => /Clouds1-transcode\.mp4$/i.test(e.entryName))?.entryName;

const webmEntry = zip
  .getEntries()
  .find((e) => /Clouds1-transcode\.webm$/i.test(e.entryName))?.entryName;

if (mp4Entry) copyEntryTo(zip, mp4Entry, path.join(outMedia, "clouds.mp4"));
if (webmEntry) copyEntryTo(zip, webmEntry, path.join(outMedia, "clouds.webm"));

console.log("✅ Origin assets imported to:", outBase);
console.log("   Video:", mp4Entry ? "/origin/media/clouds.mp4" : "(mp4 not found)");
console.log("   Images:", "/origin/images/...");
console.log("   Fonts:", "/origin/fonts/...");
