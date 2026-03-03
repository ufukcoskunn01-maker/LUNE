export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  applyCompareFilters,
  buildCompareWorkbook,
  compareScheduleRevisions,
  type ScheduleChangeType,
  type ScheduleCompareFilters,
} from "@/lib/schedule-control";

type ExportMode = "full" | "critical" | "milestones";
type ExportFormat = "xlsx" | "csv";

function parseMode(raw: string | null): ExportMode {
  if (raw === "critical") return "critical";
  if (raw === "milestones") return "milestones";
  return "full";
}

function parseFormat(raw: string | null): ExportFormat {
  if (raw === "csv") return "csv";
  return "xlsx";
}

const VALID_CHANGE_TYPES: Set<ScheduleChangeType> = new Set([
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
]);

function asPositiveNumber(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, num);
}

function parseFilters(raw: string | null): ScheduleCompareFilters {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const changeTypes = Array.isArray(parsed.changeTypes)
      ? parsed.changeTypes
          .map((value) => String(value))
          .filter((value): value is ScheduleChangeType => VALID_CHANGE_TYPES.has(value as ScheduleChangeType))
      : undefined;

    return {
      search: typeof parsed.search === "string" ? parsed.search : undefined,
      changeTypes: changeTypes && changeTypes.length > 0 ? changeTypes : undefined,
      onlyCritical: typeof parsed.onlyCritical === "boolean" ? parsed.onlyCritical : undefined,
      onlyMilestones: typeof parsed.onlyMilestones === "boolean" ? parsed.onlyMilestones : undefined,
      showAdded: typeof parsed.showAdded === "boolean" ? parsed.showAdded : undefined,
      showRemoved: typeof parsed.showRemoved === "boolean" ? parsed.showRemoved : undefined,
      wbsPrefix: typeof parsed.wbsPrefix === "string" ? parsed.wbsPrefix : undefined,
      minAbsFinishShiftDays: asPositiveNumber(parsed.minAbsFinishShiftDays),
      minAbsStartShiftDays: asPositiveNumber(parsed.minAbsStartShiftDays),
      confidenceMin: typeof parsed.confidenceMin === "number" ? Math.max(0, Math.min(1, parsed.confidenceMin)) : undefined,
    };
  } catch {
    return {};
  }
}

function toCsvRow(values: Array<string | number | null>): string {
  return values
    .map((value) => {
      const raw = value === null || value === undefined ? "" : String(value);
      if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
        return `"${raw.replaceAll('"', '""')}"`;
      }
      return raw;
    })
    .join(",");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectCode = url.searchParams.get("projectCode") || "A27";
    const oldRevisionId = url.searchParams.get("oldRevisionId") || url.searchParams.get("baselineRevId");
    const newRevisionId = url.searchParams.get("newRevisionId") || url.searchParams.get("updateRevId");
    const mode = parseMode(url.searchParams.get("mode"));
    const format = parseFormat(url.searchParams.get("format"));
    const rawFilters = parseFilters(url.searchParams.get("filters"));

    if (!oldRevisionId || !newRevisionId) {
      return Response.json({ ok: false, error: "oldRevisionId and newRevisionId are required." }, { status: 400 });
    }

    const compare = await compareScheduleRevisions({ projectCode, oldRevisionId, newRevisionId });
    const effectiveFilters: ScheduleCompareFilters = {
      ...rawFilters,
      onlyCritical: mode === "critical" ? true : rawFilters.onlyCritical,
      onlyMilestones: mode === "milestones" ? true : rawFilters.onlyMilestones,
    };
    const rows = applyCompareFilters(compare.rows, effectiveFilters);
    if (format === "csv") {
      const lines = [
        toCsvRow([
          "ActivityCode",
          "WBS",
          "TaskName",
          "MatchConfidence",
          "MatchMethod",
          "ChangeType",
          "OldStart",
          "NewStart",
          "OldFinish",
          "NewFinish",
          "StartShiftDays",
          "FinishShiftDays",
          "FloatDelta",
          "ChangeFlags",
          "DiffSummary",
        ]),
      ];
      for (const row of rows) {
        lines.push(
          toCsvRow([
            row.activityCode,
            row.wbs,
            row.taskName,
            Number(row.matchConfidence.toFixed(3)),
            row.matchMethod,
            row.changeType,
            row.oldStart,
            row.newStart,
            row.oldFinish,
            row.newFinish,
            row.startShiftDays,
            row.finishShiftDays,
            row.floatDelta,
            row.changeFlags.join("|"),
            row.diffSummary,
          ])
        );
      }
      const csv = `${lines.join("\n")}\n`;
      const filename = `schedule-change-log-${compare.oldRevision.revisionCode}-vs-${compare.newRevision.revisionCode}.csv`;
      const encoded = encodeURIComponent(filename);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"${filename}\"; filename*=UTF-8''${encoded}`,
          "Cache-Control": "no-store",
        },
      });
    }

    const workbook = await buildCompareWorkbook(compare, mode, rows);
    const filename = `schedule-compare-${compare.oldRevision.revisionCode}-vs-${compare.newRevision.revisionCode}-${mode}.xlsx`;
    const encoded = encodeURIComponent(filename);

    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${filename}\"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
