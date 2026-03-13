import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mhtmlPath = path.join(root, "reference", "Home", "origin-homepage-clean.mhtml");
const coveragePath = path.join(root, "reference", "Home", "Coverage-20260311T172946.json");
const outputPath = path.join(
  root,
  "public",
  "reference-pages",
  "home",
  "origin-homepage-generated.html",
);

function decodeQuotedPrintable(input) {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function parseMhtml(raw) {
  const boundaryMatch = raw.match(/boundary="([^"]+)"/i);
  if (!boundaryMatch) {
    throw new Error("MHTML boundary not found.");
  }

  const boundary = `--${boundaryMatch[1]}`;
  const parts = raw.split(boundary).slice(1, -1);

  return parts
    .map((part) => part.replace(/^\r?\n/, ""))
    .map((part) => {
      const splitIndex = part.search(/\r?\n\r?\n/);
      if (splitIndex === -1) {
        return null;
      }

      const headerText = part.slice(0, splitIndex);
      const body = part.slice(splitIndex).replace(/^\r?\n\r?\n/, "");
      const headers = Object.fromEntries(
        headerText
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => {
            const sep = line.indexOf(":");
            return [line.slice(0, sep).trim().toLowerCase(), line.slice(sep + 1).trim()];
          }),
      );

      return { headers, body };
    })
    .filter(Boolean);
}

function escapeStyleClose(text) {
  return text.replace(/<\/style/gi, "<\\/style");
}

const rawMhtml = fs.readFileSync(mhtmlPath, "utf8");
const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
const parts = parseMhtml(rawMhtml);

let html = "";
const cidStyles = new Map();
const locationAssets = new Map();

for (const part of parts) {
  const contentType = part.headers["content-type"] || "";
  const transferEncoding = (part.headers["content-transfer-encoding"] || "").toLowerCase();
  const contentId = (part.headers["content-id"] || "").replace(/[<>]/g, "");
  const contentLocation = part.headers["content-location"];

  let decodedBody = part.body;

  if (transferEncoding.includes("quoted-printable")) {
    decodedBody = decodeQuotedPrintable(decodedBody);
  } else if (transferEncoding.includes("base64")) {
    decodedBody = decodedBody.replace(/\s+/g, "");
  }

  if (
    contentType.startsWith("text/html") &&
    !html &&
    contentLocation === "https://app.useorigin.com/home/preview"
  ) {
    html = decodedBody;
    continue;
  }

  if (contentType.startsWith("text/css")) {
    if (contentId) {
      cidStyles.set(contentId, decodedBody);
    }
    continue;
  }

  if (
    (contentType.startsWith("image/") ||
      contentType.startsWith("font/") ||
      /application\/font|application\/x-font|application\/octet-stream/i.test(contentType)) &&
    contentLocation
  ) {
    locationAssets.set(contentLocation, `data:${contentType};base64,${decodedBody}`);
  }
}

if (!html) {
  throw new Error("HTML part not found in MHTML.");
}

html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
html = html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
html = html.replace(/<browser-mcp-container[\s\S]*?<\/browser-mcp-container>/gi, "");
html = html.replace(/<div id="refiner-widget-wrapper"[\s\S]*?<\/div>/gi, "");
html = html.replace(/<iframe[^>]+id="intercom-frame"[\s\S]*?<\/iframe>/gi, "");
html = html.replace(/<div class="intercom-lightweight-app"><\/div>/gi, "");

for (const [location, dataUri] of locationAssets.entries()) {
  html = html.split(location).join(dataUri);
}

html = html.replace(/<link[^>]+href="cid:([^"]+)"[^>]*\/?>/gi, (_, cid) => {
  const css = cidStyles.get(cid);
  return css ? `<style>${escapeStyleClose(css)}</style>` : "";
});

html = html.replace(/<link[^>]+href="(https:\/\/app\.useorigin\.com\/[^"]+\.css)"[^>]*>/gi, (_, url) => {
  const entry = coverage.find((item) => item.url === url && typeof item.text === "string");
  return entry ? `<style data-source="${url}">${escapeStyleClose(entry.text)}</style>` : "";
});

fs.writeFileSync(outputPath, html, "utf8");
console.log(`Generated ${path.relative(root, outputPath)}`);
