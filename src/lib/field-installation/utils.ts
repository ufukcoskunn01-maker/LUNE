export type EfficiencyStatus = "good" | "risk" | "bad" | "unknown";

const DATE_TOKEN_RE = /(\d{6})/g;

function parseTokenAsYYMMDD(token: string): string | null {
  const yy = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const dd = Number(token.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = 2000 + yy;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function parseTokenAsDDMMYY(token: string): string | null {
  const dd = Number(token.slice(0, 2));
  const mm = Number(token.slice(2, 4));
  const yy = Number(token.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = 2000 + yy;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parseInstallationFileMeta(fileName: string): { workDate: string; revision: string; fileKind: string } | null {
  const lower = fileName.toLowerCase();
  const revMatch = lower.match(/(?:_|-)rev(\d{1,3})/i);
  const revision = revMatch ? `rev${String(Number(revMatch[1] || 0)).padStart(2, "0")}` : "rev00";
  const fileKind = lower.includes("ins") || lower.includes("installation") ? "installation" : "unknown";

  const tokens = Array.from(lower.matchAll(DATE_TOKEN_RE)).map((m) => m[1]);
  for (const token of tokens) {
    const yymmdd = parseTokenAsYYMMDD(token);
    if (yymmdd) {
      return { workDate: yymmdd, revision, fileKind };
    }
    const ddmmyy = parseTokenAsDDMMYY(token);
    if (ddmmyy) {
      return { workDate: ddmmyy, revision, fileKind };
    }
  }
  return null;
}

export function mapEfficiencyStatus(value: number | null | undefined): EfficiencyStatus {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  if (value >= 80) return "good";
  if (value >= 50) return "risk";
  return "bad";
}

export function clampEfficiency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw.replace(/\u00A0/g, "").replace(/\s+/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/,/g, ".");
  }

  normalized = normalized.replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  return null;
}
