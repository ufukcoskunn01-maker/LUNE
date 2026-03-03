import crypto from "crypto";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadFile } from "@/features/files/uploadFile";
import { classifyScheduleChangeType, type ScheduleCompareChangeType } from "@/lib/schedule/change-type";
import { matchScheduleTasks, normalizeMatchText, type MatchMethod } from "@/lib/schedule/compare";

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "imports";
const SCHEDULE_SUBFOLDER = "3-Project Schecule";
const SCHEDULE_LOGICAL_NAME = "schedule_revision";
const SYSTEM_FILES_OWNER_ID = process.env.FILES_SYSTEM_OWNER_ID || "00000000-0000-0000-0000-000000000000";
const RELATIONSHIP_TYPE_MAP: Record<string, string> = {
  "0": "FF",
  "1": "FS",
  "2": "SF",
  "3": "SS",
  FS: "FS",
  FF: "FF",
  SF: "SF",
  SS: "SS",
};

type UnknownRecord = Record<string, unknown>;

export type ScheduleSourceKind = "mpp" | "xml" | "xlsx" | "csv" | "unknown";
export type ScheduleChangeType = ScheduleCompareChangeType;
export type ScheduleRevisionType = "baseline" | "update";
export type ScheduleDisciplineGroup = "electrical" | "mechanical" | "construction";

const SCHEDULE_GROUP_LABEL: Record<ScheduleDisciplineGroup, string> = {
  electrical: "Electrical",
  mechanical: "Mechanical",
  construction: "Construction",
};

const SCHEDULE_GROUP_ORDER: ScheduleDisciplineGroup[] = ["electrical", "mechanical", "construction"];

export type ScheduleLink = {
  raw: string;
  id: string;
  relationType: string;
  lagDays: number;
};

export type ScheduleTaskSnapshot = {
  key: string;
  matchKey: string;
  activityCode: string | null;
  wbs: string;
  taskName: string;
  taskId: string | null;
  oldDisplayId: string | null;
  startDate: string | null;
  finishDate: string | null;
  progressPct: number | null;
  durationDays: number | null;
  remainingDurationDays: number | null;
  predecessors: string[];
  predecessorLinks: ScheduleLink[];
  successors: string[];
  successorLinks: ScheduleLink[];
  predCount: number;
  succCount: number;
  totalFloatDays: number | null;
  critical: boolean | null;
  cpMember: boolean | null;
  constraintType: string | null;
  constraintDate: string | null;
  calendarName: string | null;
  milestone: boolean;
  discipline: string | null;
  area: string | null;
};

export type ScheduleRevision = {
  id: string;
  fileId: string | null;
  projectCode: string;
  revisionCode: string;
  revisionType: ScheduleRevisionType;
  group: ScheduleDisciplineGroup | null;
  dataDate: string | null;
  importedAt: string;
  importedBy: string;
  sourceFileName: string;
  sourceFilePath: string;
  sourceKind: ScheduleSourceKind;
  checksum: string | null;
  byteSize: number | null;
  comment: string;
  hasSnapshot: boolean;
  taskCount: number;
  snapshotTasks: ScheduleTaskSnapshot[];
};

export type ScheduleCompareRow = {
  rowId: string;
  stableKey: string;
  activityCode: string | null;
  matchConfidence: number;
  matchMethod: MatchMethod;
  wbs: string;
  oldWbs: string | null;
  newWbs: string | null;
  taskName: string;
  oldTaskName: string | null;
  newTaskName: string | null;
  oldId: string | null;
  newId: string | null;
  oldStart: string | null;
  newStart: string | null;
  deltaStartDays: number | null;
  startShiftDays: number | null;
  oldFinish: string | null;
  newFinish: string | null;
  deltaFinishDays: number | null;
  finishShiftDays: number | null;
  progressOld: number | null;
  progressNew: number | null;
  deltaProgress: number | null;
  durationOld: number | null;
  durationNew: number | null;
  deltaDuration: number | null;
  remainingDurationOld: number | null;
  remainingDurationNew: number | null;
  predCountOld: number;
  predCountNew: number;
  succCountOld: number;
  succCountNew: number;
  predecessorsOld: string[];
  predecessorsNew: string[];
  successorsOld: string[];
  successorsNew: string[];
  logicChanged: boolean;
  predecessorsAdded: string[];
  predecessorsRemoved: string[];
  successorsAdded: string[];
  successorsRemoved: string[];
  relationshipTypeChanged: boolean;
  lagChanged: boolean;
  totalFloatOld: number | null;
  totalFloatNew: number | null;
  deltaFloat: number | null;
  floatDelta: number | null;
  criticalOld: boolean | null;
  criticalNew: boolean | null;
  cpMembershipOld: boolean | null;
  cpMembershipNew: boolean | null;
  criticalPathImpacted: boolean;
  constraintTypeOld: string | null;
  constraintTypeNew: string | null;
  constraintDateOld: string | null;
  constraintDateNew: string | null;
  constraintsChanged: boolean;
  calendarOld: string | null;
  calendarNew: string | null;
  calendarChanged: boolean;
  milestoneOld: boolean;
  milestoneNew: boolean;
  milestoneMoved: boolean;
  disciplineOld: string | null;
  disciplineNew: string | null;
  areaOld: string | null;
  areaNew: string | null;
  changeType: ScheduleChangeType;
  changeTypeLabel: string;
  changeFlags: string[];
  impactDays: number | null;
  diffSummary: string;
  severityScore: number;
  reasonNote: string | null;
};

export type ScheduleKpiCard = {
  id: string;
  label: string;
  count: number;
  direction: "up" | "down" | "flat";
  deltaText: string;
  topDriver: string;
};

export type ScheduleQualitySummary = {
  totalTasks: number;
  openEndsPredPct: number;
  openEndsSuccPct: number;
  leadsLagsCount: number;
  constraintsCount: number;
  negativeFloatCount: number;
  criticalCount: number;
  milestonesCount: number;
  calendarCount: number;
  criticalPathDurationDays: number;
};

export type ScheduleQualityMetric = {
  id: string;
  label: string;
  oldValue: number;
  newValue: number;
  delta: number;
  status: "green" | "yellow" | "red";
  detail: string;
};

export type ScheduleCompareSummary = {
  addedTasks: number;
  removedTasks: number;
  modifiedTasks: number;
  changedTasks: number;
  unchangedTasks: number;
  criticalChanges: number;
  maxFinishShiftDays: number;
  lowConfidence: number;
  criticalPathImpacted: number;
  floatErosionCount: number;
  floatErosionSumDays: number;
  logicChanged: number;
  constraintsChanged: number;
  calendarChanged: number;
  milestonesMoved: number;
};

export type ScheduleCompareResult = {
  comparedAt: string;
  projectCode: string;
  projectName: string;
  cutoffDate: string;
  cutoffWeek: number;
  totalProjectWeeks: number;
  oldProjectStart: string | null;
  oldProjectFinish: string | null;
  newProjectStart: string | null;
  newProjectFinish: string | null;
  oldRevision: ScheduleRevision;
  newRevision: ScheduleRevision;
  rows: ScheduleCompareRow[];
  summary: ScheduleCompareSummary;
  kpis: ScheduleKpiCard[];
  qualityOld: ScheduleQualitySummary;
  qualityNew: ScheduleQualitySummary;
  qualityMetrics: ScheduleQualityMetric[];
  warnings: string[];
};

export type ScheduleCompareFilters = {
  search?: string;
  changeTypes?: ScheduleChangeType[];
  onlyCritical?: boolean;
  onlyMilestones?: boolean;
  showAdded?: boolean;
  showRemoved?: boolean;
  wbsPrefix?: string;
  minAbsFinishShiftDays?: number;
  minAbsStartShiftDays?: number;
  confidenceMin?: number;
};

export type ScheduleImportResult = {
  revision: ScheduleRevision;
  warnings: string[];
  parsedTasks: number;
};

export type ScheduleAssembleResult = {
  revision: ScheduleRevision;
  sourceGroups: Array<{
    group: ScheduleDisciplineGroup;
    label: string;
    revisionId: string;
    revisionCode: string;
    importedAt: string;
    sourceFileName: string;
  }>;
  mergedTaskCount: number;
  warnings: string[];
};

export type ScheduleRevisionListResult = {
  projectCode: string;
  projectName: string;
  revisions: ScheduleRevision[];
  groupStatus: Array<{
    group: ScheduleDisciplineGroup;
    label: string;
    ready: boolean;
    latestRevisionId: string | null;
    latestRevisionCode: string | null;
    latestImportedAt: string | null;
    latestSourceFileName: string | null;
  }>;
  canAssembleMergedSchedule: boolean;
  latestMsProjectPath: string | null;
  latestCutoffDate: string;
};

type StorageFileEntry = {
  path: string;
  updatedAt: string | null;
  size: number | null;
};

type CompareDriverId =
  | "added"
  | "removed"
  | "changed"
  | "unchanged"
  | "criticalChanges"
  | "maxFinishShift"
  | "lowConfidence"
  | "logicChanged"
  | "constraintsChanged"
  | "calendarChanged"
  | "milestonesMoved";

function normalizeScheduleGroup(value: unknown): ScheduleDisciplineGroup | null {
  const raw = asString(value).toLowerCase();
  if (!raw) return null;
  if (["e", "electrical", "elec"].includes(raw)) return "electrical";
  if (["m", "mechanical", "mech"].includes(raw)) return "mechanical";
  if (["c", "construction", "civil", "general"].includes(raw)) return "construction";
  return null;
}

function inferScheduleGroupFromFilename(fileName: string): ScheduleDisciplineGroup | null {
  const upper = fileName.toUpperCase();
  const coded = upper.match(/-([EMC])-PS-/);
  if (coded?.[1] === "E") return "electrical";
  if (coded?.[1] === "M") return "mechanical";
  if (coded?.[1] === "C") return "construction";

  if (/\bELECTRICAL\b|\bELEC\b/.test(upper)) return "electrical";
  if (/\bMECHANICAL\b|\bMECH\b/.test(upper)) return "mechanical";
  if (/\bCONSTRUCTION\b|\bCIVIL\b/.test(upper)) return "construction";
  return null;
}

function buildGroupStatus(revisions: ScheduleRevision[]): ScheduleRevisionListResult["groupStatus"] {
  const desc = [...revisions].sort((a, b) => revisionSortTimestamp(b) - revisionSortTimestamp(a));
  return SCHEDULE_GROUP_ORDER.map((group) => {
    const latest = desc.find((item) => item.group === group) || null;
    return {
      group,
      label: SCHEDULE_GROUP_LABEL[group],
      ready: Boolean(latest),
      latestRevisionId: latest?.id || null,
      latestRevisionCode: latest?.revisionCode || null,
      latestImportedAt: latest?.importedAt || null,
      latestSourceFileName: latest?.sourceFileName || null,
    };
  });
}

function revisionSortTimestamp(item: Pick<ScheduleRevision, "sourceFileName" | "importedAt" | "dataDate">): number {
  const dateToken = item.dataDate || parseDateTokenFromFilename(item.sourceFileName || "");
  if (dateToken) {
    const stamp = new Date(`${dateToken}T00:00:00Z`).getTime();
    if (!Number.isNaN(stamp)) return stamp;
  }
  const imported = new Date(item.importedAt).getTime();
  return Number.isNaN(imported) ? 0 : imported;
}

function buildOfflineFallback(projectCode: string, reason: string): ScheduleRevisionListResult {
  const latestPath = `${projectCode}/${SCHEDULE_SUBFOLDER}/${projectCode}-E-PS-260216_rev00.mpp`;
  const archivePath = `${projectCode}/${SCHEDULE_SUBFOLDER}/Archive/260116/${projectCode}-E-PS-260116_rev00.mpp`;

  const fallback: ScheduleRevision[] = [
    {
      id: toStoragePseudoId(latestPath),
      fileId: null,
      projectCode,
      revisionCode: "U01",
      revisionType: "update",
      group: inferScheduleGroupFromFilename(basename(latestPath)),
      dataDate: parseDateTokenFromFilename(basename(latestPath)),
      importedAt: "2026-02-20T14:27:37.417Z",
      importedBy: "storage-sync",
      sourceFileName: basename(latestPath),
      sourceFilePath: latestPath,
      sourceKind: "mpp",
      checksum: null,
      byteSize: null,
      comment: `Fallback mode: ${reason}`,
      hasSnapshot: false,
      taskCount: 0,
      snapshotTasks: [],
    },
    {
      id: toStoragePseudoId(archivePath),
      fileId: null,
      projectCode,
      revisionCode: "B01",
      revisionType: "baseline",
      group: inferScheduleGroupFromFilename(basename(archivePath)),
      dataDate: parseDateTokenFromFilename(basename(archivePath)),
      importedAt: "2026-02-20T14:28:49.365Z",
      importedBy: "storage-sync",
      sourceFileName: basename(archivePath),
      sourceFilePath: archivePath,
      sourceKind: "mpp",
      checksum: null,
      byteSize: null,
      comment: `Fallback mode: ${reason}`,
      hasSnapshot: false,
      taskCount: 0,
      snapshotTasks: [],
    },
  ];

  const groupStatus = buildGroupStatus(fallback);

  return {
    projectCode,
    projectName: `${projectCode} Project`,
    revisions: fallback,
    groupStatus,
    canAssembleMergedSchedule: groupStatus.every((item) => item.ready),
    latestMsProjectPath: latestPath,
    latestCutoffDate: parseDateTokenFromFilename(basename(latestPath)) || "",
  };
}

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object") return {};
  return value as UnknownRecord;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object" && value && "text" in (value as UnknownRecord)) {
    return asString((value as UnknownRecord).text);
  }
  return String(value).trim();
}

function normalizeName(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeWbs(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");
}

function toIsoDateOnly(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(excelEpoch.getTime() + value * 86400000);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }

  const text = asString(value);
  if (!text) return null;
  const normalized = text.replace(/\//g, "-").replace(/\./g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  if (/^\d{2}-\d{2}-\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split("-");
    return `${year}-${month}-${day}`;
  }

  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = asString(value).toLowerCase();
  if (!text) return null;
  if (["1", "y", "yes", "true", "critical"].includes(text)) return true;
  if (["0", "n", "no", "false"].includes(text)) return false;
  return null;
}

