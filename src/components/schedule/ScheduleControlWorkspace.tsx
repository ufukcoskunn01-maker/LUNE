"use client";

import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleGauge,
  Download,
  GitCompare,
  ListChecks,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

type RevisionType = "baseline" | "update";
type ChangeType =
  | "UNCHANGED"
  | "DATE_SHIFT"
  | "DURATION_CHANGE"
  | "PROGRESS_CHANGE"
  | "LOGIC_CHANGE"
  | "CONSTRAINT_CHANGE"
  | "CALENDAR_CHANGE"
  | "WBS_MOVED"
  | "RENAMED"
  | "ADDED"
  | "REMOVED";
type ExportMode = "full" | "critical" | "milestones";
type ScheduleGroup = "electrical" | "mechanical" | "construction";

type Revision = {
  id: string;
  fileId: string | null;
  projectCode: string;
  revisionCode: string;
  revisionType: RevisionType;
  group: ScheduleGroup | null;
  dataDate: string | null;
  importedAt: string;
  importedBy: string;
  sourceFileName: string;
  sourceFilePath: string;
  sourceKind: string;
  checksum: string | null;
  byteSize: number | null;
  comment: string;
  hasSnapshot: boolean;
  taskCount: number;
};

type GroupStatus = {
  group: ScheduleGroup;
  label: string;
  ready: boolean;
  latestRevisionId: string | null;
  latestRevisionCode: string | null;
  latestImportedAt: string | null;
  latestSourceFileName: string | null;
};

type KpiCard = {
  id: string;
  label: string;
  count: number;
  direction: "up" | "down" | "flat";
  deltaText: string;
  topDriver: string;
};

type QualityMetric = {
  id: string;
  label: string;
  oldValue: number;
  newValue: number;
  delta: number;
  status: "green" | "yellow" | "red";
  detail: string;
};

type CompareRow = {
  rowId: string;
  stableKey: string;
  activityCode: string | null;
  matchConfidence: number;
  matchMethod: "AC" | "ExactName" | "FuzzyName" | "UID" | "Heuristic";
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
  changeType: ChangeType;
  changeTypeLabel: string;
  changeFlags: string[];
  impactDays: number | null;
  diffSummary: string;
  severityScore: number;
  reasonNote: string | null;
};

