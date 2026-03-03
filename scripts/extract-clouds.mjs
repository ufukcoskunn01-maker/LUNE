import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const zipPath = process.argv[2] || "saveweb2zip-com-useorigin-com.zip";
const outDir = path.resolve("public", "origin", "media");
fs.mkdirSync(outDir, { recursive: true });

const zip = new AdmZip(zipPath);
const entries = zip.getEntries().filter(e => !e.isDirectory);

// find the mp4/webm inside zip (Origin clouds background)
const mp4 = entries.find(e => /Clouds1-transcode\.mp4$/i.test(e.entryName)) || entries.find(e => /\.mp4$/i.test(e.entryName));
const webm = entries.find(e => /Clouds1-transcode\.webm$/i.test(e.entryName)) || entries.find(e => /\.webm$/i.test(e.entryName));

if (!mp4) {
  console.error("No mp4 found in zip.");
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, "clouds.mp4"), mp4.getData());
console.log("✅ wrote /public/origin/media/clouds.mp4 from", mp4.entryName);

if (webm) {
  fs.writeFileSync(path.join(outDir, "clouds.webm"), webm.getData());
  console.log("✅ wrote /public/origin/media/clouds.webm from", webm.entryName);
}