function parseDurationDays(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Number(value);
  const text = asString(value);
  if (!text) return null;
  const normalizedText = text.replace(",", ".");

  const directNumber = Number(normalizedText);
  if (Number.isFinite(directNumber)) return directNumber;

  const iso = normalizedText.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i);
  if (iso) {
    const days = Number(iso[1] ?? "0");
    const hours = Number(iso[2] ?? "0");
    const minutes = Number(iso[3] ?? "0");
    const seconds = Number(iso[4] ?? "0");
    const total = days + hours / 8 + minutes / 480 + seconds / 28800;
    return Number.isFinite(total) ? Number(total.toFixed(3)) : null;
  }

  const explicitDays = normalizedText.match(/(-?\d+(?:\.\d+)?)\s*(?:d|д|дн(?:ей|я)?|days?)/iu);
  if (explicitDays) return Number(explicitDays[1]);

  const explicitHours = normalizedText.match(/(-?\d+(?:\.\d+)?)\s*(?:h|ч|час(?:ов|а)?)/iu);
  if (explicitHours) return Number((Number(explicitHours[1]) / 8).toFixed(3));

  const hms = normalizedText.match(/(?:(\d+):)?(\d+):(\d+)/);
  if (hms) {
    const hours = Number(hms[1] ?? "0");
    const minutes = Number(hms[2] ?? "0");
    const seconds = Number(hms[3] ?? "0");
    return Number(((hours + minutes / 60 + seconds / 3600) / 8).toFixed(3));
  }

  return null;
}

function parseFloatNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asString(value).replace(",", ".");
  if (!text) return null;
  const parsed = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseList(value: unknown): string[] {
  const text = asString(value);
  if (!text) return [];
  return text
    .split(/[\n;,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRelationshipType(typeToken: string): string {
  const normalized = typeToken.toUpperCase().trim();
  return (RELATIONSHIP_TYPE_MAP[normalized] ?? normalized) || "FS";
}

function parseLinkToken(token: string): ScheduleLink {
  const clean = token.replace(/\s+/g, " ").trim();
  const withRelation = clean.match(/^([^:()\s]+)\s*[:\s-]*\s*(FS|FF|SS|SF)?\s*(?:\(?\s*(-?\d+(?:\.\d+)?)\s*[dD]?\s*\)?)?$/i);
  if (withRelation) {
    const id = asString(withRelation[1]);
    const relationType = normalizeRelationshipType(withRelation[2] || "FS");
    const lagDays = Number(withRelation[3] ?? "0");
    return { raw: clean, id, relationType, lagDays: Number.isFinite(lagDays) ? lagDays : 0 };
  }
  return { raw: clean, id: clean, relationType: "FS", lagDays: 0 };
}

function normalizeLinkList(value: unknown): ScheduleLink[] {
  return parseList(value).map(parseLinkToken);
}

function toStoragePseudoId(path: string): string {
  return `storage::${path}`;
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function extensionFromPath(path: string): string {
  const file = basename(path).toLowerCase();
  const idx = file.lastIndexOf(".");
  return idx === -1 ? "" : file.slice(idx + 1);
}

function sourceKindFromPath(path: string): ScheduleSourceKind {
  const ext = extensionFromPath(path);
  if (ext === "mpp") return "mpp";
  if (ext === "xml") return "xml";
  if (["xlsx", "xlsm", "xls"].includes(ext)) return "xlsx";
  if (ext === "csv") return "csv";
  return "unknown";
}

function dateFromYYMMDD(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const yy = Number(token.slice(0, 2));
  const year = yy >= 90 ? 1900 + yy : 2000 + yy;
  const month = Number(token.slice(2, 4));
  const day = Number(token.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateTokenFromFilename(fileName: string): string | null {
  const base = basename(fileName || "");
  const primary = base.match(/-(\d{6})_rev\d*/i);
  if (primary) return dateFromYYMMDD(primary[1]);
  const secondary = base.match(/-(\d{6})(?:\D|$)/);
  if (secondary) return dateFromYYMMDD(secondary[1]);
  return null;
}

function revisionLineageKey(revision: Pick<ScheduleRevision, "sourceFileName" | "sourceFilePath">): string {
  const fileName = basename(revision.sourceFileName || revision.sourceFilePath || "").replace(/\.[^.]+$/, "").toLowerCase();
  if (!fileName) return "";
  const stripped =
    fileName
      .replace(/-(\d{6})_rev\d+$/i, "")
      .replace(/(?:_|-)rev\d+$/i, "")
      .trim() || fileName;
  return stripped;
}

function revisionsShareLineage(oldRevision: ScheduleRevision, newRevision: ScheduleRevision): boolean {
  const oldKey = revisionLineageKey(oldRevision);
  const newKey = revisionLineageKey(newRevision);
  if (!oldKey || !newKey) return false;
  return oldKey === newKey;
}

function parseRevisionCodeFromFilename(fileName: string): string {
  const match = fileName.match(/_rev(\d+)/i);
  if (!match) return "";
  return `REV${match[1].padStart(2, "0")}`;
}

function parseImportedBy(meta: UnknownRecord): string {
  return (
    asString(meta.importedBy) ||
    asString(meta.imported_by) ||
    asString(asRecord(meta.schedule).importedBy) ||
    asString(asRecord(meta.schedule).imported_by) ||
    "system"
  );
}

function parseComment(meta: UnknownRecord): string {
  return (
    asString(meta.comment) ||
    asString(asRecord(meta.schedule).comment) ||
    asString(meta.notes) ||
    asString(asRecord(meta.schedule).notes) ||
    ""
  );
}

function safeDate(value: unknown, fallback: string): string {
  const iso = toIsoDateOnly(value);
  if (iso) return iso;
  const dt = new Date(asString(value));
  if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  return fallback;
}

function computeMatchKey(wbs: string, taskName: string): string {
  const normalizedWbs = normalizeWbs(wbs);
  const normalizedName = normalizeName(taskName);
  if (!normalizedWbs && !normalizedName) return "";
  if (!normalizedWbs) return `name:${normalizedName}`;
  return `${normalizedWbs}|${normalizedName}`;
}

function normalizeTaskSnapshot(raw: UnknownRecord, index: number): ScheduleTaskSnapshot | null {
  const wbs = asString(raw.wbs || raw.outlineNumber || raw.outline || raw.WBS || raw.OutlineNumber);
  const taskName = asString(raw.taskName || raw.name || raw.TaskName || raw.Name);
  const taskId = asString(raw.taskId || raw.id || raw.uid || raw.UID || raw.ID) || null;
  const activityCode =
    asString(
      raw.activityCode ||
        raw.activity_code ||
        raw.ActivityCode ||
        raw.ac_code ||
        raw.AC ||
        raw.Text1 ||
        raw.text1 ||
        raw.text_1
    ) || null;
  const matchKey = computeMatchKey(wbs, taskName);
  if (!matchKey) return null;

  const predecessorLinks =
    Array.isArray(raw.predecessorLinks) && raw.predecessorLinks.length > 0
      ? (raw.predecessorLinks as unknown[]).map((item) => {
          const rec = asRecord(item);
          return parseLinkToken(
            `${asString(rec.id || rec.uid || rec.raw)}:${normalizeRelationshipType(asString(rec.relationType || rec.type || "FS"))}${
              parseFloatNumber(rec.lagDays) ? `(${parseFloatNumber(rec.lagDays)})` : ""
            }`
          );
        })
      : normalizeLinkList(raw.predecessors);

  const successorLinks =
    Array.isArray(raw.successorLinks) && raw.successorLinks.length > 0
      ? (raw.successorLinks as unknown[]).map((item) => {
          const rec = asRecord(item);
          return parseLinkToken(
            `${asString(rec.id || rec.uid || rec.raw)}:${normalizeRelationshipType(asString(rec.relationType || rec.type || "FS"))}${
              parseFloatNumber(rec.lagDays) ? `(${parseFloatNumber(rec.lagDays)})` : ""
            }`
          );
        })
      : normalizeLinkList(raw.successors);

  const predecessors = predecessorLinks.map((item) => item.raw);
  const successors = successorLinks.map((item) => item.raw);

  const durationDays = parseDurationDays(raw.durationDays ?? raw.duration ?? raw.Duration);
  const remainingDurationDays = parseDurationDays(
    raw.remainingDurationDays ?? raw.remainingDuration ?? raw.RemainingDuration
  );
  const milestone = parseBoolean(raw.milestone ?? raw.Milestone) ?? false;

  return {
    key: `${matchKey}#${taskId || index}`,
    matchKey,
    activityCode,
    wbs,
    taskName,
    taskId,
    oldDisplayId: taskId,
    startDate: toIsoDateOnly(raw.startDate ?? raw.start ?? raw.Start),
    finishDate: toIsoDateOnly(raw.finishDate ?? raw.finish ?? raw.Finish),
    progressPct: parseFloatNumber(raw.progressPct ?? raw.progress ?? raw.percentComplete ?? raw.PercentComplete ?? raw["% complete"] ?? raw["% Complete"]),
    durationDays,
    remainingDurationDays,
    predecessors,
    predecessorLinks,
    successors,
    successorLinks,
    predCount: predecessorLinks.length,
    succCount: successorLinks.length,
    totalFloatDays: parseFloatNumber(raw.totalFloatDays ?? raw.totalFloat ?? raw.TotalFloat ?? raw.TotalSlack),
    critical: parseBoolean(raw.critical ?? raw.Critical),
    cpMember: parseBoolean(raw.cpMember ?? raw.cpMembership ?? raw.critical ?? raw.Critical),
    constraintType: asString(raw.constraintType ?? raw.ConstraintType) || null,
    constraintDate: toIsoDateOnly(raw.constraintDate ?? raw.ConstraintDate),
    calendarName: asString(raw.calendarName ?? raw.calendar ?? raw.Calendar ?? raw.CalendarName) || null,
    milestone: milestone || ((durationDays ?? 0) === 0 && !!taskName),
    discipline: asString(raw.discipline ?? raw.ownerDiscipline ?? raw.ResponsibleDiscipline) || null,
    area: asString(raw.area ?? raw.zone ?? raw.Area ?? raw.Zone) || null,
  };
}

function deriveSuccessorLinks(tasks: ScheduleTaskSnapshot[]): ScheduleTaskSnapshot[] {
  const byTaskId = new Map<string, ScheduleTaskSnapshot>();
  const byMatchKey = new Map<string, ScheduleTaskSnapshot[]>();

  for (const task of tasks) {
    if (task.taskId) byTaskId.set(task.taskId, task);
    const group = byMatchKey.get(task.matchKey) ?? [];
    group.push(task);
    byMatchKey.set(task.matchKey, group);
  }

  const nextTasks = tasks.map((task) => ({
    ...task,
    successorLinks: [...task.successorLinks],
    successors: [...task.successors],
  }));
  const byKey = new Map(nextTasks.map((task) => [task.key, task]));

  for (const task of nextTasks) {
    for (const link of task.predecessorLinks) {
      let sourceTask: ScheduleTaskSnapshot | undefined;
      if (link.id && byTaskId.has(link.id)) {
        sourceTask = byTaskId.get(link.id);
      } else if (link.id && byMatchKey.has(link.id)) {
        sourceTask = byMatchKey.get(link.id)?.[0];
      }
      if (!sourceTask) continue;

      const writable = byKey.get(sourceTask.key);
      if (!writable) continue;
      const newToken = `${task.taskId || task.matchKey}:${link.relationType}${link.lagDays ? `(${link.lagDays})` : ""}`;
      if (!writable.successors.includes(newToken)) {
        writable.successors.push(newToken);
        writable.successorLinks.push({
          raw: newToken,
          id: task.taskId || task.matchKey,
          relationType: link.relationType,
          lagDays: link.lagDays,
        });
      }
    }
  }

  for (const task of nextTasks) {
    task.predCount = task.predecessorLinks.length;
    task.succCount = task.successorLinks.length;
  }

  return nextTasks;
}

function parseTasksFromMeta(meta: unknown): ScheduleTaskSnapshot[] {
  const metaRecord = asRecord(meta);
  const scheduleRecord = asRecord(metaRecord.schedule);
  const rawTasks =
    (Array.isArray(scheduleRecord.tasks) ? scheduleRecord.tasks : null) ??
    (Array.isArray(metaRecord.tasks) ? metaRecord.tasks : null) ??
    [];

  const normalized: ScheduleTaskSnapshot[] = [];
  rawTasks.forEach((item, index) => {
    const task = normalizeTaskSnapshot(asRecord(item), index);
    if (task) normalized.push(task);
  });
  return deriveSuccessorLinks(normalized);
}

function mapStorageEntryToRevision(
  projectCode: string,
  entry: StorageFileEntry,
  rank: number
): ScheduleRevision {
  const fileName = basename(entry.path);
  const parsedDate = parseDateTokenFromFilename(fileName);
  const revisionCode = parseRevisionCodeFromFilename(fileName);
  const type: ScheduleRevisionType = rank === 0 ? "baseline" : "update";
  const fallbackCode = type === "baseline" ? "B01" : `U${String(rank).padStart(2, "0")}`;
  const importedAt = entry.updatedAt || new Date().toISOString();

  return {
    id: toStoragePseudoId(entry.path),
    fileId: null,
    projectCode,
    revisionCode: revisionCode || fallbackCode,
    revisionType: type,
    group: inferScheduleGroupFromFilename(fileName),
    dataDate: parsedDate,
    importedAt,
    importedBy: "storage-sync",
    sourceFileName: fileName,
    sourceFilePath: entry.path,
    sourceKind: sourceKindFromPath(entry.path),
    checksum: null,
    byteSize: entry.size,
    comment: parsedDate ? `Auto-discovered from storage (${parsedDate}).` : "Auto-discovered from storage.",
    hasSnapshot: false,
    taskCount: 0,
    snapshotTasks: [],
  };
}

async function listStorageScheduleFiles(projectCode: string): Promise<StorageFileEntry[]> {
  const sb = supabaseAdmin();
  const root = `${projectCode}/${SCHEDULE_SUBFOLDER}`;
  const queue = [root];
  const files: StorageFileEntry[] = [];

  while (queue.length > 0) {
    const prefix = queue.shift() || "";
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage list failed for ${prefix}: ${error.message}`);
    for (const item of data || []) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      const itemRecord = item as unknown as UnknownRecord;
      if (itemRecord.id) {
        const kind = sourceKindFromPath(fullPath);
        if (kind === "unknown") continue;
        const metadata = asRecord(itemRecord.metadata);
        files.push({
          path: fullPath,
          updatedAt: asString(itemRecord.updated_at) || null,
          size: parseFloatNumber(metadata.size) ?? null,
        });
      } else {
        queue.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getScheduleRevisions(projectCode: string): Promise<ScheduleRevisionListResult> {
  try {
    const sb = supabaseAdmin();
    const { data: project, error: projectError } = await sb
      .from("projects")
      .select("id,code,name")
      .eq("code", projectCode)
      .maybeSingle();

    if (projectError) throw new Error(projectError.message);
    if (!project?.id) throw new Error(`Project not found: ${projectCode}`);

    const { data: fileRows, error: fileError } = await sb
      .from("files")
      .select("id,revision,storage_path,original_filename,checksum_sha256,byte_size,meta,created_at")
      .eq("project_id", project.id)
      .eq("logical_name", SCHEDULE_LOGICAL_NAME)
      .order("created_at", { ascending: true });

    if (fileError) throw new Error(fileError.message);
    const storageFiles = await listStorageScheduleFiles(projectCode);

    const revisionsFromDb: ScheduleRevision[] = (fileRows ?? []).map((row, index) => {
      const meta = asRecord(row.meta);
      const scheduleMeta = asRecord(meta.schedule);
      const sourcePath = asString(row.storage_path);
      const fileName = asString(row.original_filename) || basename(sourcePath);
      const revisionCode =
        asString(scheduleMeta.revisionCode) || asString(meta.revisionCode) || parseRevisionCodeFromFilename(fileName);
      const revisionTypeRaw = asString(scheduleMeta.revisionType) || asString(meta.revisionType);
      const revisionType: ScheduleRevisionType =
        revisionTypeRaw.toLowerCase() === "baseline" || revisionTypeRaw.toLowerCase() === "b"
          ? "baseline"
          : "update";
      const dataDate =
        toIsoDateOnly(scheduleMeta.dataDate ?? meta.dataDate) ||
        parseDateTokenFromFilename(fileName) ||
        toIsoDateOnly(row.created_at);
      const group =
        normalizeScheduleGroup(scheduleMeta.group) ||
        normalizeScheduleGroup(meta.group) ||
        inferScheduleGroupFromFilename(fileName);

      const tasks = parseTasksFromMeta(meta);

      return {
        id: asString(row.id),
        fileId: asString(row.id) || null,
        projectCode,
        revisionCode: revisionCode || `U${String(index + 1).padStart(2, "0")}`,
        revisionType,
        group,
        dataDate,
        importedAt: safeDate(scheduleMeta.importedAt ?? meta.importedAt ?? row.created_at, new Date().toISOString()),
        importedBy: parseImportedBy({ ...meta, ...scheduleMeta }),
        sourceFileName: fileName,
        sourceFilePath: sourcePath,
        sourceKind: sourceKindFromPath(sourcePath),
        checksum: asString(row.checksum_sha256) || null,
        byteSize: parseFloatNumber(row.byte_size) ?? null,
        comment: parseComment({ ...meta, ...scheduleMeta }),
        hasSnapshot: tasks.length > 0,
        taskCount: tasks.length,
        snapshotTasks: tasks,
      };
    });

    const existingPathSet = new Set(revisionsFromDb.map((item) => item.sourceFilePath));
    const storageOnly = storageFiles.filter((item) => !existingPathSet.has(item.path));
    const storageOnlyRevisions = storageOnly.map((entry, index) =>
      mapStorageEntryToRevision(projectCode, entry, revisionsFromDb.length + index)
    );

    const combinedAsc = [...revisionsFromDb, ...storageOnlyRevisions].sort(
      (a, b) => revisionSortTimestamp(a) - revisionSortTimestamp(b)
    );

    let updateCounter = 1;
    combinedAsc.forEach((revision, index) => {
      if (index === 0) {
        revision.revisionType = "baseline";
        if (!/^B\d+/i.test(revision.revisionCode)) revision.revisionCode = "B01";
        return;
      }

      revision.revisionType = "update";
      if (!/^U\d+/i.test(revision.revisionCode)) {
        revision.revisionCode = `U${String(updateCounter).padStart(2, "0")}`;
      }
      updateCounter += 1;
    });

    const revisionsDesc = [...combinedAsc].sort((a, b) => revisionSortTimestamp(b) - revisionSortTimestamp(a));
    const groupStatus = buildGroupStatus(revisionsDesc);
    const latestMpp = revisionsDesc.find((item) => item.sourceKind === "mpp");
    const latestCutoffDate = parseDateTokenFromFilename(latestMpp?.sourceFileName || "") || toIsoDateOnly(latestMpp?.importedAt) || "";

    return {
      projectCode,
      projectName: asString(project.name) || projectCode,
      revisions: revisionsDesc,
      groupStatus,
      canAssembleMergedSchedule: groupStatus.every((item) => item.ready),
      latestMsProjectPath: latestMpp?.sourceFilePath || null,
      latestCutoffDate,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return buildOfflineFallback(projectCode, reason);
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function xmlTag(block: string, tag: string): string {
  const matcher = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const result = block.match(matcher);
  return result ? decodeXmlEntities(result[1]).trim() : "";
}

function xmlBlocks(block: string, tag: string): string[] {
  return Array.from(block.matchAll(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "gi"))).map((item) => item[0]);
}

function parseXmlTaskLinks(taskBlock: string, tag: "PredecessorLink" | "SuccessorLink"): ScheduleLink[] {
  return xmlBlocks(taskBlock, tag)
    .map((linkBlock) => {
      const predecessorUid = xmlTag(linkBlock, "PredecessorUID") || xmlTag(linkBlock, "SuccessorUID") || xmlTag(linkBlock, "UID");
      const relationType = normalizeRelationshipType(xmlTag(linkBlock, "Type") || "FS");
      const lagDays = parseDurationDays(xmlTag(linkBlock, "LinkLag") || xmlTag(linkBlock, "Lag") || "0") ?? 0;
      const token = `${predecessorUid}:${relationType}${lagDays ? `(${lagDays})` : ""}`;
      return predecessorUid ? { raw: token, id: predecessorUid, relationType, lagDays } : null;
    })
    .filter(Boolean) as ScheduleLink[];
}

function parseScheduleXml(buffer: Buffer): ScheduleTaskSnapshot[] {
  const xml = buffer.toString("utf-8");
  const taskBlocks = Array.from(xml.matchAll(/<Task>[\s\S]*?<\/Task>/gi)).map((match) => match[0]);

  const tasks: ScheduleTaskSnapshot[] = [];
  taskBlocks.forEach((taskBlock, index) => {
    const taskName = xmlTag(taskBlock, "Name");
    const wbs = xmlTag(taskBlock, "OutlineNumber") || xmlTag(taskBlock, "WBS");
    const taskId = xmlTag(taskBlock, "UID") || xmlTag(taskBlock, "ID");
    const milestone = parseBoolean(xmlTag(taskBlock, "Milestone")) ?? false;
    if (!taskName && !wbs) return;

    const predecessorLinks = parseXmlTaskLinks(taskBlock, "PredecessorLink");
    const successorLinks = parseXmlTaskLinks(taskBlock, "SuccessorLink");
    const critical = parseBoolean(xmlTag(taskBlock, "Critical"));
    const cpMember = parseBoolean(xmlTag(taskBlock, "Critical")) ?? critical;
    const durationDays = parseDurationDays(xmlTag(taskBlock, "Duration"));
    const remainingDurationDays = parseDurationDays(xmlTag(taskBlock, "RemainingDuration"));
    const totalFloatDays =
      parseDurationDays(xmlTag(taskBlock, "TotalSlack")) ??
      parseFloatNumber(xmlTag(taskBlock, "FreeSlack")) ??
      parseFloatNumber(xmlTag(taskBlock, "TotalFloat"));

    const task = normalizeTaskSnapshot(
      {
        wbs,
        taskName,
        taskId,
        startDate: xmlTag(taskBlock, "Start"),
        finishDate: xmlTag(taskBlock, "Finish"),
        durationDays,
        remainingDurationDays,
        predecessors: predecessorLinks.map((item) => item.raw),
        predecessorLinks,
        successors: successorLinks.map((item) => item.raw),
        successorLinks,
        totalFloatDays,
        critical,
        cpMember,
        constraintType: xmlTag(taskBlock, "ConstraintType"),
        constraintDate: xmlTag(taskBlock, "ConstraintDate"),
        calendarName: xmlTag(taskBlock, "CalendarUID"),
        milestone,
      },
      index
    );

    if (task) tasks.push(task);
  });

  return deriveSuccessorLinks(tasks);
}

function toIsoDateFromDotted(value: string): string | null {
  const text = asString(value);
  if (!text) return null;
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
  if (!match) return toIsoDateOnly(text);

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearToken = match[3];
  const year = yearToken.length === 2 ? (Number(yearToken) >= 90 ? 1900 + Number(yearToken) : 2000 + Number(yearToken)) : Number(yearToken);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isMppNoiseToken(token: string): boolean {
  const clean = token.replace(/[^A-Za-zА-Яа-я0-9]/g, "");
  if (!clean) return true;
  if (clean.length === 1) return true;
  return clean.length === 2 && /^[A-Z0-9]{2}$/.test(clean);
}

function cleanupMppTaskName(raw: string): { taskName: string; wbs: string } {
  let text = raw
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();

  text = text.replace(/^(?:\d{2}\.\d{2}\.\d{2}\s+){2,}/u, "");
  text = text.replace(/^\d+(?:[.,]\d+)?\s*(?:d|д|дн(?:ей|я)?|days?)\s+\d{2}\.\d{2}\.\d{2}\s+\d{2}\.\d{2}\.\d{2}\s+/iu, "");
  text = text.replace(/^\d{2}\.\d{2}\.\d{2}\s+\d{2}\.\d{2}\.\d{2}\s+/u, "");
  text = text.replace(/\b(?:Пн|Вт|Ср|Чт|Пт|Сб|Вс|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b\s+\d{2}\.\d{2}\.\d{2}\b.*$/iu, "");
  text = text.replace(/\b(?:Proje|proje)\s+Yok\b/giu, " ");
  text = text.replace(/\b(?:Kontrolde|kontrolde)\b/giu, " ");
  text = text.replace(/\b(?:Tarih|tarih)\s+yok\b/giu, " ");
  text = text.replace(/\bНе\s+входит\s+в\s+объем.*$/iu, "");
  text = text.replace(/\bотв\.?\s*Заказчик\b/giu, " ");
  text = text.replace(/\b\d+\s*(?:передан(?:а|о)?\s+на\s+согласование|отработка\s+по\s+замечаниям)\b.*$/iu, "");
  text = text.replace(/\b(?:передан(?:а|о)?\s+на\s+согласование|отработка\s+по\s+замечаниям)\b.*$/iu, "");
  text = text.replace(/\s+/g, " ").trim();

  const tokens = text.split(" ").filter(Boolean);
  let leftNoise = 0;
  while (leftNoise < tokens.length && isMppNoiseToken(tokens[leftNoise])) leftNoise += 1;
  if (leftNoise >= 2) {
    tokens.splice(0, leftNoise);
  } else if (leftNoise === 1 && tokens[0].replace(/[^A-Za-zА-Яа-я0-9]/g, "").length <= 1) {
    tokens.shift();
  }

  let rightNoise = 0;
  while (rightNoise < tokens.length && isMppNoiseToken(tokens[tokens.length - 1 - rightNoise])) rightNoise += 1;
  if (rightNoise >= 2) {
    tokens.splice(tokens.length - rightNoise, rightNoise);
  } else if (
    rightNoise === 1 &&
    tokens[tokens.length - 1] &&
    tokens[tokens.length - 1].replace(/[^A-Za-zА-Яа-я0-9]/g, "").length <= 1
  ) {
    tokens.pop();
  }

  text = tokens.join(" ").replace(/\s+/g, " ").trim();
  text = text.replace(/^[\-–—:;,.]+|[\-–—:;,.]+$/g, "").trim();

  let wbs = "";
  const exactTail = text.match(/\b(\d+(?:\.\d+){1,8})$/);
  if (exactTail && exactTail.index !== undefined) {
    wbs = exactTail[1];
    text = text.slice(0, exactTail.index).trim();
  } else {
    const candidates = Array.from(text.matchAll(/\b(\d+(?:\.\d+){2,8})\b/g));
    const last = candidates[candidates.length - 1];
    if (last && last.index !== undefined && text.length - last.index <= 18) {
      wbs = last[1];
      text = `${text.slice(0, last.index)}${text.slice(last.index + last[0].length)}`.replace(/\s+/g, " ").trim();
    }
  }

  return { taskName: text, wbs };
}

function extractMppPredecessorLinks(raw: string): ScheduleLink[] {
  const links: ScheduleLink[] = [];
  const seen = new Set<string>();

  const add = (id: string, relationType: string, lagDays: number) => {
    const safeId = asString(id);
    if (!safeId) return;
    const key = `${safeId}|${relationType}|${lagDays}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({
      id: safeId,
      relationType,
      lagDays,
      raw: `${safeId}:${relationType}${lagDays ? `(${lagDays})` : ""}`,
    });
  };

  for (const match of raw.matchAll(/(\d{1,6})\s*(FS|SS|FF|SF)\s*([+-]\s*\d+(?:[.,]\d+)?)?\s*(?:d|д|дн(?:ей|я)?|days?)?/giu)) {
    const id = asString(match[1]);
    const relationType = normalizeRelationshipType(asString(match[2]) || "FS");
    const lagToken = asString(match[3]).replace(/\s+/g, "");
    const lagDays = lagToken ? Number(lagToken.replace(",", ".")) : 0;
    add(id, relationType, Number.isFinite(lagDays) ? lagDays : 0);
  }

  for (const match of raw.matchAll(/\b(\d{2,6})(?=;)/g)) {
    add(asString(match[1]), "FS", 0);
  }

  return links;
}

function parseScheduleMpp(buffer: Buffer): { tasks: ScheduleTaskSnapshot[]; warnings: string[] } {
  const decoded = buffer.toString("utf16le");
  const normalizedText = decoded
    .replace(/[^\u0009\u000A\u000D\u0020-\u024F\u0400-\u04FF]/g, " ")
    .replace(/\s+/g, " ");

  const rowPattern =
    /([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9()\/,+«»"'’\-\u2013\u2014.\s]{6,320}?)\s+(\d{1,3})%\s+(\d{1,4}(?:[.,]\d+)?\s*(?:d|д|дн(?:ей|я)?|days?))\??\s+(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})/giu;

  const deduped = new Map<string, ScheduleTaskSnapshot>();
  let index = 0;

  for (const match of normalizedText.matchAll(rowPattern)) {
    const rawName = asString(match[1]);
    const progressPct = parseFloatNumber(match[2]) ?? null;
    const durationToken = asString(match[3]);
    const startDate = toIsoDateFromDotted(asString(match[4]));
    const finishDate = toIsoDateFromDotted(asString(match[5]));
    const { taskName, wbs } = cleanupMppTaskName(rawName);

    if (!taskName || taskName.length < 4) continue;
    if (/^(?:root entry|tbknd|var2data|fixed(?:2)?(?:data|meta))/i.test(taskName)) continue;
    if (/^\d{2,6}(?:\s*;\s*\d{2,6})+$/u.test(taskName)) continue;
    if (/^\d{2,6}\s*(?:FS|SS|FF|SF)(?:\s*[-+]\s*\d+(?:[.,]\d+)?)?$/iu.test(taskName)) continue;
    if (!startDate || !finishDate) continue;

    const predecessorLinks = extractMppPredecessorLinks(rawName);
    const task = normalizeTaskSnapshot(
      {
        wbs,
        taskName,
        taskId: null,
        startDate,
        finishDate,
        durationDays: durationToken,
        remainingDurationDays: durationToken,
        predecessors: predecessorLinks.map((item) => item.raw),
        predecessorLinks,
        successors: [],
        successorLinks: [],
        totalFloatDays: null,
        critical: null,
        cpMember: null,
        constraintType: null,
        constraintDate: null,
        calendarName: null,
        milestone: (parseDurationDays(durationToken) ?? 0) === 0,
        discipline: null,
        area: null,
        progressPct,
      },
      index
    );
    if (!task) continue;

    const dedupeKey = `${task.matchKey}|${task.startDate || ""}|${task.finishDate || ""}|${task.durationDays ?? ""}`;
    const existing = deduped.get(dedupeKey);
    if (existing) {
      const mergedPred = [...existing.predecessorLinks];
      for (const link of task.predecessorLinks) {
        if (mergedPred.some((item) => item.id === link.id && item.relationType === link.relationType && item.lagDays === link.lagDays)) {
          continue;
        }
        mergedPred.push(link);
      }
      existing.predecessorLinks = mergedPred;
      existing.predecessors = mergedPred.map((item) => item.raw);
      existing.predCount = mergedPred.length;
      existing.milestone = existing.milestone || task.milestone;
      continue;
    }

    deduped.set(dedupeKey, task);
    index += 1;
  }

  const tasks = deriveSuccessorLinks(Array.from(deduped.values()));
  const warnings: string[] = [];
  if (tasks.length === 0) {
    warnings.push("Unable to extract tasks from MS Project binary. Import MSP XML/Excel for full fidelity.");
  } else {
    warnings.push(
      "MS Project binary parsed in heuristic mode (dates/duration/tasks extracted). For full logic/float fidelity, import MSP XML."
    );
  }
  return { tasks, warnings };
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (char === delimiter && !inQuote) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function mapColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  headers.forEach((header, index) => {
    const key = header.toLowerCase();
    if (
      !mapping.activityCode &&
      (key.includes("activity code") ||
        key === "activity" ||
        key === "ac" ||
        key === "text1" ||
        key.includes("код операции") ||
        key.includes("код работ"))
    )
      mapping.activityCode = index;
    if (!mapping.wbs && (key.includes("wbs") || key.includes("outline"))) mapping.wbs = index;
    if (!mapping.taskName && (key.includes("task name") || key === "name")) mapping.taskName = index;
    if (!mapping.taskId && (key === "id" || key === "uid" || key.includes("task id"))) mapping.taskId = index;
    if (!mapping.start && key.includes("start")) mapping.start = index;
    if (!mapping.finish && key.includes("finish")) mapping.finish = index;
    if (
      !mapping.progress &&
      (key.includes("progress") || key.includes("% complete") || key.includes("percent complete") || key.includes("physical %"))
    )
      mapping.progress = index;
    if (!mapping.duration && key.includes("duration") && !key.includes("remaining")) mapping.duration = index;
    if (!mapping.remaining && key.includes("remaining")) mapping.remaining = index;
    if (!mapping.predecessors && key.includes("predecess")) mapping.predecessors = index;
    if (!mapping.successors && key.includes("success")) mapping.successors = index;
    if (!mapping.float && (key.includes("float") || key.includes("slack"))) mapping.float = index;
    if (!mapping.critical && key.includes("critical")) mapping.critical = index;
    if (!mapping.constraintType && key.includes("constraint type")) mapping.constraintType = index;
    if (!mapping.constraintDate && key.includes("constraint date")) mapping.constraintDate = index;
    if (!mapping.calendar && key.includes("calendar")) mapping.calendar = index;
    if (!mapping.milestone && key.includes("milestone")) mapping.milestone = index;
    if (!mapping.discipline && (key.includes("discipline") || key.includes("responsible"))) mapping.discipline = index;
    if (!mapping.area && (key.includes("area") || key.includes("zone"))) mapping.area = index;
  });
  return mapping;
}

function parseScheduleCsv(buffer: Buffer): ScheduleTaskSnapshot[] {
  const text = buffer.toString("utf-8");
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (rows.length === 0) return [];

  const delimiters = [",", ";", "\t"];
  const delimiter = delimiters
    .map((item) => ({ delimiter: item, count: rows[0].split(item).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter;
  if (!delimiter) return [];

  const header = parseCsvRow(rows[0], delimiter);
  const columns = mapColumns(header);

  const tasks: ScheduleTaskSnapshot[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = parseCsvRow(rows[i], delimiter);
    const task = normalizeTaskSnapshot(
      {
        wbs: cells[columns.wbs],
        activityCode: cells[columns.activityCode],
        taskName: cells[columns.taskName],
        taskId: cells[columns.taskId],
        startDate: cells[columns.start],
        finishDate: cells[columns.finish],
        progressPct: cells[columns.progress],
        durationDays: cells[columns.duration],
        remainingDurationDays: cells[columns.remaining],
        predecessors: cells[columns.predecessors],
        successors: cells[columns.successors],
        totalFloatDays: cells[columns.float],
        critical: cells[columns.critical],
        constraintType: cells[columns.constraintType],
        constraintDate: cells[columns.constraintDate],
        calendarName: cells[columns.calendar],
        milestone: cells[columns.milestone],
        discipline: cells[columns.discipline],
        area: cells[columns.area],
      },
      i
    );
    if (task) tasks.push(task);
  }
  return deriveSuccessorLinks(tasks);
}

function detectHeaderRow(rows: ExcelJS.Row[]): number {
  const maxScan = Math.min(rows.length, 40);
  for (let i = 0; i < maxScan; i += 1) {
    const values = rows[i].values;
    if (!Array.isArray(values)) continue;
    const cells = values.map((item) => asString(item).toLowerCase());
    const hasName = cells.some((value) => value.includes("task name") || value === "name");
    const hasWbs = cells.some((value) => value.includes("wbs") || value.includes("outline"));
    if (hasName || hasWbs) return i;
  }
  return 0;
}

async function parseScheduleExcel(buffer: Buffer): Promise<ScheduleTaskSnapshot[]> {
  const workbook = new ExcelJS.Workbook();
  type WorkbookLoadInput = Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(buffer as unknown as WorkbookLoadInput);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const allRows = worksheet.getRows(1, worksheet.rowCount) ?? [];
  if (allRows.length === 0) return [];
  const headerIndex = detectHeaderRow(allRows);
  const headerValues = (allRows[headerIndex].values as unknown[]) || [];
  const header = headerValues.map((item) => asString(item));
  const columns = mapColumns(header);

  const tasks: ScheduleTaskSnapshot[] = [];
  let blankCounter = 0;

  for (let i = headerIndex + 1; i < allRows.length; i += 1) {
    const row = allRows[i];
    const read = (column: number | undefined) => {
      if (column === undefined) return "";
      return row.getCell(column).value;
    };

    const taskName = asString(read(columns.taskName !== undefined ? columns.taskName + 1 : undefined));
    const wbs = asString(read(columns.wbs !== undefined ? columns.wbs + 1 : undefined));
    if (!taskName && !wbs) {
      blankCounter += 1;
      if (blankCounter >= 30) break;
      continue;
    }
    blankCounter = 0;

    const task = normalizeTaskSnapshot(
      {
        wbs,
        activityCode: read(columns.activityCode !== undefined ? columns.activityCode + 1 : undefined),
        taskName,
        taskId: read(columns.taskId !== undefined ? columns.taskId + 1 : undefined),
        startDate: read(columns.start !== undefined ? columns.start + 1 : undefined),
        finishDate: read(columns.finish !== undefined ? columns.finish + 1 : undefined),
        progressPct: read(columns.progress !== undefined ? columns.progress + 1 : undefined),
        durationDays: read(columns.duration !== undefined ? columns.duration + 1 : undefined),
        remainingDurationDays: read(columns.remaining !== undefined ? columns.remaining + 1 : undefined),
        predecessors: read(columns.predecessors !== undefined ? columns.predecessors + 1 : undefined),
        successors: read(columns.successors !== undefined ? columns.successors + 1 : undefined),
        totalFloatDays: read(columns.float !== undefined ? columns.float + 1 : undefined),
        critical: read(columns.critical !== undefined ? columns.critical + 1 : undefined),
        constraintType: read(columns.constraintType !== undefined ? columns.constraintType + 1 : undefined),
        constraintDate: read(columns.constraintDate !== undefined ? columns.constraintDate + 1 : undefined),
        calendarName: read(columns.calendar !== undefined ? columns.calendar + 1 : undefined),
        milestone: read(columns.milestone !== undefined ? columns.milestone + 1 : undefined),
        discipline: read(columns.discipline !== undefined ? columns.discipline + 1 : undefined),
        area: read(columns.area !== undefined ? columns.area + 1 : undefined),
      },
      i
    );
    if (task) tasks.push(task);
  }

  return deriveSuccessorLinks(tasks);
}

export async function parseScheduleFile(
  fileName: string,
  buffer: Buffer
): Promise<{ tasks: ScheduleTaskSnapshot[]; warnings: string[]; sourceKind: ScheduleSourceKind }> {
  const extension = extensionFromPath(fileName);
  if (extension === "mpp") {
    const parsed = parseScheduleMpp(buffer);
    return {
      tasks: parsed.tasks,
      warnings: parsed.warnings,
      sourceKind: "mpp",
    };
  }
  if (extension === "xml") {
    return { tasks: parseScheduleXml(buffer), warnings: [], sourceKind: "xml" };
  }
  if (["xlsx", "xls", "xlsm"].includes(extension)) {
    return { tasks: await parseScheduleExcel(buffer), warnings: [], sourceKind: "xlsx" };
  }
  if (extension === "csv") {
    return { tasks: parseScheduleCsv(buffer), warnings: [], sourceKind: "csv" };
  }

  return {
    tasks: [],
    warnings: [`Unsupported schedule extension: .${extension || "unknown"}`],
    sourceKind: "unknown",
  };
}

function setDifference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((item) => !rightSet.has(item))));
}

function resolveWbsDriver(wbs: string): string {
  if (!wbs) return "Unassigned";
  const parts = wbs.split(".");
  return parts.slice(0, 3).join(".");
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

type LinkReferenceMaps = {
  oldRefToCanonical: Map<string, string>;
  newRefToCanonical: Map<string, string>;
};

type CanonicalLink = {
  target: string;
  relationType: string;
  lagDays: number;
  token: string;
};

function normalizeReferenceId(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeWbsForCompare(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");
}

function buildCanonicalTaskKey(oldTask: ScheduleTaskSnapshot | null, newTask: ScheduleTaskSnapshot | null): string {
  const ac = normalizeReferenceId(newTask?.activityCode || oldTask?.activityCode || "");
  if (ac) return `ac:${ac}`;

  const name = normalizeMatchText(newTask?.taskName || oldTask?.taskName || "");
  const discipline = normalizeMatchText(newTask?.discipline || oldTask?.discipline || "");
  const area = normalizeMatchText(newTask?.area || oldTask?.area || "");
  const bucket = [discipline, area].filter(Boolean).join("|");
  if (name) return `name:${bucket ? `${bucket}|` : ""}${name}`;

  const fallback = normalizeReferenceId(newTask?.key || oldTask?.key || "");
  return `key:${fallback || "na"}`;
}

function buildLinkReferenceMaps(pairs: Array<{ oldTask: ScheduleTaskSnapshot | null; newTask: ScheduleTaskSnapshot | null }>): LinkReferenceMaps {
  const oldRefToCanonical = new Map<string, string>();
  const newRefToCanonical = new Map<string, string>();

  const register = (map: Map<string, string>, ref: string | null | undefined, canonical: string) => {
    const token = normalizeReferenceId(ref);
    if (!token) return;
    if (!map.has(token)) map.set(token, canonical);
  };

  for (const pair of pairs) {
    const canonical = buildCanonicalTaskKey(pair.oldTask, pair.newTask);
    if (pair.oldTask) {
      register(oldRefToCanonical, pair.oldTask.taskId, canonical);
      register(oldRefToCanonical, pair.oldTask.activityCode, canonical);
      register(oldRefToCanonical, pair.oldTask.matchKey, canonical);
      register(oldRefToCanonical, pair.oldTask.key, canonical);
      register(oldRefToCanonical, pair.oldTask.taskName, canonical);
    }
    if (pair.newTask) {
      register(newRefToCanonical, pair.newTask.taskId, canonical);
      register(newRefToCanonical, pair.newTask.activityCode, canonical);
      register(newRefToCanonical, pair.newTask.matchKey, canonical);
      register(newRefToCanonical, pair.newTask.key, canonical);
      register(newRefToCanonical, pair.newTask.taskName, canonical);
    }
  }

  return { oldRefToCanonical, newRefToCanonical };
}

function canonicalizeLinks(links: ScheduleLink[], refMap: Map<string, string>): CanonicalLink[] {
  const out: CanonicalLink[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const rawRef = normalizeReferenceId(link.id);
    if (!rawRef) continue;

    let canonicalTarget = refMap.get(rawRef) || "";
    if (!canonicalTarget) {
      if (/^\d+$/.test(rawRef)) continue;
      const normalizedName = normalizeMatchText(rawRef);
      if (!normalizedName) continue;
      canonicalTarget = `name:${normalizedName}`;
    }

    const relationType = normalizeRelationshipType(link.relationType || "FS");
    const lagDays = Number.isFinite(link.lagDays) ? Number(link.lagDays) : 0;
    const token = `${canonicalTarget}|${relationType}|${lagDays}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ target: canonicalTarget, relationType, lagDays, token });
  }

  out.sort((a, b) => a.token.localeCompare(b.token));
  return out;
}

function compareCanonicalLinkMetadata(
  oldLinks: CanonicalLink[],
  newLinks: CanonicalLink[]
): { relationshipTypeChanged: boolean; lagChanged: boolean } {
  const oldByTarget = new Map(oldLinks.map((item) => [item.target, item]));
  const newByTarget = new Map(newLinks.map((item) => [item.target, item]));
  const allTargets = new Set([...oldByTarget.keys(), ...newByTarget.keys()]);

  let relationshipTypeChanged = false;
  let lagChanged = false;
  for (const target of allTargets) {
    const oldLink = oldByTarget.get(target);
    const newLink = newByTarget.get(target);
    if (!oldLink || !newLink) continue;
    if (oldLink.relationType !== newLink.relationType) relationshipTypeChanged = true;
    if (oldLink.lagDays !== newLink.lagDays) lagChanged = true;
  }

  return { relationshipTypeChanged, lagChanged };
}

function severityFromRow(row: Omit<ScheduleCompareRow, "severityScore">): number {
  let severity = 0;
  if (row.changeType === "ADDED" || row.changeType === "REMOVED") severity += 4;
  if (row.changeType === "WBS_MOVED" || row.changeType === "RENAMED") severity += 2;
  if (row.changeType === "LOGIC_CHANGE") severity += 3;
  if (row.changeType === "CONSTRAINT_CHANGE" || row.changeType === "CALENDAR_CHANGE") severity += 2;
  if (row.finishShiftDays && Math.abs(row.finishShiftDays) > 0) severity += Math.min(6, Math.ceil(Math.abs(row.finishShiftDays) / 3));
  if (row.startShiftDays && Math.abs(row.startShiftDays) > 0) severity += Math.min(4, Math.ceil(Math.abs(row.startShiftDays) / 4));
  if (row.criticalPathImpacted) severity += 5;
  if (row.deltaFloat !== null && row.deltaFloat < 0) severity += Math.min(5, Math.ceil(Math.abs(row.deltaFloat) / 2));
  if (row.logicChanged) severity += 3;
  if (row.constraintsChanged) severity += 2;
  if (row.calendarChanged) severity += 2;
  if (row.milestoneMoved) severity += 2;
  return Math.max(1, severity);
}

function humanizeChangeType(value: ScheduleChangeType): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function emptyTaskLike(source: ScheduleTaskSnapshot | null): ScheduleTaskSnapshot {
  return {
    key: source?.key || "empty",
    matchKey: source?.matchKey || "",
    activityCode: source?.activityCode || null,
    wbs: source?.wbs || "",
    taskName: source?.taskName || "",
    taskId: null,
    oldDisplayId: null,
    startDate: null,
    finishDate: null,
    progressPct: null,
    durationDays: null,
    remainingDurationDays: null,
    predecessors: [],
    predecessorLinks: [],
    successors: [],
    successorLinks: [],
    predCount: 0,
    succCount: 0,
    totalFloatDays: null,
    critical: null,
    cpMember: null,
    constraintType: null,
    constraintDate: null,
    calendarName: null,
    milestone: false,
    discipline: null,
    area: null,
  };
}

function compareTaskPair(
  oldTaskInput: ScheduleTaskSnapshot | null,
  newTaskInput: ScheduleTaskSnapshot | null,
  meta: { matchConfidence: number; matchMethod: MatchMethod },
  refs: LinkReferenceMaps
): ScheduleCompareRow {
  const oldTask = oldTaskInput ?? emptyTaskLike(newTaskInput);
  const newTask = newTaskInput ?? emptyTaskLike(oldTaskInput);

  const oldIdentity =
    oldTaskInput?.key ||
    `${oldTask.taskId || "old-na"}|${oldTask.startDate || "old-start-na"}|${oldTask.finishDate || "old-finish-na"}|${oldTask.durationDays ?? "old-duration-na"}`;
  const newIdentity =
    newTaskInput?.key ||
    `${newTask.taskId || "new-na"}|${newTask.startDate || "new-start-na"}|${newTask.finishDate || "new-finish-na"}|${newTask.durationDays ?? "new-duration-na"}`;

  const oldPredCanonical = canonicalizeLinks(oldTask.predecessorLinks, refs.oldRefToCanonical);
  const newPredCanonical = canonicalizeLinks(newTask.predecessorLinks, refs.newRefToCanonical);
  const oldSuccCanonical = canonicalizeLinks(oldTask.successorLinks, refs.oldRefToCanonical);
  const newSuccCanonical = canonicalizeLinks(newTask.successorLinks, refs.newRefToCanonical);

  const predecessorsAdded = setDifference(
    newPredCanonical.map((item) => item.token),
    oldPredCanonical.map((item) => item.token)
  );
  const predecessorsRemoved = setDifference(
    oldPredCanonical.map((item) => item.token),
    newPredCanonical.map((item) => item.token)
  );
  const successorsAdded = setDifference(
    newSuccCanonical.map((item) => item.token),
    oldSuccCanonical.map((item) => item.token)
  );
  const successorsRemoved = setDifference(
    oldSuccCanonical.map((item) => item.token),
    newSuccCanonical.map((item) => item.token)
  );

  const predLinkDiff = compareCanonicalLinkMetadata(oldPredCanonical, newPredCanonical);
  const succLinkDiff = compareCanonicalLinkMetadata(oldSuccCanonical, newSuccCanonical);
  const logicChanged =
    predecessorsAdded.length > 0 ||
    predecessorsRemoved.length > 0 ||
    successorsAdded.length > 0 ||
    successorsRemoved.length > 0 ||
    predLinkDiff.relationshipTypeChanged ||
    predLinkDiff.lagChanged ||
    succLinkDiff.relationshipTypeChanged ||
    succLinkDiff.lagChanged ||
    oldTask.predCount !== newTask.predCount ||
    oldTask.succCount !== newTask.succCount;

  const startShiftDays = daysBetween(oldTask.startDate, newTask.startDate);
  const finishShiftDays = daysBetween(oldTask.finishDate, newTask.finishDate);
  const floatDelta =
    oldTask.totalFloatDays !== null && newTask.totalFloatDays !== null ? Number((newTask.totalFloatDays - oldTask.totalFloatDays).toFixed(3)) : null;
  const durationDelta =
    oldTask.durationDays !== null && newTask.durationDays !== null ? Number((newTask.durationDays - oldTask.durationDays).toFixed(3)) : null;
  const progressDelta =
    oldTask.progressPct !== null && newTask.progressPct !== null ? Number((newTask.progressPct - oldTask.progressPct).toFixed(3)) : null;

  const criticalPathImpacted =
    oldTask.critical !== newTask.critical ||
    oldTask.cpMember !== newTask.cpMember ||
    (oldTask.critical ?? false) !== (newTask.critical ?? false);
  const constraintsChanged =
    (oldTask.constraintType || "") !== (newTask.constraintType || "") ||
    (oldTask.constraintDate || "") !== (newTask.constraintDate || "");
  const calendarChanged = (oldTask.calendarName || "") !== (newTask.calendarName || "");
  const milestoneMoved = (oldTask.milestone || newTask.milestone) && (finishShiftDays ?? 0) !== 0;
  const renamed = normalizeMatchText(oldTask.taskName || "") !== normalizeMatchText(newTask.taskName || "");
  const wbsMoved = normalizeWbsForCompare(oldTask.wbs || "") !== normalizeWbsForCompare(newTask.wbs || "");
  const dateShifted = (startShiftDays ?? 0) !== 0 || (finishShiftDays ?? 0) !== 0;
  const durationChanged = oldTask.durationDays !== newTask.durationDays;
  const progressChanged = oldTask.progressPct !== newTask.progressPct;

  const changeType = classifyScheduleChangeType({
    isAdded: !oldTaskInput,
    isRemoved: !newTaskInput,
    renamed,
    wbsMoved,
    dateShifted,
    durationChanged,
    progressChanged,
    logicChanged,
    constraintChanged: constraintsChanged,
    calendarChanged,
  });

  const changeFlags: string[] = [];
  if (renamed) changeFlags.push("RENAMED");
  if (wbsMoved) changeFlags.push("WBS_MOVED");
  if (dateShifted) changeFlags.push("DATE_SHIFT");
  if (durationChanged) changeFlags.push("DURATION");
  if ((oldTaskInput?.remainingDurationDays ?? null) !== (newTaskInput?.remainingDurationDays ?? null)) changeFlags.push("REMAINING");
  if (logicChanged) changeFlags.push("LOGIC");
  if ((floatDelta ?? 0) !== 0) changeFlags.push("FLOAT");
  if ((oldTaskInput?.critical ?? null) !== (newTaskInput?.critical ?? null)) changeFlags.push("CRITICAL");
  if (constraintsChanged) changeFlags.push("CONSTRAINT");
  if (calendarChanged) changeFlags.push("CALENDAR");
  if (progressChanged) changeFlags.push("PROGRESS");

  const diffParts: string[] = [];
  if ((finishShiftDays ?? 0) !== 0) diffParts.push(`Finish ${finishShiftDays! > 0 ? "+" : ""}${finishShiftDays}d`);
  if ((startShiftDays ?? 0) !== 0) diffParts.push(`Start ${startShiftDays! > 0 ? "+" : ""}${startShiftDays}d`);
  if ((floatDelta ?? 0) !== 0) diffParts.push(`Float ${floatDelta! > 0 ? "+" : ""}${floatDelta}d`);
  if (logicChanged) diffParts.push(`Logic +${predecessorsAdded.length}/-${predecessorsRemoved.length}`);
  const diffSummary = diffParts.join(", ") || "No material delta";
  const impactDays = finishShiftDays ?? startShiftDays ?? null;

  const baseRow: Omit<ScheduleCompareRow, "severityScore"> = {
    rowId: `${newTask.matchKey || oldTask.matchKey || "row"}|${oldIdentity}|${newIdentity}`,
    stableKey: newTask.activityCode || oldTask.activityCode || newTask.matchKey || oldTask.matchKey || newTask.key || oldTask.key,
    activityCode: newTask.activityCode || oldTask.activityCode || null,
    matchConfidence: meta.matchConfidence,
    matchMethod: meta.matchMethod,
    wbs: newTask.wbs || oldTask.wbs,
    oldWbs: oldTaskInput?.wbs ?? null,
    newWbs: newTaskInput?.wbs ?? null,
    taskName: newTask.taskName || oldTask.taskName,
    oldTaskName: oldTaskInput?.taskName ?? null,
    newTaskName: newTaskInput?.taskName ?? null,
    oldId: oldTaskInput?.taskId ?? null,
    newId: newTaskInput?.taskId ?? null,
    oldStart: oldTaskInput?.startDate ?? null,
    newStart: newTaskInput?.startDate ?? null,
    deltaStartDays: startShiftDays,
    startShiftDays,
    oldFinish: oldTaskInput?.finishDate ?? null,
    newFinish: newTaskInput?.finishDate ?? null,
    deltaFinishDays: finishShiftDays,
    finishShiftDays,
    progressOld: oldTaskInput?.progressPct ?? null,
    progressNew: newTaskInput?.progressPct ?? null,
    deltaProgress: progressDelta,
    durationOld: oldTaskInput?.durationDays ?? null,
    durationNew: newTaskInput?.durationDays ?? null,
    deltaDuration: durationDelta,
    remainingDurationOld: oldTaskInput?.remainingDurationDays ?? null,
    remainingDurationNew: newTaskInput?.remainingDurationDays ?? null,
    predCountOld: oldTaskInput?.predCount ?? 0,
    predCountNew: newTaskInput?.predCount ?? 0,
    succCountOld: oldTaskInput?.succCount ?? 0,
    succCountNew: newTaskInput?.succCount ?? 0,
    predecessorsOld: oldTaskInput?.predecessors ?? [],
    predecessorsNew: newTaskInput?.predecessors ?? [],
    successorsOld: oldTaskInput?.successors ?? [],
    successorsNew: newTaskInput?.successors ?? [],
    logicChanged,
    predecessorsAdded,
    predecessorsRemoved,
    successorsAdded,
    successorsRemoved,
    relationshipTypeChanged: predLinkDiff.relationshipTypeChanged || succLinkDiff.relationshipTypeChanged,
    lagChanged: predLinkDiff.lagChanged || succLinkDiff.lagChanged,
    totalFloatOld: oldTaskInput?.totalFloatDays ?? null,
    totalFloatNew: newTaskInput?.totalFloatDays ?? null,
    deltaFloat: floatDelta,
    floatDelta,
    criticalOld: oldTaskInput?.critical ?? null,
    criticalNew: newTaskInput?.critical ?? null,
    cpMembershipOld: oldTaskInput?.cpMember ?? null,
    cpMembershipNew: newTaskInput?.cpMember ?? null,
    criticalPathImpacted,
    constraintTypeOld: oldTaskInput?.constraintType ?? null,
    constraintTypeNew: newTaskInput?.constraintType ?? null,
    constraintDateOld: oldTaskInput?.constraintDate ?? null,
    constraintDateNew: newTaskInput?.constraintDate ?? null,
    constraintsChanged,
    calendarOld: oldTaskInput?.calendarName ?? null,
    calendarNew: newTaskInput?.calendarName ?? null,
    calendarChanged,
    milestoneOld: oldTaskInput?.milestone ?? false,
    milestoneNew: newTaskInput?.milestone ?? false,
    milestoneMoved,
    disciplineOld: oldTaskInput?.discipline ?? null,
    disciplineNew: newTaskInput?.discipline ?? null,
    areaOld: oldTaskInput?.area ?? null,
    areaNew: newTaskInput?.area ?? null,
    changeType,
    changeTypeLabel: humanizeChangeType(changeType),
    changeFlags,
    impactDays,
    diffSummary,
    reasonNote: meta.matchConfidence < 0.65 ? "Low-confidence match. Verify manually." : null,
  };

  return {
    ...baseRow,
    severityScore: severityFromRow(baseRow),
  };
}

function ensureUniqueRowIds(rows: ScheduleCompareRow[]): ScheduleCompareRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const count = seen.get(row.rowId) ?? 0;
    seen.set(row.rowId, count + 1);
    if (count === 0) return row;
    return {
      ...row,
      rowId: `${row.rowId}#${count + 1}`,
    };
  });
}

function buildTopDriver(rows: ScheduleCompareRow[], predicate: (row: ScheduleCompareRow) => boolean): string {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    if (!predicate(row)) return;
    const driver = resolveWbsDriver(row.wbs);
    map.set(driver, (map.get(driver) ?? 0) + 1);
  });
  const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
  return top ? `mostly WBS ${top[0]}` : "no dominant WBS";
}

function summarizeQuality(tasks: ScheduleTaskSnapshot[]): ScheduleQualitySummary {
  const total = tasks.length;
  if (total === 0) {
    return {
      totalTasks: 0,
      openEndsPredPct: 0,
      openEndsSuccPct: 0,
      leadsLagsCount: 0,
      constraintsCount: 0,
      negativeFloatCount: 0,
      criticalCount: 0,
      milestonesCount: 0,
      calendarCount: 0,
      criticalPathDurationDays: 0,
    };
  }

  const tasksWithoutPred = tasks.filter((task) => !task.milestone && task.predCount === 0).length;
  const tasksWithoutSucc = tasks.filter((task) => !task.milestone && task.succCount === 0).length;
  const leadsLagsCount = tasks.reduce(
    (sum, task) => sum + task.predecessorLinks.filter((link) => link.lagDays !== 0).length,
    0
  );
  const constraintsCount = tasks.filter((task) => task.constraintType && task.constraintType.toLowerCase() !== "as soon as possible").length;
  const negativeFloatCount = tasks.filter((task) => (task.totalFloatDays ?? 0) < 0).length;
  const criticalTasks = tasks.filter((task) => task.critical || task.cpMember);
  const criticalPathDurationDays = Number(
    criticalTasks.reduce((sum, task) => sum + (task.durationDays ?? 0), 0).toFixed(2)
  );
  const calendarCount = new Set(tasks.map((task) => task.calendarName || "").filter(Boolean)).size;
  const milestonesCount = tasks.filter((task) => task.milestone).length;

  return {
    totalTasks: total,
    openEndsPredPct: Number(((tasksWithoutPred / total) * 100).toFixed(2)),
    openEndsSuccPct: Number(((tasksWithoutSucc / total) * 100).toFixed(2)),
    leadsLagsCount,
    constraintsCount,
    negativeFloatCount,
    criticalCount: criticalTasks.length,
    milestonesCount,
    calendarCount,
    criticalPathDurationDays,
  };
}

function qualityStatus(metricId: string, delta: number): "green" | "yellow" | "red" {
  const worseIfIncrease = new Set([
    "openEndsPredPct",
    "openEndsSuccPct",
    "leadsLagsCount",
    "constraintsCount",
    "negativeFloatCount",
    "calendarCount",
  ]);

  if (!worseIfIncrease.has(metricId)) return delta === 0 ? "green" : Math.abs(delta) > 5 ? "yellow" : "green";
  if (delta <= 0) return "green";
  if (delta > 10) return "red";
  if (delta > 2) return "yellow";
  return "green";
}

function buildQualityMetrics(oldSummary: ScheduleQualitySummary, newSummary: ScheduleQualitySummary): ScheduleQualityMetric[] {
  const metrics: Array<{ id: keyof ScheduleQualitySummary; label: string }> = [
    { id: "openEndsPredPct", label: "% tasks without predecessors" },
    { id: "openEndsSuccPct", label: "% tasks without successors" },
    { id: "leadsLagsCount", label: "Leads/Lags count" },
    { id: "constraintsCount", label: "Constraint count" },
    { id: "negativeFloatCount", label: "Negative float tasks" },
    { id: "calendarCount", label: "Unique calendars" },
    { id: "criticalPathDurationDays", label: "Critical path duration (days)" },
  ];

  return metrics.map((metric) => {
    const oldValue = Number(oldSummary[metric.id] ?? 0);
    const newValue = Number(newSummary[metric.id] ?? 0);
    const delta = Number((newValue - oldValue).toFixed(2));
    return {
      id: metric.id,
      label: metric.label,
      oldValue,
      newValue,
      delta,
      status: qualityStatus(metric.id, delta),
      detail: delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta}`,
    };
  });
}

function deriveProjectWeeks(oldTasks: ScheduleTaskSnapshot[], newTasks: ScheduleTaskSnapshot[], fallbackCutoffDate: string) {
  const allDates = [...oldTasks, ...newTasks]
    .flatMap((task) => [task.startDate, task.finishDate])
    .filter(Boolean) as string[];
  if (allDates.length === 0) {
    return {
      cutoffDate: fallbackCutoffDate || new Date().toISOString().slice(0, 10),
      cutoffWeek: 0,
      totalProjectWeeks: 0,
    };
  }

  const sorted = allDates.sort((a, b) => a.localeCompare(b));
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const cutoffDate = fallbackCutoffDate || end;

  const totalDays = (daysBetween(start, end) ?? 0) + 1;
  const cutoffDays = (daysBetween(start, cutoffDate) ?? 0) + 1;
  const totalProjectWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const cutoffWeek = Math.max(1, Math.ceil(cutoffDays / 7));

  return {
    cutoffDate,
    cutoffWeek,
    totalProjectWeeks,
  };
}

function deriveProjectDateBounds(tasks: ScheduleTaskSnapshot[]): { projectStart: string | null; projectFinish: string | null } {
  const dates = tasks
    .flatMap((task) => [task.startDate, task.finishDate])
    .filter(Boolean) as string[];
  if (dates.length === 0) {
    return { projectStart: null, projectFinish: null };
  }
  const sorted = [...dates].sort((a, b) => a.localeCompare(b));
  return {
    projectStart: sorted[0] || null,
    projectFinish: sorted[sorted.length - 1] || null,
  };
}

function buildKpis(rows: ScheduleCompareRow[], summary: ScheduleCompareSummary): ScheduleKpiCard[] {
  const cards: Array<{ id: CompareDriverId; label: string; count: number; direction: "up" | "down" | "flat" }> = [
    { id: "added", label: "Added tasks", count: summary.addedTasks, direction: summary.addedTasks > 0 ? "up" : "flat" },
    { id: "removed", label: "Removed tasks", count: summary.removedTasks, direction: summary.removedTasks > 0 ? "up" : "flat" },
    { id: "changed", label: "Changed tasks", count: summary.changedTasks, direction: summary.changedTasks > 0 ? "up" : "flat" },
    { id: "unchanged", label: "Unchanged tasks", count: summary.unchangedTasks, direction: summary.unchangedTasks > 0 ? "flat" : "up" },
    {
      id: "criticalChanges",
      label: "Critical changes",
      count: summary.criticalChanges,
      direction: summary.criticalChanges > 0 ? "up" : "flat",
    },
    {
      id: "maxFinishShift",
      label: "Max finish shift",
      count: summary.maxFinishShiftDays,
      direction: summary.maxFinishShiftDays > 0 ? "up" : "flat",
    },
    { id: "lowConfidence", label: "Low confidence", count: summary.lowConfidence, direction: summary.lowConfidence > 0 ? "down" : "flat" },
    {
      id: "logicChanged",
      label: "Logic changed",
      count: summary.logicChanged,
      direction: summary.logicChanged > 0 ? "up" : "flat",
    },
    {
      id: "constraintsChanged",
      label: "Constraints added/changed",
      count: summary.constraintsChanged,
      direction: summary.constraintsChanged > 0 ? "down" : "flat",
    },
    {
      id: "calendarChanged",
      label: "Calendar changed",
      count: summary.calendarChanged,
      direction: summary.calendarChanged > 0 ? "up" : "flat",
    },
    {
      id: "milestonesMoved",
      label: "Milestones moved",
      count: summary.milestonesMoved,
      direction: summary.milestonesMoved > 0 ? "down" : "flat",
    },
  ];

  return cards.map((card) => {
    const predicateMap: Record<CompareDriverId, (row: ScheduleCompareRow) => boolean> = {
      added: (row) => row.changeType === "ADDED",
      removed: (row) => row.changeType === "REMOVED",
      changed: (row) => row.changeType !== "UNCHANGED",
      unchanged: (row) => row.changeType === "UNCHANGED",
      criticalChanges: (row) => row.criticalPathImpacted || row.criticalNew || row.criticalOld || row.changeType === "LOGIC_CHANGE",
      maxFinishShift: (row) => Math.abs(row.finishShiftDays ?? 0) >= summary.maxFinishShiftDays && summary.maxFinishShiftDays > 0,
      lowConfidence: (row) => row.matchConfidence < 0.72,
      logicChanged: (row) => row.logicChanged,
      constraintsChanged: (row) => row.constraintsChanged,
      calendarChanged: (row) => row.calendarChanged,
      milestonesMoved: (row) => row.milestoneMoved,
    };

    return {
      id: card.id,
      label: card.label,
      count: card.count,
      direction: card.direction,
      deltaText: card.count === 0 ? "no delta" : `${card.count > 0 ? "+" : ""}${card.count}`,
      topDriver: buildTopDriver(rows, predicateMap[card.id]),
    };
  });
}

export function compareScheduleSnapshots(
  oldTasks: ScheduleTaskSnapshot[],
  newTasks: ScheduleTaskSnapshot[],
  options: { allowUidFallback?: boolean } = {}
): {
  rows: ScheduleCompareRow[];
  summary: ScheduleCompareSummary;
  qualityOld: ScheduleQualitySummary;
  qualityNew: ScheduleQualitySummary;
  qualityMetrics: ScheduleQualityMetric[];
  kpis: ScheduleKpiCard[];
} {
  const rows: ScheduleCompareRow[] = [];
  const matchedPairs = matchScheduleTasks(oldTasks, newTasks, {
    confidenceThreshold: 0.7,
    allowUidFallback: options.allowUidFallback ?? false,
  });
  const refs = buildLinkReferenceMaps(matchedPairs);
  for (const pair of matchedPairs) {
    const compared = compareTaskPair(pair.oldTask, pair.newTask, {
      matchConfidence: pair.matchConfidence,
      matchMethod: pair.matchMethod,
    }, refs);
    rows.push(compared);
  }

  rows.sort((a, b) => b.severityScore - a.severityScore || a.wbs.localeCompare(b.wbs) || a.taskName.localeCompare(b.taskName));
  const uniqueRows = ensureUniqueRowIds(rows);

  const addedTasks = uniqueRows.filter((row) => row.changeType === "ADDED").length;
  const removedTasks = uniqueRows.filter((row) => row.changeType === "REMOVED").length;
  const unchangedTasks = uniqueRows.filter((row) => row.changeType === "UNCHANGED").length;
  const changedTasks = uniqueRows.length - unchangedTasks;
  const modifiedTasks = uniqueRows.filter((row) => !["ADDED", "REMOVED", "UNCHANGED"].includes(row.changeType)).length;

  const summary: ScheduleCompareSummary = {
    addedTasks,
    removedTasks,
    modifiedTasks,
    changedTasks,
    unchangedTasks,
    criticalChanges: uniqueRows.filter((row) => row.criticalPathImpacted || row.criticalNew || row.criticalOld).length,
    maxFinishShiftDays: uniqueRows.reduce((max, row) => Math.max(max, Math.abs(row.finishShiftDays ?? 0)), 0),
    lowConfidence: uniqueRows.filter((row) => row.matchConfidence < 0.72).length,
    criticalPathImpacted: uniqueRows.filter((row) => row.criticalPathImpacted).length,
    floatErosionCount: uniqueRows.filter((row) => (row.floatDelta ?? 0) < 0).length,
    floatErosionSumDays: Number(
      uniqueRows
        .filter((row) => (row.floatDelta ?? 0) < 0)
        .reduce((sum, row) => sum + Math.abs(row.floatDelta ?? 0), 0)
        .toFixed(2)
    ),
    logicChanged: uniqueRows.filter((row) => row.logicChanged).length,
    constraintsChanged: uniqueRows.filter((row) => row.constraintsChanged).length,
    calendarChanged: uniqueRows.filter((row) => row.calendarChanged).length,
    milestonesMoved: uniqueRows.filter((row) => row.milestoneMoved).length,
  };

  const qualityOld = summarizeQuality(oldTasks);
  const qualityNew = summarizeQuality(newTasks);
  const qualityMetrics = buildQualityMetrics(qualityOld, qualityNew);
  const kpis = buildKpis(uniqueRows, summary);

  return { rows: uniqueRows, summary, qualityOld, qualityNew, qualityMetrics, kpis };
}

async function readStorageFile(path: string): Promise<Buffer> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download failed for ${path}: ${error?.message || "unknown error"}`);
  const ab = await data.arrayBuffer();
  return Buffer.from(new Uint8Array(ab));
}

function revisionById(revisions: ScheduleRevision[], revisionId: string): ScheduleRevision | null {
  return revisions.find((item) => item.id === revisionId || item.fileId === revisionId || item.sourceFilePath === revisionId) ?? null;
}

async function resolveRevisionSnapshot(
  revision: ScheduleRevision
): Promise<{ revision: ScheduleRevision; warnings: string[]; tasks: ScheduleTaskSnapshot[] }> {
  if (revision.snapshotTasks.length > 0) {
    return { revision, warnings: [], tasks: revision.snapshotTasks };
  }
  if (!revision.sourceFilePath) {
    return { revision, warnings: ["Revision has no source file path."], tasks: [] };
  }

  const buffer = await readStorageFile(revision.sourceFilePath);
  const parsed = await parseScheduleFile(revision.sourceFileName || revision.sourceFilePath, buffer);

  return {
    revision: {
      ...revision,
      sourceKind: parsed.sourceKind,
      hasSnapshot: parsed.tasks.length > 0,
      taskCount: parsed.tasks.length,
      snapshotTasks: parsed.tasks,
    },
    warnings: parsed.warnings,
    tasks: parsed.tasks,
  };
}

export async function compareScheduleRevisions(input: {
  projectCode: string;
  oldRevisionId: string;
  newRevisionId: string;
}): Promise<ScheduleCompareResult> {
  const revisionList = await getScheduleRevisions(input.projectCode);
  const oldRevision = revisionById(revisionList.revisions, input.oldRevisionId);
  const newRevision = revisionById(revisionList.revisions, input.newRevisionId);
  if (!oldRevision) throw new Error(`Old revision not found: ${input.oldRevisionId}`);
  if (!newRevision) throw new Error(`New revision not found: ${input.newRevisionId}`);

  const oldDate = oldRevision.dataDate || parseDateTokenFromFilename(oldRevision.sourceFileName) || toIsoDateOnly(oldRevision.importedAt);
  const newDate = newRevision.dataDate || parseDateTokenFromFilename(newRevision.sourceFileName) || toIsoDateOnly(newRevision.importedAt);
  if (oldDate && newDate && oldDate >= newDate) {
    throw new Error(`Baseline revision must be older than update revision. Selected baseline date ${oldDate}, update date ${newDate}.`);
  }

  const [oldResolved, newResolved] = await Promise.all([resolveRevisionSnapshot(oldRevision), resolveRevisionSnapshot(newRevision)]);
  const allowUidFallback = revisionsShareLineage(oldResolved.revision, newResolved.revision);
  const compared = compareScheduleSnapshots(oldResolved.tasks, newResolved.tasks, { allowUidFallback });

  const weekStats = deriveProjectWeeks(oldResolved.tasks, newResolved.tasks, revisionList.latestCutoffDate);
  const oldBounds = deriveProjectDateBounds(oldResolved.tasks);
  const newBounds = deriveProjectDateBounds(newResolved.tasks);
  const warnings = [...oldResolved.warnings, ...newResolved.warnings];

  return {
    comparedAt: new Date().toISOString(),
    projectCode: revisionList.projectCode,
    projectName: revisionList.projectName,
    cutoffDate: weekStats.cutoffDate,
    cutoffWeek: weekStats.cutoffWeek,
    totalProjectWeeks: weekStats.totalProjectWeeks,
    oldProjectStart: oldBounds.projectStart,
    oldProjectFinish: oldBounds.projectFinish,
    newProjectStart: newBounds.projectStart,
    newProjectFinish: newBounds.projectFinish,
    oldRevision: oldResolved.revision,
    newRevision: newResolved.revision,
    rows: compared.rows,
    summary: compared.summary,
    kpis: compared.kpis,
    qualityOld: compared.qualityOld,
    qualityNew: compared.qualityNew,
    qualityMetrics: compared.qualityMetrics,
    warnings,
  };
}

function csvCellValue(value: unknown): string {
  const text = asString(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function tasksToCsv(tasks: ScheduleTaskSnapshot[]): string {
  const headers = [
    "WBS",
    "Task Name",
    "Task ID",
    "Start",
    "Finish",
    "Duration Days",
    "Remaining Duration Days",
    "Predecessors",
    "Successors",
    "Total Float",
    "Critical",
    "Constraint Type",
    "Constraint Date",
    "Calendar",
    "Milestone",
    "Discipline",
    "Area",
  ];

  const lines = [headers.join(",")];
  tasks.forEach((task) => {
    const row = [
      task.wbs,
      task.taskName,
      task.taskId,
      task.startDate,
      task.finishDate,
      task.durationDays,
      task.remainingDurationDays,
      task.predecessors.join("; "),
      task.successors.join("; "),
      task.totalFloatDays,
      task.critical === null ? "" : task.critical ? "Yes" : "No",
      task.constraintType,
      task.constraintDate,
      task.calendarName,
      task.milestone ? "Yes" : "No",
      task.discipline,
      task.area,
    ].map(csvCellValue);

    lines.push(row.join(","));
  });
  return `${lines.join("\n")}\n`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toProjectDateTime(date: string | null, endOfDay = false): string {
  if (!date) {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        endOfDay ? 17 : 8,
        0,
        0
      )
    ).toISOString();
  }
  return `${date}T${endOfDay ? "17" : "08"}:00:00.000Z`;
}

function toProjectDuration(days: number | null): string {
  const safeDays = Number.isFinite(days ?? NaN) ? Math.max(0, Number(days)) : 0;
  const whole = Math.floor(safeDays);
  const fraction = safeDays - whole;
  const minutes = Math.round(fraction * 8 * 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `P${whole}DT${hours}H${mins}M0S`;
}

function buildProjectXmlFromTasks(projectCode: string, tasks: ScheduleTaskSnapshot[]): Buffer {
  const created = new Date().toISOString();
  const sorted = [...tasks].sort(
    (a, b) =>
      a.wbs.localeCompare(b.wbs) ||
      a.taskName.localeCompare(b.taskName) ||
      (a.taskId || "").localeCompare(b.taskId || "")
  );

  const uidByTaskId = new Map<string, number>();
  sorted.forEach((task, index) => {
    if (task.taskId) uidByTaskId.set(task.taskId, index + 1);
  });

  const rows = sorted
    .map((task, index) => {
      const uid = index + 1;
      const predecessorsXml = task.predecessorLinks
        .map((link) => {
          const predUid = uidByTaskId.get(link.id);
          if (!predUid) return "";
          const typeCode = link.relationType === "FF" ? 0 : link.relationType === "FS" ? 1 : link.relationType === "SF" ? 2 : 3;
          return [
            "      <PredecessorLink>",
            `        <PredecessorUID>${predUid}</PredecessorUID>`,
            `        <Type>${typeCode}</Type>`,
            link.lagDays ? `        <LinkLag>${toProjectDuration(Math.abs(link.lagDays))}</LinkLag>` : "",
            "      </PredecessorLink>",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .filter(Boolean)
        .join("\n");

      return [
        "    <Task>",
        `      <UID>${uid}</UID>`,
        `      <ID>${uid}</ID>`,
        `      <Name>${escapeXml(task.taskName || `Task ${uid}`)}</Name>`,
        task.wbs ? `      <OutlineNumber>${escapeXml(task.wbs)}</OutlineNumber>` : "",
        task.taskId ? `      <WBS>${escapeXml(task.taskId)}</WBS>` : "",
        `      <Start>${toProjectDateTime(task.startDate, false)}</Start>`,
        `      <Finish>${toProjectDateTime(task.finishDate, true)}</Finish>`,
        `      <Duration>${toProjectDuration(task.durationDays)}</Duration>`,
        `      <RemainingDuration>${toProjectDuration(task.remainingDurationDays ?? task.durationDays)}</RemainingDuration>`,
        task.progressPct !== null ? `      <PercentComplete>${Math.max(0, Math.min(100, Math.round(task.progressPct)))}</PercentComplete>` : "",
        task.critical !== null ? `      <Critical>${task.critical ? 1 : 0}</Critical>` : "",
        task.milestone ? "      <Milestone>1</Milestone>" : "",
        task.constraintType ? `      <ConstraintType>${escapeXml(task.constraintType)}</ConstraintType>` : "",
        task.constraintDate ? `      <ConstraintDate>${toProjectDateTime(task.constraintDate, false)}</ConstraintDate>` : "",
        task.calendarName ? `      <CalendarUID>${escapeXml(task.calendarName)}</CalendarUID>` : "",
        predecessorsXml,
        "    </Task>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    `  <Name>${escapeXml(`${projectCode} - Combined Schedule`)}</Name>`,
    `  <Title>${escapeXml(`${projectCode} Combined Multi-Discipline Schedule`)}</Title>`,
    `  <CreationDate>${created}</CreationDate>`,
    `  <CurrentDate>${created}</CurrentDate>`,
    "  <ScheduleFromStart>1</ScheduleFromStart>",
    "  <Tasks>",
    rows,
    "  </Tasks>",
    "</Project>",
    "",
  ].join("\n");

  return Buffer.from(xml, "utf-8");
}

function nextUpdateRevisionCode(revisions: ScheduleRevision[]): string {
  const maxUpdate = revisions.reduce((max, revision) => {
    const match = revision.revisionCode.match(/^U(\d+)/i);
    if (!match) return max;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `U${String(maxUpdate + 1).padStart(2, "0")}`;
}

function revisionMetaFromInput(input: {
  revisionCode: string;
  revisionType: ScheduleRevisionType;
  group: ScheduleDisciplineGroup | null;
  importedBy: string;
  comment: string;
  sourceFileName: string;
  sourceFilePath: string;
  sourceKind: ScheduleSourceKind;
  checksum: string;
  importedAt: string;
  dataDate: string | null;
  taskCount: number;
  tasks: ScheduleTaskSnapshot[];
  warnings: string[];
}): UnknownRecord {
  return {
    schedule: {
      revisionCode: input.revisionCode,
      revisionType: input.revisionType,
      group: input.group,
      importedBy: input.importedBy,
      comment: input.comment,
      sourceFileName: input.sourceFileName,
      sourceFilePath: input.sourceFilePath,
      sourceKind: input.sourceKind,
      checksum: input.checksum,
      importedAt: input.importedAt,
      dataDate: input.dataDate,
      taskCount: input.taskCount,
      warnings: input.warnings,
      tasks: input.tasks,
      quality: summarizeQuality(input.tasks),
    },
  };
}

export async function importScheduleRevision(input: {
  projectCode: string;
  fileName: string;
  fileBuffer: Buffer;
  revisionCode: string;
  revisionType: ScheduleRevisionType;
  group?: ScheduleDisciplineGroup | null;
  comment: string;
  importedBy: string;
}): Promise<ScheduleImportResult> {
  const sb = supabaseAdmin();
  const { data: project, error: projectError } = await sb
    .from("projects")
    .select("id,code,name")
    .eq("code", input.projectCode)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project?.id) throw new Error(`Project not found: ${input.projectCode}`);

  const importedAt = new Date().toISOString();
  const checksum = crypto.createHash("sha256").update(input.fileBuffer).digest("hex");

  const parseResult = await parseScheduleFile(input.fileName, input.fileBuffer);
  const sourceKind = parseResult.sourceKind;
  const dataDate = parseDateTokenFromFilename(input.fileName) || toIsoDateOnly(importedAt);
  const group = normalizeScheduleGroup(input.group) || inferScheduleGroupFromFilename(input.fileName);
  const jobType = "import-schedule";

  const { data: jobRow, error: jobError } = await sb
    .from("import_jobs")
    .insert({
      project_id: project.id,
      type: jobType,
      status: "running",
      started_at: importedAt,
      request_meta: {
        projectCode: input.projectCode,
        revisionCode: input.revisionCode,
        revisionType: input.revisionType,
        group,
        sourceFileName: input.fileName,
      },
      log: [{ t: importedAt, msg: "Schedule import started" }],
    })
    .select("id")
    .single();
  if (jobError) throw new Error(jobError.message);
  const jobId = asString(jobRow.id);

  try {
    const ext = extensionFromPath(input.fileName) || "bin";
    const dateStamp = importedAt.slice(0, 10).replaceAll("-", "");
    const storagePath = `${input.projectCode}/${SCHEDULE_SUBFOLDER}/Imported/${dateStamp}/${input.revisionCode}_${Date.now()}.${ext}`;

    await uploadFile({
      supabase: sb,
      ownerId: SYSTEM_FILES_OWNER_ID,
      bucket: STORAGE_BUCKET,
      path: storagePath,
      data: input.fileBuffer,
      fileName: input.fileName,
      upsert: true,
      entityType: "schedule_revision",
      entityId: `${input.projectCode}:${input.revisionCode}`,
      metadata: {
        projectCode: input.projectCode,
        revisionCode: input.revisionCode,
        revisionType: input.revisionType,
      },
    });

    const { data: revisionSeed } = await sb
      .from("files")
      .select("revision")
      .eq("project_id", project.id)
      .eq("logical_name", SCHEDULE_LOGICAL_NAME)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRevision = (parseFloatNumber(revisionSeed?.revision) ?? 0) + 1;
    const meta = revisionMetaFromInput({
      revisionCode: input.revisionCode,
      revisionType: input.revisionType,
      group,
      importedBy: input.importedBy,
      comment: input.comment,
      sourceFileName: input.fileName,
      sourceFilePath: storagePath,
      sourceKind,
      checksum,
      importedAt,
      dataDate,
      taskCount: parseResult.tasks.length,
      tasks: parseResult.tasks,
      warnings: parseResult.warnings,
    });

    const { data: fileRow, error: fileError } = await sb
      .from("files")
      .insert({
        project_id: project.id,
        type: "import",
        logical_name: SCHEDULE_LOGICAL_NAME,
        revision: nextRevision,
        storage_path: storagePath,
        original_filename: input.fileName,
        checksum_sha256: checksum,
        byte_size: input.fileBuffer.length,
        meta,
        created_at: importedAt,
      })
      .select("id,revision,storage_path,meta,created_at,checksum_sha256,byte_size")
      .single();
    if (fileError) throw new Error(fileError.message);

    await sb
      .from("import_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        file_id: asString(fileRow.id),
        warnings_count: parseResult.warnings.length,
        errors_count: 0,
        log: [
          { t: importedAt, msg: "Schedule import finished" },
          { t: importedAt, msg: `Parsed tasks: ${parseResult.tasks.length}` },
          ...(parseResult.warnings.length > 0 ? [{ t: importedAt, msg: parseResult.warnings.join(" | ") }] : []),
        ],
      })
      .eq("id", jobId);

    const revision: ScheduleRevision = {
      id: asString(fileRow.id),
      fileId: asString(fileRow.id),
      projectCode: input.projectCode,
      revisionCode: input.revisionCode,
      revisionType: input.revisionType,
      group,
      dataDate,
      importedAt,
      importedBy: input.importedBy,
      sourceFileName: input.fileName,
      sourceFilePath: storagePath,
      sourceKind,
      checksum,
      byteSize: input.fileBuffer.length,
      comment: input.comment,
      hasSnapshot: parseResult.tasks.length > 0,
      taskCount: parseResult.tasks.length,
      snapshotTasks: parseResult.tasks,
    };

    if (sourceKind === "mpp" && parseResult.tasks.length === 0) {
      const csv = tasksToCsv(parseResult.tasks);
      if (csv.length > 0) {
        const auxPath = `${storagePath}.csv`;
        await uploadFile({
          supabase: sb,
          ownerId: SYSTEM_FILES_OWNER_ID,
          bucket: STORAGE_BUCKET,
          path: auxPath,
          data: Buffer.from(csv, "utf-8"),
          fileName: `${input.fileName}.csv`,
          contentType: "text/csv",
          upsert: true,
          entityType: "schedule_revision_csv",
          entityId: `${input.projectCode}:${input.revisionCode}`,
          metadata: {
            projectCode: input.projectCode,
            revisionCode: input.revisionCode,
          },
        });
      }
    }

    return {
      revision,
      warnings: parseResult.warnings,
      parsedTasks: parseResult.tasks.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sb
      .from("import_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        warnings_count: 0,
        errors_count: 1,
        log: [{ t: new Date().toISOString(), msg: message }],
      })
      .eq("id", jobId);
    throw error;
  }
}

export async function createMergedScheduleRevision(input: {
  projectCode: string;
  importedBy?: string;
  comment?: string;
}): Promise<ScheduleAssembleResult> {
  const revisionList = await getScheduleRevisions(input.projectCode);
  const ordered = [...revisionList.revisions].sort((a, b) => revisionSortTimestamp(b) - revisionSortTimestamp(a));

  const sourceRevisions = SCHEDULE_GROUP_ORDER.map((group) => {
    const revision = ordered.find((item) => item.group === group) || null;
    return { group, revision };
  });

  const missing = sourceRevisions.filter((item) => !item.revision).map((item) => SCHEDULE_GROUP_LABEL[item.group]);
  if (missing.length > 0) {
    throw new Error(`Cannot assemble merged schedule. Missing imports for: ${missing.join(", ")}.`);
  }

  const resolved = await Promise.all(
    sourceRevisions.map(async ({ group, revision }) => {
      const safeRevision = revision as ScheduleRevision;
      const data = await resolveRevisionSnapshot(safeRevision);
      return { group, revision: data.revision, tasks: data.tasks, warnings: data.warnings };
    })
  );

  const mergedMap = new Map<
    string,
    { task: ScheduleTaskSnapshot; stamp: number; revision: ScheduleRevision; group: ScheduleDisciplineGroup }
  >();

  resolved.forEach(({ group, revision, tasks }) => {
    const stamp = revisionSortTimestamp(revision);
    tasks.forEach((task) => {
      const key = `${task.matchKey}|${task.taskId || task.key}`;
      const current = mergedMap.get(key);
      if (!current || stamp >= current.stamp) {
        mergedMap.set(key, { task, stamp, revision, group });
      }
    });
  });

  const mergedTasks = Array.from(mergedMap.values()).map((item) => item.task);
  if (mergedTasks.length === 0) {
    throw new Error("Cannot assemble merged schedule. No parsed tasks available in group revisions.");
  }

  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const revisionCode = nextUpdateRevisionCode(revisionList.revisions);
  const fileName = `${input.projectCode}-ALL-PS-${yy}${mm}${dd}_rev00.xml`;
  const fileBuffer = buildProjectXmlFromTasks(input.projectCode, mergedTasks);
  const importedBy = (input.importedBy || "schedule-merge-bot").trim() || "schedule-merge-bot";

  const sourceComment = resolved
    .map((item) => `${SCHEDULE_GROUP_LABEL[item.group]}:${item.revision.revisionCode}`)
    .join(" | ");
  const mergedComment = (input.comment || "").trim() || `Combined from ${sourceComment}`;

  const imported = await importScheduleRevision({
    projectCode: input.projectCode,
    fileName,
    fileBuffer,
    revisionCode,
    revisionType: "update",
    group: null,
    importedBy,
    comment: mergedComment,
  });

  return {
    revision: imported.revision,
    sourceGroups: resolved.map((item) => ({
      group: item.group,
      label: SCHEDULE_GROUP_LABEL[item.group],
      revisionId: item.revision.id,
      revisionCode: item.revision.revisionCode,
      importedAt: item.revision.importedAt,
      sourceFileName: item.revision.sourceFileName,
    })),
    mergedTaskCount: mergedTasks.length,
    warnings: [...imported.warnings, ...resolved.flatMap((item) => item.warnings)],
  };
}

export async function getScheduleAuditLog(projectCode: string) {
  const sb = supabaseAdmin();
  const { data: project, error: projectError } = await sb
    .from("projects")
    .select("id")
    .eq("code", projectCode)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project?.id) throw new Error(`Project not found: ${projectCode}`);

  const { data, error } = await sb
    .from("import_jobs")
    .select("id,type,status,started_at,finished_at,file_id,request_meta,log,warnings_count,errors_count")
    .eq("project_id", project.id)
    .in("type", ["import-schedule", "compare-schedule", "export-schedule-compare"])
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function applyCompareFilters(rows: ScheduleCompareRow[], filters: ScheduleCompareFilters = {}): ScheduleCompareRow[] {
  const search = (filters.search || "").trim().toLowerCase();
  const wbsPrefix = (filters.wbsPrefix || "").trim().toLowerCase();
  const confidenceMinRaw = Number(filters.confidenceMin ?? 0);
  const confidenceMin = Number.isFinite(confidenceMinRaw) ? Math.max(0, Math.min(1, confidenceMinRaw)) : 0;
  const minAbsFinishShiftDaysRaw = Number(filters.minAbsFinishShiftDays ?? 0);
  const minAbsStartShiftDaysRaw = Number(filters.minAbsStartShiftDays ?? 0);
  const minAbsFinishShiftDays = Number.isFinite(minAbsFinishShiftDaysRaw) ? Math.max(0, minAbsFinishShiftDaysRaw) : 0;
  const minAbsStartShiftDays = Number.isFinite(minAbsStartShiftDaysRaw) ? Math.max(0, minAbsStartShiftDaysRaw) : 0;
  const onlyCritical = Boolean(filters.onlyCritical);
  const onlyMilestones = Boolean(filters.onlyMilestones);
  const showAdded = filters.showAdded !== false;
  const showRemoved = filters.showRemoved !== false;
  const normalizedTypes = (filters.changeTypes || []).filter(Boolean) as ScheduleChangeType[];
  const allowedTypes = normalizedTypes.length > 0 ? new Set(normalizedTypes) : null;

  return rows.filter((row) => {
    if (!showAdded && row.changeType === "ADDED") return false;
    if (!showRemoved && row.changeType === "REMOVED") return false;
    if (allowedTypes && !allowedTypes.has(row.changeType)) return false;
    if (onlyCritical && !(row.criticalPathImpacted || row.criticalNew || row.criticalOld)) return false;
    if (onlyMilestones && !(row.milestoneOld || row.milestoneNew || row.milestoneMoved)) return false;
    if (minAbsFinishShiftDays > 0 && Math.abs(row.finishShiftDays ?? 0) < minAbsFinishShiftDays) return false;
    if (minAbsStartShiftDays > 0 && Math.abs(row.startShiftDays ?? 0) < minAbsStartShiftDays) return false;
    if (row.matchConfidence < confidenceMin) return false;
    if (wbsPrefix && !(row.wbs || "").toLowerCase().startsWith(wbsPrefix)) return false;

    if (search) {
      const haystack = [
        row.activityCode || "",
        row.wbs || "",
        row.taskName || "",
        row.oldTaskName || "",
        row.newTaskName || "",
        row.oldId || "",
        row.newId || "",
        row.changeType || "",
        row.changeFlags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export function filterRowsForExport(rows: ScheduleCompareRow[], mode: "full" | "critical" | "milestones"): ScheduleCompareRow[] {
  if (mode === "critical") {
    return applyCompareFilters(rows, { onlyCritical: true });
  }
  if (mode === "milestones") {
    return applyCompareFilters(rows, { onlyMilestones: true });
  }
  return rows;
}

export async function buildCompareWorkbook(
  result: ScheduleCompareResult,
  mode: "full" | "critical" | "milestones",
  rowsOverride?: ScheduleCompareRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LUNE Schedule Control";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [{ width: 34 }, { width: 52 }];

  summarySheet.addRow(["Project", `${result.projectCode} · ${result.projectName}`]);
  summarySheet.addRow(["Old Revision", `${result.oldRevision.revisionCode} · ${result.oldRevision.sourceFileName}`]);
  summarySheet.addRow(["New Revision", `${result.newRevision.revisionCode} · ${result.newRevision.sourceFileName}`]);
  summarySheet.addRow(["Compared At", new Date(result.comparedAt).toISOString()]);
  summarySheet.addRow(["Cutoff Date", result.cutoffDate || "-"]);
  summarySheet.addRow(["Cutoff Week", result.cutoffWeek > 0 ? `W ${result.cutoffWeek}/${result.totalProjectWeeks}` : "-"]);
  summarySheet.addRow(["Export Mode", mode]);
  summarySheet.addRow([]);
  summarySheet.addRow(["KPI", "Value"]);
  summarySheet.getRow(summarySheet.rowCount).font = { bold: true };

  for (const kpi of result.kpis) {
    summarySheet.addRow([kpi.label, `${kpi.count} (${kpi.topDriver})`]);
  }

  summarySheet.addRow([]);
  summarySheet.addRow(["Quality Metric", "Old -> New"]);
  summarySheet.getRow(summarySheet.rowCount).font = { bold: true };
  for (const metric of result.qualityMetrics) {
    summarySheet.addRow([metric.label, `${metric.oldValue} -> ${metric.newValue} (${metric.delta >= 0 ? "+" : ""}${metric.delta})`]);
  }

  const tableSheet = workbook.addWorksheet("Changes");
  tableSheet.columns = [
    { header: "Match Confidence", key: "matchConfidence", width: 16 },
    { header: "Match Method", key: "matchMethod", width: 14 },
    { header: "Activity Code", key: "activityCode", width: 18 },
    { header: "WBS", key: "wbs", width: 16 },
    { header: "Task Name", key: "taskName", width: 38 },
    { header: "Change", key: "changeType", width: 12 },
    { header: "Old ID", key: "oldId", width: 10 },
    { header: "New ID", key: "newId", width: 10 },
    { header: "Old Start", key: "oldStart", width: 14 },
    { header: "New Start", key: "newStart", width: 14 },
    { header: "Start Shift", key: "startShiftDays", width: 12 },
    { header: "Old Finish", key: "oldFinish", width: 14 },
    { header: "New Finish", key: "newFinish", width: 14 },
    { header: "Finish Shift", key: "finishShiftDays", width: 12 },
    { header: "Duration Old", key: "durationOld", width: 12 },
    { header: "Duration New", key: "durationNew", width: 12 },
    { header: "Pred O/N", key: "pred", width: 12 },
    { header: "Succ O/N", key: "succ", width: 12 },
    { header: "Logic Changed", key: "logicChanged", width: 14 },
    { header: "Float O/N", key: "float", width: 14 },
    { header: "Float Delta", key: "floatDelta", width: 12 },
    { header: "Critical O/N", key: "critical", width: 14 },
    { header: "Constraint O/N", key: "constraint", width: 22 },
    { header: "Calendar O/N", key: "calendar", width: 18 },
    { header: "Milestone Moved", key: "milestoneMoved", width: 16 },
    { header: "Change Flags", key: "changeFlags", width: 28 },
    { header: "Diff Summary", key: "diffSummary", width: 42 },
    { header: "Severity", key: "severity", width: 10 },
  ];

  const filteredRows = rowsOverride ?? filterRowsForExport(result.rows, mode);
  summarySheet.addRow(["Exported Rows", filteredRows.length]);
  summarySheet.addRow(["Rows in Compare", result.rows.length]);
  summarySheet.addRow([]);
  filteredRows.forEach((row) => {
    tableSheet.addRow({
      matchConfidence: Number(row.matchConfidence.toFixed(3)),
      matchMethod: row.matchMethod,
      activityCode: row.activityCode ?? "",
      wbs: row.wbs,
      taskName: row.taskName,
      changeType: row.changeType,
      oldId: row.oldId ?? "",
      newId: row.newId ?? "",
      oldStart: row.oldStart ?? "",
      newStart: row.newStart ?? "",
      startShiftDays: row.startShiftDays ?? "",
      oldFinish: row.oldFinish ?? "",
      newFinish: row.newFinish ?? "",
      finishShiftDays: row.finishShiftDays ?? "",
      durationOld: row.durationOld ?? "",
      durationNew: row.durationNew ?? "",
      pred: `${row.predCountOld}/${row.predCountNew}`,
      succ: `${row.succCountOld}/${row.succCountNew}`,
      logicChanged: row.logicChanged ? "Yes" : "No",
      float: `${row.totalFloatOld ?? ""}/${row.totalFloatNew ?? ""}`,
      floatDelta: row.floatDelta ?? "",
      critical: `${row.criticalOld ? "Yes" : "No"}/${row.criticalNew ? "Yes" : "No"}`,
      constraint: `${row.constraintTypeOld ?? ""}/${row.constraintTypeNew ?? ""}`,
      calendar: `${row.calendarOld ?? ""}/${row.calendarNew ?? ""}`,
      milestoneMoved: row.milestoneMoved ? "Yes" : "No",
      changeFlags: row.changeFlags.join(", "),
      diffSummary: row.diffSummary,
      severity: row.severityScore,
    });
  });

  tableSheet.getRow(1).font = { bold: true };
  tableSheet.views = [{ state: "frozen", ySplit: 1 }];

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
