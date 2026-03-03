import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const TOKENS_PATH = path.join(ROOT_DIR, "tokens", "tokens.json");
const OUTPUT_PATH = path.join(ROOT_DIR, "src", "app", "tokens.generated.css");

const REQUIRED_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "radius",
];

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isTokenLeaf(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  return Object.prototype.hasOwnProperty.call(node, "$value") || Object.prototype.hasOwnProperty.call(node, "value");
}

function extractTokenValue(node) {
  if (Object.prototype.hasOwnProperty.call(node, "$value")) return node.$value;
  if (Object.prototype.hasOwnProperty.call(node, "value")) return node.value;
  return undefined;
}

function flattenTokenLeaves(node, pathParts = [], out = []) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return out;
  if (isTokenLeaf(node)) {
    out.push({
      path: pathParts,
      value: extractTokenValue(node),
    });
    return out;
  }

  for (const [key, value] of Object.entries(node)) {
    flattenTokenLeaves(value, [...pathParts, key], out);
  }

  return out;
}

function resolveThemeTokens(payload, name) {
  if (payload[name] && typeof payload[name] === "object") return payload[name];
  if (payload.themes?.[name] && typeof payload.themes[name] === "object") return payload.themes[name];
  if (payload.tokenSets?.[name] && typeof payload.tokenSets[name] === "object") return payload.tokenSets[name];
  if (payload.sets?.[name] && typeof payload.sets[name] === "object") return payload.sets[name];
  return null;
}

function buildThemeIndex(themeObject) {
  const leaves = flattenTokenLeaves(themeObject);
  const index = new Map();

  for (const leaf of leaves) {
    const normalizedPath = leaf.path.map(normalizeKey).filter(Boolean);
    if (!normalizedPath.length) continue;

    const aliases = new Set();
    aliases.add(normalizedPath[normalizedPath.length - 1]);
    aliases.add(normalizedPath.join("-"));

    if (["color", "colors"].includes(normalizedPath[0])) {
      aliases.add(normalizedPath.slice(1).join("-"));
    }
    if (["semantic", "semantics", "token", "tokens"].includes(normalizedPath[0])) {
      aliases.add(normalizedPath.slice(1).join("-"));
    }

    for (const alias of aliases) {
      const key = normalizeKey(alias);
      if (!key) continue;
      if (!index.has(key)) {
        index.set(key, leaf.value);
      }
    }
  }

  return index;
}

function buildResolvedTheme(themeName, themeObject) {
  const index = buildThemeIndex(themeObject);
  const resolved = {};
  const missing = [];

  for (const requiredKey of REQUIRED_KEYS) {
    const normalized = normalizeKey(requiredKey);
    const value = index.get(normalized);

    if (value === undefined || value === null || value === "") {
      missing.push(requiredKey);
      continue;
    }

    resolved[requiredKey] = String(value);
  }

  if (missing.length > 0) {
    throw new Error(`Missing required tokens in ${themeName}: ${missing.join(", ")}`);
  }

  return resolved;
}

function formatCssVars(selector, tokens) {
  const lines = [`${selector} {`];
  for (const key of REQUIRED_KEYS) {
    lines.push(`  --${key}: ${tokens[key]};`);
  }
  lines.push("}");
  return lines.join("\n");
}

async function main() {
  const raw = await fs.readFile(TOKENS_PATH, "utf8");
  const payload = JSON.parse(raw);

  const lightTokensRaw = resolveThemeTokens(payload, "light");
  const darkTokensRaw = resolveThemeTokens(payload, "dark");
  if (!lightTokensRaw || !darkTokensRaw) {
    throw new Error("Expected token themes 'light' and 'dark' in tokens/tokens.json");
  }

  const lightTokens = buildResolvedTheme("light", lightTokensRaw);
  const darkTokens = buildResolvedTheme("dark", darkTokensRaw);

  const output = [
    "/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. */",
    "/* Source: tokens/tokens.json */",
    "",
    formatCssVars(":root", lightTokens),
    "",
    formatCssVars(".dark", darkTokens),
    "",
  ].join("\n");

  await fs.writeFile(OUTPUT_PATH, output, "utf8");
  console.log(`Generated ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(`tokens:build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