type CompareSummary = {
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

type CompareResult = {
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
  oldRevision: Revision;
  newRevision: Revision;
  rows: CompareRow[];
  summary: CompareSummary;
  kpis: KpiCard[];
  qualityMetrics: QualityMetric[];
  warnings: string[];
};

type QualityGateVerdict = {
  score: number;
  level: "acceptable" | "warning" | "alarm";
  message: string;
};

type RevisionsPayload = {
  projectCode: string;
  projectName: string;
  revisions: Revision[];
  groupStatus: GroupStatus[];
  canAssembleMergedSchedule: boolean;
  latestMsProjectPath: string | null;
  latestCutoffDate: string;
};

type FilterState = {
  search: string;
  changeTypes: ChangeType[];
  onlyCritical: boolean;
  onlyMilestones: boolean;
  showAdded: boolean;
  showRemoved: boolean;
  dateShiftDays: number;
  floatErosionDays: number;
  logicChanged: boolean;
  constraintsChanged: boolean;
  calendarChanged: boolean;
  wbsPrefix: string;
  taskName: string;
  discipline: string;
  area: string;
  minAbsFinishShiftDays: number;
  minAbsStartShiftDays: number;
  confidenceMin: number;
};

type SortKey =
  | "wbs"
  | "progressNew"
  | "taskName"
  | "changeType"
  | "finishShiftDays"
  | "floatDelta"
  | "severityScore"
  | "predCountNew"
  | "succCountNew";

const PROJECT_CODE = "A27";
const DRAWER_TABS = ["Overview", "Dates & Float", "Logic Diff", "Constraints", "Audit"] as const;
const TABLE_GRID_TEMPLATE = "110px 110px minmax(260px,1.2fr) 170px 170px 150px minmax(360px,1.6fr) minmax(360px,1.6fr) 100px";
const PAGE_SIZE = 40;
const CHANGE_TYPE_OPTIONS: ChangeType[] = [
  "UNCHANGED",
  "DATE_SHIFT",
  "DURATION_CHANGE",
  "PROGRESS_CHANGE",
  "LOGIC_CHANGE",
  "CONSTRAINT_CHANGE",
  "CALENDAR_CHANGE",
  "WBS_MOVED",
  "RENAMED",
  "ADDED",
  "REMOVED",
];

const MODIFIED_CHANGE_TYPES: ChangeType[] = CHANGE_TYPE_OPTIONS.filter(
  (type) => type !== "ADDED" && type !== "REMOVED" && type !== "UNCHANGED"
);

function sameChangeTypeSet(current: ChangeType[], expected: ChangeType[]): boolean {
  if (current.length !== expected.length) return false;
  const set = new Set(current);
  return expected.every((type) => set.has(type));
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  changeTypes: [...CHANGE_TYPE_OPTIONS],
  onlyCritical: false,
  onlyMilestones: false,
  showAdded: true,
  showRemoved: true,
  dateShiftDays: 0,
  floatErosionDays: 0,
  logicChanged: false,
  constraintsChanged: false,
  calendarChanged: false,
  wbsPrefix: "",
  taskName: "",
  discipline: "",
  area: "",
  minAbsFinishShiftDays: 0,
  minAbsStartShiftDays: 0,
  confidenceMin: 0,
};

function cloneDefaultFilters(): FilterState {
  return { ...DEFAULT_FILTERS, changeTypes: [...DEFAULT_FILTERS.changeTypes] };
}

const DEFAULT_GROUP_STATUS: GroupStatus[] = [
  { group: "electrical", label: "Electrical", ready: false, latestRevisionId: null, latestRevisionCode: null, latestImportedAt: null, latestSourceFileName: null },
  { group: "mechanical", label: "Mechanical", ready: false, latestRevisionId: null, latestRevisionCode: null, latestImportedAt: null, latestSourceFileName: null },
  { group: "construction", label: "Construction", ready: false, latestRevisionId: null, latestRevisionCode: null, latestImportedAt: null, latestSourceFileName: null },
];

function parseBoolQuery(value: string | null): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function parseNumberQuery(value: string | null, fallback = 0): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function filtersFromSearchParams(params: URLSearchParams): FilterState {
  const changeTypesRaw = (params.get("changeTypes") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const changeTypes = changeTypesRaw.filter((item): item is ChangeType => CHANGE_TYPE_OPTIONS.includes(item as ChangeType));
  return {
    search: params.get("search") || "",
    changeTypes: changeTypes.length > 0 ? changeTypes : [...CHANGE_TYPE_OPTIONS],
    onlyCritical: parseBoolQuery(params.get("onlyCritical") || params.get("criticalOnly")),
    onlyMilestones: parseBoolQuery(params.get("onlyMilestones") || params.get("milestonesOnly")),
    showAdded: params.get("showAdded") ? parseBoolQuery(params.get("showAdded")) : true,
    showRemoved: params.get("showRemoved") ? parseBoolQuery(params.get("showRemoved")) : true,
    dateShiftDays: parseNumberQuery(params.get("dateShiftDays"), 0),
    floatErosionDays: parseNumberQuery(params.get("floatErosionDays"), 0),
    logicChanged: parseBoolQuery(params.get("logicChanged")),
    constraintsChanged: parseBoolQuery(params.get("constraintsChanged")),
    calendarChanged: parseBoolQuery(params.get("calendarChanged")),
    wbsPrefix: params.get("wbsPrefix") || "",
    taskName: params.get("taskName") || "",
    discipline: params.get("discipline") || "",
    area: params.get("area") || "",
    minAbsFinishShiftDays: parseNumberQuery(params.get("minAbsFinishShiftDays"), 0),
    minAbsStartShiftDays: parseNumberQuery(params.get("minAbsStartShiftDays"), 0),
    confidenceMin: parseNumberQuery(params.get("confidenceMin"), 0),
  };
}

function formatDateTime(input: string): string {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(input: string | null): string {
  if (!input) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split("-");
    return `${day}.${month}.${year}`;
  }
  return input;
}

function parseYyMmDdToken(token: string): string | null {
  if (!/^\d{6}$/.test(token)) return null;
  const yy = Number(token.slice(0, 2));
  const year = yy >= 90 ? 1900 + yy : 2000 + yy;
  const month = Number(token.slice(2, 4));
  const day = Number(token.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateTokenFromFilename(fileName: string): string | null {
  const match = fileName.match(/-(\d{6})_rev/i);
  if (!match) return null;
  return parseYyMmDdToken(match[1]);
}

function sourceDisplayName(sourceFileName: string | null | undefined, sourceFilePath: string | null | undefined): string {
  const fileFromPath = sourceFilePath ? sourceFilePath.split("/").pop() || "" : "";
  const base = (sourceFileName || fileFromPath || "").trim();
  if (!base) return "-";
  return base.replace(/\.[^.]+$/, "");
}

function revisionDataDate(revision: Revision): string | null {
  return revision.dataDate || parseDateTokenFromFilename(revision.sourceFileName) || null;
}

function revisionSortTimestamp(revision: Revision): number {
  const dataDate = revisionDataDate(revision);
  if (dataDate) {
    const stamp = new Date(`${dataDate}T00:00:00Z`).getTime();
    if (!Number.isNaN(stamp)) return stamp;
  }
  const importedStamp = new Date(revision.importedAt).getTime();
  return Number.isNaN(importedStamp) ? 0 : importedStamp;
}

function pickDefaultRevisionPair(revisions: Revision[]): { oldId: string; newId: string } | null {
  if (revisions.length === 0) return null;
  if (revisions.length === 1) return { oldId: revisions[0].id, newId: revisions[0].id };
  const asc = [...revisions].sort((a, b) => {
    const byDate = revisionSortTimestamp(a) - revisionSortTimestamp(b);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
  return { oldId: asc[0].id, newId: asc[asc.length - 1].id };
}

function formatNumber(value: number | null, fallback = "-"): string {
  if (value === null || Number.isNaN(value)) return fallback;
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, "0")}`;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function sameNumeric(oldValue: number | null, newValue: number | null): boolean {
  if (oldValue === null && newValue === null) return true;
  if (oldValue === null || newValue === null) return false;
  return Number(oldValue) === Number(newValue);
}

function pickCurrentValue<T>(newValue: T | null, oldValue: T | null): T | null {
  return newValue ?? oldValue;
}

function formatPercentChange(oldValue: number | null, newValue: number | null): string {
  if (sameNumeric(oldValue, newValue)) return formatPercent(pickCurrentValue(newValue, oldValue));
  const oldText = formatPercent(oldValue);
  const newText = formatPercent(newValue);
  if (oldValue === null || newValue === null) return `${oldText} → ${newText}`;
  const delta = Number((newValue - oldValue).toFixed(2));
  return `${oldText} → ${newText}${delta === 0 ? "" : ` (${delta > 0 ? "+" : ""}${delta}%)`}`;
}

function formatDurationChange(oldDuration: number | null, newDuration: number | null): string {
  if (sameNumeric(oldDuration, newDuration)) return formatNumber(pickCurrentValue(newDuration, oldDuration));
  const oldText = formatNumber(oldDuration);
  const newText = formatNumber(newDuration);
  if (oldDuration === null || newDuration === null) return `${oldText} → ${newText}`;
  const delta = Number((newDuration - oldDuration).toFixed(2));
  return delta === 0 ? `${oldText} → ${newText}` : `${oldText} → ${newText} (${formatDelta(delta)})`;
}

function formatFullLogicList(values: string[]): string {
  if (!values || values.length === 0) return "-";
  return values.join(", ");
}

function sameStringValue(oldValue: string | null, newValue: string | null): boolean {
  if (oldValue === null && newValue === null) return true;
  if (oldValue === null || newValue === null) return false;
  return oldValue === newValue;
}

function formatDateChange(oldValue: string | null, newValue: string | null): string {
  if (sameStringValue(oldValue, newValue)) return formatDate(pickCurrentValue(newValue, oldValue));
  return `${formatDate(oldValue)} → ${formatDate(newValue)}`;
}

function normalizedList(values: string[]): string[] {
  return values.map((item) => item.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function listsEqual(oldValues: string[], newValues: string[]): boolean {
  const oldNorm = normalizedList(oldValues);
  const newNorm = normalizedList(newValues);
  if (oldNorm.length !== newNorm.length) return false;
  for (let i = 0; i < oldNorm.length; i += 1) {
    if (oldNorm[i] !== newNorm[i]) return false;
  }
  return true;
}

function booleanLabel(value: boolean | null): string {
  if (value === null) return "-";
  return value ? "Yes" : "No";
}

function changeBadgeClass(changeType: ChangeType): string {
  if (changeType === "ADDED") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/40";
  if (changeType === "REMOVED") return "bg-rose-500/20 text-rose-300 border-rose-400/40";
  return "bg-sky-500/20 text-sky-300 border-sky-400/40";
}

function metricStatusClass(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "yellow") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-rose-500/15 text-rose-300 border-rose-400/30";
}

function compareValue(row: CompareRow, key: SortKey): string | number {
  switch (key) {
    case "wbs":
      return row.wbs || "";
    case "progressNew":
      return row.progressNew ?? -1;
    case "taskName":
      return row.taskName || "";
    case "changeType":
      return row.changeType || "";
    case "finishShiftDays":
      return row.finishShiftDays ?? -999999;
    case "floatDelta":
      return row.floatDelta ?? 999999;
    case "severityScore":
      return row.severityScore ?? 0;
    case "predCountNew":
      return row.predCountNew ?? 0;
    case "succCountNew":
      return row.succCountNew ?? 0;
    default:
      return "";
  }
}

function evaluateNewMspQuality(result: CompareResult | null): QualityGateVerdict | null {
  if (!result) return null;
  const metrics = result.qualityMetrics ?? [];
  if (metrics.length === 0) {
    return {
      score: 100,
      level: "acceptable",
      message: "Acceptable.",
    };
  }

  let penalty = 0;
  for (const metric of metrics) {
    if (metric.status === "red") penalty += 28;
    else if (metric.status === "yellow") penalty += 12;
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  if (score < 50) {
    return {
      score,
      level: "alarm",
      message: "Red alarm (<50%). Human confirmation required.",
    };
  }
  if (score < 80) {
    return {
      score,
      level: "warning",
      message: "Warning (<80%). Human confirmation required.",
    };
  }
  return {
    score,
    level: "acceptable",
    message: "Acceptable.",
  };
}

export default function ScheduleControlWorkspace(): React.ReactElement {
  const searchParams = useSearchParams();
  const initialSearchRef = useRef<URLSearchParams | null>(null);
  if (!initialSearchRef.current) {
    initialSearchRef.current = new URLSearchParams(searchParams.toString());
  }

  const [loadingRevisions, setLoadingRevisions] = useState(true);
  const [revisionsPayload, setRevisionsPayload] = useState<RevisionsPayload | null>(null);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);

  const [oldRevisionId, setOldRevisionId] = useState(initialSearchRef.current.get("baselineRevId") || "");
  const [newRevisionId, setNewRevisionId] = useState(initialSearchRef.current.get("updateRevId") || "");
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importRevisionCode, setImportRevisionCode] = useState("U01");
  const [importRevisionType, setImportRevisionType] = useState<RevisionType>("update");
  const [importGroup, setImportGroup] = useState<ScheduleGroup>("electrical");
  const [importComment, setImportComment] = useState("");
  const [importedBy, setImportedBy] = useState("planner");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [assembleMessage, setAssembleMessage] = useState<string | null>(null);
  const [assembleError, setAssembleError] = useState<string | null>(null);

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRows, setAuditRows] = useState<
    Array<{ id: string; type: string; status: string; started_at: string; finished_at: string | null; request_meta: Record<string, unknown> | null }>
  >([]);

  const [filters, setFilters] = useState<FilterState>(() => filtersFromSearchParams(initialSearchRef.current || new URLSearchParams()));

  const [sortKey, setSortKey] = useState<SortKey>("severityScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [selectedRow, setSelectedRow] = useState<CompareRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<(typeof DRAWER_TABS)[number]>("Overview");
  const [currentPage, setCurrentPage] = useState(1);

  const revisions = revisionsPayload?.revisions ?? [];
  const groupStatus = revisionsPayload?.groupStatus?.length ? revisionsPayload.groupStatus : DEFAULT_GROUP_STATUS;
  const canAssembleMergedSchedule = (revisionsPayload?.canAssembleMergedSchedule ?? false) && groupStatus.every((item) => item.ready);
  const selectedOld = revisions.find((row) => row.id === oldRevisionId) ?? null;
  const selectedNew = revisions.find((row) => row.id === newRevisionId) ?? null;
  const oldRevisionDate = selectedOld ? revisionDataDate(selectedOld) : null;
  const newRevisionDate = selectedNew ? revisionDataDate(selectedNew) : null;
  const compareDateError =
    oldRevisionDate && newRevisionDate && oldRevisionDate >= newRevisionDate
      ? `Baseline revision must be older than update revision. Selected baseline ${formatDate(oldRevisionDate)} and update ${formatDate(newRevisionDate)}.`
      : null;
  const canCompare = Boolean(oldRevisionId && newRevisionId && oldRevisionId !== newRevisionId && !compareDateError);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingRevisions(true);
      setRevisionsError(null);
      try {
        const res = await fetch(`/api/schedule/revisions?projectCode=${encodeURIComponent(PROJECT_CODE)}`, { cache: "no-store" });
        const json = (await res.json()) as { ok?: boolean; error?: string; data?: RevisionsPayload };
        if (!res.ok || !json.ok || !json.data) throw new Error(json.error || "Failed to load revisions");
        if (cancelled) return;
        setRevisionsPayload(json.data);

        const defaults = pickDefaultRevisionPair(json.data.revisions);
        if (defaults) {
          setOldRevisionId(defaults.oldId);
          setNewRevisionId(defaults.newId);
        }
      } catch (error) {
        if (!cancelled) setRevisionsError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoadingRevisions(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const runCompare = useCallback(async () => {
    if (!oldRevisionId || !newRevisionId || oldRevisionId === newRevisionId) return;
    if (compareDateError) {
      setCompareError(compareDateError);
      return;
    }
    setComparing(true);
    setCompareError(null);
    try {
      const res = await fetch("/api/schedule/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectCode: PROJECT_CODE,
          oldRevisionId,
          newRevisionId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: CompareResult };
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error || "Compare failed");
      setCompareResult(json.data);
      setSelectedRow(null);
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : String(error));
      setCompareResult(null);
    } finally {
      setComparing(false);
    }
  }, [compareDateError, newRevisionId, oldRevisionId]);

  useEffect(() => {
    if (!newRevisionId || !oldRevisionId) return;
    if (oldRevisionId === newRevisionId) return;
    if (compareDateError) return;
    void runCompare();
  }, [compareDateError, newRevisionId, oldRevisionId, runCompare]);

  async function openAuditLog() {
    setAuditOpen(true);
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/schedule/audit-log?projectCode=${encodeURIComponent(PROJECT_CODE)}`, { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: Array<{
          id: string;
          type: string;
          status: string;
          started_at: string;
          finished_at: string | null;
          request_meta: Record<string, unknown> | null;
        }>;
      };
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error || "Failed to load audit log");
      setAuditRows(json.data);
    } catch (error) {
      setAuditRows([
        {
          id: "error",
          type: "error",
          status: "failed",
          started_at: new Date().toISOString(),
          finished_at: null,
          request_meta: { message: error instanceof Error ? error.message : String(error) },
        },
      ]);
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleImportFile(file: File) {
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    setImportError(null);
    setAssembleMessage(null);
    setAssembleError(null);

    try {
      const body = new FormData();
      body.append("projectCode", PROJECT_CODE);
      body.append("revisionCode", importRevisionCode.trim());
      body.append("revisionType", importRevisionType);
      body.append("group", importGroup);
      body.append("comment", importComment.trim());
      body.append("importedBy", importedBy.trim());
      body.append("file", file);

      const res = await fetch("/api/schedule/import", { method: "POST", body });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: { parsedTasks?: number; warnings?: string[] } };
      if (!res.ok || !json.ok) throw new Error(json.error || "Import failed");

      const parsed = json.data?.parsedTasks ?? 0;
      const warnings = (json.data?.warnings ?? []).length;
      setImportMessage(`Imported ${file.name}. Parsed tasks: ${parsed}.${warnings ? ` Warnings: ${warnings}.` : ""}`);
      setImportOpen(false);
      setImportComment("");

      const refreshRes = await fetch(`/api/schedule/revisions?projectCode=${encodeURIComponent(PROJECT_CODE)}`, { cache: "no-store" });
      const refreshJson = (await refreshRes.json()) as { ok?: boolean; data?: RevisionsPayload; error?: string };
      if (refreshRes.ok && refreshJson.ok && refreshJson.data) {
        setRevisionsPayload(refreshJson.data);
        const defaults = pickDefaultRevisionPair(refreshJson.data.revisions);
        if (defaults) {
          setOldRevisionId(defaults.oldId);
          setNewRevisionId(defaults.newId);
        }
        if (refreshJson.data.canAssembleMergedSchedule) {
          void assembleMergedSchedule(true);
        }
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  function runExport(mode: ExportMode) {
    if (!oldRevisionId || !newRevisionId) return;
    const url =
      `/api/schedule/compare/export?projectCode=${encodeURIComponent(PROJECT_CODE)}` +
      `&oldRevisionId=${encodeURIComponent(oldRevisionId)}&newRevisionId=${encodeURIComponent(newRevisionId)}` +
      `&mode=${mode}`;
    window.open(url, "_blank");
  }

  async function assembleMergedSchedule(autoTriggered = false) {
    if (assembling) return;
    setAssembling(true);
    if (!autoTriggered) {
      setAssembleMessage(null);
      setAssembleError(null);
    }
    try {
      const res = await fetch("/api/schedule/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectCode: PROJECT_CODE,
          importedBy: importedBy.trim() || "schedule-merge-bot",
          comment: "Auto-combined from Electrical / Mechanical / Construction imports.",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: { revision?: { revisionCode?: string; sourceFileName?: string }; mergedTaskCount?: number };
      };
      if (!res.ok || !json.ok || !json.data?.revision) throw new Error(json.error || "Failed to create merged schedule.");

      const mergedCode = json.data.revision.revisionCode || "-";
      const mergedFile = json.data.revision.sourceFileName || "-";
      const mergedCount = json.data.mergedTaskCount ?? 0;
      setAssembleMessage(`Combined schedule created (${mergedCode}) · ${mergedFile} · tasks: ${mergedCount}.`);

      const refreshRes = await fetch(`/api/schedule/revisions?projectCode=${encodeURIComponent(PROJECT_CODE)}`, { cache: "no-store" });
      const refreshJson = (await refreshRes.json()) as { ok?: boolean; data?: RevisionsPayload; error?: string };
      if (refreshRes.ok && refreshJson.ok && refreshJson.data) {
        setRevisionsPayload(refreshJson.data);
        const defaults = pickDefaultRevisionPair(refreshJson.data.revisions);
        if (defaults) {
          setOldRevisionId(defaults.oldId);
          setNewRevisionId(defaults.newId);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!autoTriggered) setAssembleError(message);
    } finally {
      setAssembling(false);
    }
  }

  const filteredRows = useMemo(() => {
    const rows = compareResult?.rows ?? [];
    return rows.filter((row) => {
      if (!filters.changeTypes.includes(row.changeType)) return false;
      if (filters.onlyCritical && !(row.criticalPathImpacted || row.criticalNew || row.criticalOld)) return false;
      if (filters.onlyMilestones && !(row.milestoneOld || row.milestoneNew || row.milestoneMoved)) return false;
      if (filters.logicChanged && !row.logicChanged) return false;
      if (filters.constraintsChanged && !row.constraintsChanged) return false;
      if (filters.calendarChanged && !row.calendarChanged) return false;
      if (filters.dateShiftDays > 0) {
        const shift = Math.max(Math.abs(row.finishShiftDays ?? 0), Math.abs(row.startShiftDays ?? 0));
        if (shift <= filters.dateShiftDays) return false;
      }
      if (filters.floatErosionDays > 0) {
        if (!((row.floatDelta ?? 0) < -filters.floatErosionDays)) return false;
      }
      if (filters.wbsPrefix && !row.wbs.toLowerCase().startsWith(filters.wbsPrefix.toLowerCase())) return false;
      if (filters.taskName && !row.taskName.toLowerCase().includes(filters.taskName.toLowerCase())) return false;
      if (filters.discipline) {
        const discipline = `${row.disciplineOld || ""} ${row.disciplineNew || ""}`.toLowerCase();
        if (!discipline.includes(filters.discipline.toLowerCase())) return false;
      }
      if (filters.area) {
        const area = `${row.areaOld || ""} ${row.areaNew || ""}`.toLowerCase();
        if (!area.includes(filters.area.toLowerCase())) return false;
      }
      if (filters.search) {
        const hay = `${row.wbs} ${row.taskName} ${row.oldId || ""} ${row.newId || ""}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [compareResult?.rows, filters]);

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      const av = compareValue(a, sortKey);
      const bv = compareValue(b, sortKey);
      let base = 0;
      if (typeof av === "number" && typeof bv === "number") base = av - bv;
      else base = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? base : -base;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortDir, sortKey, compareResult?.comparedAt]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const oldSelectedMeta = selectedOld ? `${selectedOld.revisionCode} • ${formatDate(revisionDataDate(selectedOld))}` : "-";
  const newSelectedMeta = selectedNew ? `${selectedNew.revisionCode} • ${formatDate(revisionDataDate(selectedNew))}` : "-";
  const qualityGate = useMemo(() => evaluateNewMspQuality(compareResult), [compareResult]);

  function isKpiActive(id: string): boolean {
    if (id === "added") return sameChangeTypeSet(filters.changeTypes, ["ADDED"]);
    if (id === "removed") return sameChangeTypeSet(filters.changeTypes, ["REMOVED"]);
    if (id === "modified") return sameChangeTypeSet(filters.changeTypes, MODIFIED_CHANGE_TYPES);
    if (id === "criticalPath") return filters.onlyCritical;
    if (id === "floatErosion") return filters.floatErosionDays > 0;
    if (id === "logicChanged") return filters.logicChanged;
    if (id === "constraintsChanged") return filters.constraintsChanged;
    if (id === "calendarChanged") return filters.calendarChanged;
    if (id === "milestonesMoved") return filters.onlyMilestones;
    return false;
  }

  function applyKpiFilter(id: string) {
    setFilters((current) => {
      if (id === "added") {
        const isActive = sameChangeTypeSet(current.changeTypes, ["ADDED"]);
        return isActive ? cloneDefaultFilters() : { ...current, changeTypes: ["ADDED"] };
      }
      if (id === "removed") {
        const isActive = sameChangeTypeSet(current.changeTypes, ["REMOVED"]);
        return isActive ? cloneDefaultFilters() : { ...current, changeTypes: ["REMOVED"] };
      }
      if (id === "modified") {
        const isActive = sameChangeTypeSet(current.changeTypes, MODIFIED_CHANGE_TYPES);
        return isActive ? cloneDefaultFilters() : { ...current, changeTypes: [...MODIFIED_CHANGE_TYPES] };
      }
      if (id === "criticalPath") return { ...current, onlyCritical: !current.onlyCritical };
      if (id === "floatErosion") return { ...current, floatErosionDays: current.floatErosionDays === 5 ? 0 : 5 };
      if (id === "logicChanged") return { ...current, logicChanged: !current.logicChanged };
      if (id === "constraintsChanged") return { ...current, constraintsChanged: !current.constraintsChanged };
      if (id === "calendarChanged") return { ...current, calendarChanged: !current.calendarChanged };
      if (id === "milestonesMoved") return { ...current, onlyMilestones: !current.onlyMilestones };
      return current;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  }

  return (
    <div className="max-w-full min-w-0 space-y-6">
      <section className="sticky top-16 z-10 max-w-full rounded-3xl border border-white/15 bg-[linear-gradient(180deg,rgba(12,17,27,0.96)_0%,rgba(7,10,17,0.95)_100%)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Schedule Control</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Baseline vs update revision proof, impact diagnostics, and claims-grade compare outputs.
            </p>
            {revisionsPayload?.latestMsProjectPath ? (
              <p className="mt-1 text-xs text-sky-300">Latest MSP source: {revisionsPayload.latestMsProjectPath}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">
            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Project Context</div>
            <div className="mt-1 font-medium text-zinc-100">{revisionsPayload?.projectName || "A27 Project"}</div>
            <div className="mt-1 text-xs text-zinc-400">Project: {PROJECT_CODE}</div>
            <div className="mt-1 text-xs text-zinc-400">
              Cutoff: {compareResult?.cutoffDate ? formatDate(compareResult.cutoffDate) : revisionsPayload?.latestCutoffDate || "-"}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Week:{" "}
              {compareResult?.cutoffWeek && compareResult?.totalProjectWeeks
                ? `W ${compareResult.cutoffWeek}/${compareResult.totalProjectWeeks}`
                : "-"}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Update start: {formatDate(compareResult?.newProjectStart ?? null)}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              Update finish: {formatDate(compareResult?.newProjectFinish ?? null)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-sky-400/30 bg-sky-500/20 px-2 py-0.5 text-xs">
                Baseline {selectedOld?.revisionCode || "-"}
              </span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-xs">
                Update {selectedNew?.revisionCode || "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto]">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-zinc-500">Baseline / Old Revision</div>
            <select
              value={oldRevisionId}
              onChange={(event) => setOldRevisionId(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              <option value="">Select baseline revision</option>
              {revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  {revision.revisionCode} • {formatDate(revisionDataDate(revision))}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">{oldSelectedMeta}</div>
            <div className="mt-1 truncate text-[11px] text-zinc-600" title={selectedOld?.sourceFilePath || ""}>
              {selectedOld ? `Source: ${sourceDisplayName(selectedOld.sourceFileName, selectedOld.sourceFilePath)}` : ""}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="mb-1 text-xs uppercase tracking-[0.12em] text-zinc-500">Update / New Revision</div>
            <select
              value={newRevisionId}
              onChange={(event) => setNewRevisionId(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              <option value="">Select update revision</option>
              {revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  {revision.revisionCode} • {formatDate(revisionDataDate(revision))}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">{newSelectedMeta}</div>
            <div className="mt-1 truncate text-[11px] text-zinc-600" title={selectedNew?.sourceFilePath || ""}>
              {selectedNew ? `Source: ${sourceDisplayName(selectedNew.sourceFileName, selectedNew.sourceFilePath)}` : ""}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void runCompare()}
            disabled={!canCompare || comparing}
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-zinc-100 px-5 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
            Compare
          </button>

          <button
            type="button"
            onClick={() => setImportOpen((open) => !open)}
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-black/30 px-4 text-sm text-zinc-100 hover:bg-black/50"
          >
            <Upload className="h-4 w-4" />
            Import schedule
          </button>

          <button
            type="button"
            onClick={openAuditLog}
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-black/30 px-4 text-sm text-zinc-100 hover:bg-black/50"
          >
            <ListChecks className="h-4 w-4" />
            Open audit log
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {groupStatus.map((item) => (
            <button
              key={item.group}
              type="button"
              title={
                item.ready
                  ? `${item.label} ready · ${item.latestRevisionCode || "-"} · ${item.latestSourceFileName || "-"}`
                  : `${item.label} not ready`
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition",
                item.ready
                  ? "border-white/40 bg-white text-black"
                  : "border-white/15 bg-black/35 text-zinc-300"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  item.ready ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "bg-zinc-500"
                )}
              />
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => void assembleMergedSchedule(false)}
            disabled={!canAssembleMergedSchedule || assembling}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {assembling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Create Combined MSP
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runExport("full")}
            disabled={!compareResult}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-zinc-100 hover:bg-black/50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export compare (full)
          </button>
          <button
            type="button"
            onClick={() => runExport("critical")}
            disabled={!compareResult}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-zinc-100 hover:bg-black/50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export critical
          </button>
          <button
            type="button"
            onClick={() => runExport("milestones")}
            disabled={!compareResult}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-zinc-100 hover:bg-black/50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export milestones
          </button>
        </div>

        {importOpen ? (
          <div className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-500/10 p-3">
            <div className="grid gap-3 md:grid-cols-5">
              <label className="space-y-1 text-xs text-zinc-300">
                Revision code
                <input
                  value={importRevisionCode}
                  onChange={(event) => setImportRevisionCode(event.target.value)}
                  placeholder="B03 or U07"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-300">
                Revision type
                <select
                  value={importRevisionType}
                  onChange={(event) => setImportRevisionType(event.target.value as RevisionType)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
                >
                  <option value="baseline">Baseline</option>
                  <option value="update">Update</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-zinc-300">
                Group
                <select
                  value={importGroup}
                  onChange={(event) => setImportGroup(event.target.value as ScheduleGroup)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
                >
                  <option value="electrical">Electrical</option>
                  <option value="mechanical">Mechanical</option>
                  <option value="construction">Construction</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-zinc-300">
                Imported by
                <input
                  value={importedBy}
                  onChange={(event) => setImportedBy(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-zinc-300">
                Source file
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 hover:bg-black/50 disabled:opacity-50"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload XML / Excel / CSV / MPP
                </button>
              </label>
            </div>
            <label className="mt-3 block space-y-1 text-xs text-zinc-300">
              Comment
              <input
                value={importComment}
                onChange={(event) => setImportComment(event.target.value)}
                placeholder="Revision note used in compare selector tooltip."
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
              />
            </label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xml,.xlsx,.xls,.xlsm,.csv,.mpp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) void handleImportFile(file);
              }}
            />
          </div>
        ) : null}

        {importMessage ? <div className="mt-3 text-xs text-emerald-300">{importMessage}</div> : null}
        {assembleMessage ? <div className="mt-3 text-xs text-emerald-300">{assembleMessage}</div> : null}
        {importError ? <div className="mt-3 text-xs text-rose-300">{importError}</div> : null}
        {assembleError ? <div className="mt-3 text-xs text-rose-300">{assembleError}</div> : null}
        {compareDateError ? <div className="mt-3 text-xs text-amber-300">{compareDateError}</div> : null}
        {compareError ? <div className="mt-3 text-xs text-rose-300">{compareError}</div> : null}
        {qualityGate ? (
          <div
            className={cn(
              "mt-2 rounded-xl border px-2.5 py-1.5 text-[11px]",
              qualityGate.level === "alarm"
                ? "border-rose-400/35 bg-rose-500/15 text-rose-100"
                : qualityGate.level === "warning"
                  ? "border-amber-400/35 bg-amber-500/15 text-amber-100"
                  : "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.08em]">Quality</span>
              <span className="rounded-full border border-current/40 px-1.5 py-0.5 text-[10px] font-semibold">Quality: {qualityGate.score}%</span>
            </div>
            <div className="mt-0.5">{qualityGate.message}</div>
          </div>
        ) : null}
        {loadingRevisions ? <div className="mt-3 text-xs text-zinc-400">Loading revision list…</div> : null}
        {revisionsError ? <div className="mt-3 text-xs text-rose-300">{revisionsError}</div> : null}
      </section>

      <section className="max-w-full rounded-3xl border border-white/10 bg-card/80 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
          <CircleGauge className="h-3.5 w-3.5" />
          Schedule quality / manipulation signals
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {(compareResult?.qualityMetrics ?? []).map((metric) => (
            <div key={metric.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-zinc-400">{metric.label}</div>
              <div className="mt-1 text-sm text-zinc-200">
                {formatNumber(metric.oldValue)} → {formatNumber(metric.newValue)}
              </div>
              <div className="mt-2">
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs", metricStatusClass(metric.status))}>
                  {metric.delta > 0 ? "+" : ""}
                  {metric.delta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-full space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Quick Filters</div>
          <button
            type="button"
            onClick={() => setFilters(cloneDefaultFilters())}
            className="rounded-xl border border-white/20 bg-black/25 px-3 py-1.5 text-xs text-zinc-200 hover:bg-black/45"
          >
            Clear filters
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {(compareResult?.kpis ?? []).map((kpi) => {
            const active = isKpiActive(kpi.id);
            return (
              <button
                key={kpi.id}
                type="button"
                onClick={() => applyKpiFilter(kpi.id)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-sky-300/45 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.2)_inset]"
                    : "border-white/10 bg-card/70 hover:border-sky-300/30 hover:bg-card"
                )}
              >
                <div className="text-xs uppercase tracking-[0.1em] text-zinc-400">{kpi.label}</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-100">{kpi.count}</div>
                <div className="mt-1 text-xs text-zinc-400">{kpi.deltaText}</div>
                <div className="mt-1 text-xs text-sky-300">{kpi.topDriver}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="max-w-full rounded-3xl border border-white/10 bg-card/85 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Main changes table</div>
            <div className="mt-1 text-sm text-zinc-300">
              Rows {sortedRows.length} / {compareResult?.rows.length ?? 0} · Page {safePage}/{totalPages}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
            Click a row to open proof drawer (logic, constraints, audit, mini Gantt).
          </div>
        </div>

        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-zinc-400">
            {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, sortedRows.length)} of {sortedRows.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-1 text-xs text-zinc-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>

        <div className="max-w-full overflow-hidden rounded-2xl border border-white/10">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1880px]">
              <div
                className="grid border-b border-white/10 bg-zinc-900/80 px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400"
                style={{ gridTemplateColumns: TABLE_GRID_TEMPLATE }}
              >
                <HeaderButton label="WBS" active={sortKey === "wbs"} dir={sortDir} onClick={() => toggleSort("wbs")} />
                <HeaderButton label="Progress %" active={sortKey === "progressNew"} dir={sortDir} onClick={() => toggleSort("progressNew")} />
                <HeaderButton label="Task Name" active={sortKey === "taskName"} dir={sortDir} onClick={() => toggleSort("taskName")} />
                <HeaderButton label="Start" active={false} dir={sortDir} onClick={() => null} />
                <HeaderButton label="Finish" active={sortKey === "finishShiftDays"} dir={sortDir} onClick={() => toggleSort("finishShiftDays")} />
                <HeaderButton label="Duration (d)" active={false} dir={sortDir} onClick={() => null} />
                <HeaderButton label="Predecessors (old → new)" active={sortKey === "predCountNew"} dir={sortDir} onClick={() => toggleSort("predCountNew")} />
                <HeaderButton label="Successors (old → new)" active={sortKey === "succCountNew"} dir={sortDir} onClick={() => toggleSort("succCountNew")} />
                <HeaderButton label="Type" active={sortKey === "changeType"} dir={sortDir} onClick={() => toggleSort("changeType")} />
              </div>

              <div className="max-h-[640px] overflow-y-auto scrollbar-thin">
                {pagedRows.map((row, rowIndex) => (
                  <button
                    key={`${row.rowId}::${pageStart + rowIndex}`}
                    type="button"
                    onClick={() => {
                      setSelectedRow(row);
                      setDrawerTab("Overview");
                    }}
                    style={{ gridTemplateColumns: TABLE_GRID_TEMPLATE }}
                    className={cn(
                      "grid w-full items-start gap-2 border-b border-white/5 px-3 py-2 text-left text-sm transition hover:bg-sky-500/10",
                      selectedRow?.rowId === row.rowId ? "bg-sky-500/15" : ""
                    )}
                  >
                    <div className="font-medium text-zinc-100">{row.wbs || "-"}</div>
                    <div className="text-xs text-zinc-300">{formatPercentChange(row.progressOld, row.progressNew)}</div>
                    <div className="text-zinc-100">{row.taskName}</div>
                    <div className="text-xs text-zinc-300 leading-5">
                      {formatDateChange(row.oldStart, row.newStart)}
                    </div>
                    <div className="text-xs text-zinc-300 leading-5">
                      {formatDateChange(row.oldFinish, row.newFinish)}
                    </div>
                    <div className="text-xs text-zinc-300">{formatDurationChange(row.durationOld, row.durationNew)}</div>
                    {listsEqual(row.predecessorsOld, row.predecessorsNew) ? (
                      <div className="text-[11px] leading-5 text-zinc-300">
                        {formatFullLogicList(row.predecessorsNew.length ? row.predecessorsNew : row.predecessorsOld)}
                      </div>
                    ) : (
                      <div className="text-[11px] leading-5 text-zinc-300">
                        <div>
                          <span className="text-zinc-500">Old:</span> {formatFullLogicList(row.predecessorsOld)}
                        </div>
                        <div>
                          <span className="text-zinc-500">New:</span> {formatFullLogicList(row.predecessorsNew)}
                        </div>
                      </div>
                    )}
                    {listsEqual(row.successorsOld, row.successorsNew) ? (
                      <div className="text-[11px] leading-5 text-zinc-300">
                        {formatFullLogicList(row.successorsNew.length ? row.successorsNew : row.successorsOld)}
                      </div>
                    ) : (
                      <div className="text-[11px] leading-5 text-zinc-300">
                        <div>
                          <span className="text-zinc-500">Old:</span> {formatFullLogicList(row.successorsOld)}
                        </div>
                        <div>
                          <span className="text-zinc-500">New:</span> {formatFullLogicList(row.successorsNew)}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs", changeBadgeClass(row.changeType))}>{row.changeType}</span>
                    </div>
                  </button>
                ))}
                {pagedRows.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-zinc-400">
                    No rows match current filters.
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setFilters(cloneDefaultFilters())}
                        className="rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-zinc-200 hover:bg-black/45"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {compareResult?.warnings?.length ? (
        <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.12em]">
            <AlertTriangle className="h-4 w-4" />
            Compare warnings
          </div>
          <ul className="space-y-1 text-xs text-amber-200">
            {compareResult.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {auditOpen ? (
        <RightSideDrawer title="Schedule Audit Log" onClose={() => setAuditOpen(false)}>
          {auditLoading ? (
            <div className="text-sm text-zinc-400">Loading audit log…</div>
          ) : (
            <div className="space-y-2">
              {auditRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-100">{row.type}</div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        row.status === "succeeded"
                          ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-300"
                          : row.status === "running"
                            ? "border-sky-400/30 bg-sky-500/20 text-sky-300"
                            : "border-rose-400/30 bg-rose-500/20 text-rose-300"
                      )}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {formatDateTime(row.started_at)} {row.finished_at ? `→ ${formatDateTime(row.finished_at)}` : ""}
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-zinc-300">
                    {JSON.stringify(row.request_meta || {}, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </RightSideDrawer>
      ) : null}

      {selectedRow ? (
        <RightSideDrawer
          title={`${selectedRow.wbs || "Task"} · ${selectedRow.taskName}`}
          onClose={() => {
            setSelectedRow(null);
          }}
        >
          <div className="mb-3 flex flex-wrap gap-1">
            {DRAWER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDrawerTab(tab)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs",
                  drawerTab === tab ? "border-white/30 bg-zinc-100 text-black" : "border-white/10 bg-black/30 text-zinc-300 hover:border-white/25"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {drawerTab === "Overview" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Severity score</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-100">{selectedRow.severityScore}</div>
                <div className="mt-1 text-xs text-zinc-400">{selectedRow.changeType} · claims-grade compare signal</div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <DiffBlock label="Task IDs" oldValue={selectedRow.oldId} newValue={selectedRow.newId} />
                <DiffBlock label="Dates" oldValue={`${formatDate(selectedRow.oldStart)} → ${formatDate(selectedRow.oldFinish)}`} newValue={`${formatDate(selectedRow.newStart)} → ${formatDate(selectedRow.newFinish)}`} />
                <DiffBlock label="Progress (%)" oldValue={formatPercent(selectedRow.progressOld)} newValue={formatPercent(selectedRow.progressNew)} />
                <DiffBlock label="Duration (days)" oldValue={formatNumber(selectedRow.durationOld)} newValue={formatNumber(selectedRow.durationNew)} />
                <DiffBlock label="Total Float (days)" oldValue={formatNumber(selectedRow.totalFloatOld)} newValue={formatNumber(selectedRow.totalFloatNew)} />
                <DiffBlock label="Critical" oldValue={booleanLabel(selectedRow.criticalOld)} newValue={booleanLabel(selectedRow.criticalNew)} />
                <DiffBlock
                  label="Constraint"
                  oldValue={`${selectedRow.constraintTypeOld || "-"} ${selectedRow.constraintDateOld || ""}`.trim()}
                  newValue={`${selectedRow.constraintTypeNew || "-"} ${selectedRow.constraintDateNew || ""}`.trim()}
                />
              </div>
            </div>
          ) : null}

          {drawerTab === "Dates & Float" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-zinc-300">
                <div>Start shift: {selectedRow.startShiftDays === null ? "-" : `${selectedRow.startShiftDays > 0 ? "+" : ""}${selectedRow.startShiftDays} days`}</div>
                <div className="mt-1">Finish shift: {selectedRow.finishShiftDays === null ? "-" : `${selectedRow.finishShiftDays > 0 ? "+" : ""}${selectedRow.finishShiftDays} days`}</div>
                <div className="mt-1">Float delta: {selectedRow.floatDelta === null ? "-" : `${selectedRow.floatDelta > 0 ? "+" : ""}${selectedRow.floatDelta} days`}</div>
              </div>

              <MiniDiffGantt row={selectedRow} />
            </div>
          ) : null}

          {drawerTab === "Logic Diff" ? (
            <div className="space-y-3 text-sm">
              <LogicList title="Predecessors added" items={selectedRow.predecessorsAdded} emptyText="No predecessors added." />
              <LogicList title="Predecessors removed" items={selectedRow.predecessorsRemoved} emptyText="No predecessors removed." />
              <LogicList title="Successors added" items={selectedRow.successorsAdded} emptyText="No successors added." />
              <LogicList title="Successors removed" items={selectedRow.successorsRemoved} emptyText="No successors removed." />
              <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-zinc-300">
                <div>Relationship type changed: {selectedRow.relationshipTypeChanged ? "Yes" : "No"}</div>
                <div className="mt-1">Lag changed: {selectedRow.lagChanged ? "Yes" : "No"}</div>
                <div className="mt-1">Logic quality warning: {selectedRow.logicChanged ? "Review open ends and sequence integrity." : "No warning."}</div>
              </div>
            </div>
          ) : null}

          {drawerTab === "Constraints" ? (
            <div className="space-y-3">
              <DiffBlock
                label="Constraint type"
                oldValue={selectedRow.constraintTypeOld || "-"}
                newValue={selectedRow.constraintTypeNew || "-"}
              />
              <DiffBlock
                label="Constraint date"
                oldValue={selectedRow.constraintDateOld || "-"}
                newValue={selectedRow.constraintDateNew || "-"}
              />
              <DiffBlock
                label="Calendar"
                oldValue={selectedRow.calendarOld || "-"}
                newValue={selectedRow.calendarNew || "-"}
              />
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                Constraints often mask delay behavior. Any new hard constraint should be justified in revision comments.
              </div>
            </div>
          ) : null}

          {drawerTab === "Audit" ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-zinc-300">
                <div>Old revision: {selectedOld?.revisionCode || "-"}</div>
                <div className="mt-1">New revision: {selectedNew?.revisionCode || "-"}</div>
                <div className="mt-1">Compared at: {compareResult?.comparedAt ? formatDateTime(compareResult.comparedAt) : "-"}</div>
                <div className="mt-1">
                  Source files: {sourceDisplayName(selectedOld?.sourceFileName, selectedOld?.sourceFilePath)} /{" "}
                  {sourceDisplayName(selectedNew?.sourceFileName, selectedNew?.sourceFilePath)}
                </div>
                <div className="mt-1">Checksums: {selectedOld?.checksum || "-"} / {selectedNew?.checksum || "-"}</div>
                <div className="mt-1">Export reference: {selectedRow.rowId}</div>
              </div>
            </div>
          ) : null}
        </RightSideDrawer>
      ) : null}
    </div>
  );
}

function HeaderButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-left hover:text-zinc-200">
      <span>{label}</span>
      {active ? <ChevronDown className={cn("h-3 w-3 transition", dir === "asc" ? "rotate-180" : "")} /> : null}
    </button>
  );
}

function RightSideDrawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-[620px] flex-col border-l border-white/10 bg-[linear-gradient(180deg,#0c111c_0%,#070b13_100%)] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="text-sm font-medium text-zinc-100">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-black/50"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5 scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}

function DiffBlock({ label, oldValue, newValue }: { label: string; oldValue: string | null; newValue: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
      <div className="text-xs uppercase tracking-[0.08em] text-zinc-500">{label}</div>
      <div className="mt-2 text-zinc-300">
        <div className="text-xs text-zinc-500">Old</div>
        <div>{oldValue || "-"}</div>
      </div>
      <div className="mt-2 text-zinc-200">
        <div className="text-xs text-zinc-500">New</div>
        <div>{newValue || "-"}</div>
      </div>
    </div>
  );
}

function LogicList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-xs uppercase tracking-[0.08em] text-zinc-500">{title}</div>
      {items.length === 0 ? (
        <div className="mt-2 text-xs text-zinc-400">{emptyText}</div>
      ) : (
        <ul className="mt-2 space-y-1 text-xs text-zinc-200">
          {items.map((item) => (
            <li key={item} className="rounded-lg border border-white/5 bg-black/25 px-2 py-1">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniDiffGantt({ row }: { row: CompareRow }) {
  const oldDuration = Math.max(1, Math.round(row.durationOld ?? 1));
  const newDuration = Math.max(1, Math.round(row.durationNew ?? 1));
  const shift = row.finishShiftDays ?? 0;
  const maxDuration = Math.max(oldDuration, newDuration) + Math.abs(shift);
  const oldWidth = (oldDuration / maxDuration) * 100;
  const newWidth = (newDuration / maxDuration) * 100;
  const newOffset = shift >= 0 ? (shift / maxDuration) * 100 : 0;
  const oldOffset = shift < 0 ? (Math.abs(shift) / maxDuration) * 100 : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.08em] text-zinc-500">
        <span>Difference Gantt</span>
        <span>{shift === 0 ? "No shift" : `${shift > 0 ? "+" : ""}${shift}d`}</span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">Old revision</div>
          <div className="relative h-5 rounded-lg bg-zinc-900">
            <div className="absolute top-0 h-5 rounded-lg bg-sky-500/60" style={{ left: `${oldOffset}%`, width: `${oldWidth}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-zinc-500">New revision</div>
          <div className="relative h-5 rounded-lg bg-zinc-900">
            <div
              className={cn("absolute top-0 h-5 rounded-lg", row.criticalPathImpacted ? "bg-rose-500/60 ring-1 ring-rose-300/60" : "bg-emerald-500/60")}
              style={{ left: `${newOffset}%`, width: `${newWidth}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-400">
        Old: {oldDuration}d · New: {newDuration}d · CP impacted: {row.criticalPathImpacted ? "Yes" : "No"}
      </div>
    </div>
  );
}
