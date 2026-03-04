export const INSTALLATION_INGEST_STATUS = {
  uploaded: "uploaded",
  queued: "queued",
  processing: "processing",
  ready: "ready",
  failed: "failed",
  failed_timeout: "failed_timeout",
};

export const DEFAULT_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
export const FIELD_INSTALLATION_PARSER_VERSION = "field-installation-v3";

function safeDateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function distinctIsoDates(values) {
  return Array.from(new Set((values || []).filter((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)))).sort();
}

export function isProcessingStale(file, nowMs = Date.now(), timeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS) {
  if (!file || file.ingest_status !== INSTALLATION_INGEST_STATUS.processing) return false;
  const startedMs = safeDateMs(file.processing_started_at) ?? safeDateMs(file.updated_at) ?? safeDateMs(file.created_at);
  if (startedMs === null) return true;
  return nowMs - startedMs > timeoutMs;
}

export function sourceFileHasCompleteIngest(file, bySourceSummary, bySourceRows) {
  if (!file || !file.id || !file.work_date) return false;
  const summaryMatch = bySourceSummary.get(file.id) === file.work_date;
  const rowMatch = bySourceRows.get(file.id) === file.work_date;
  if (summaryMatch && rowMatch) return true;

  const status = file.ingest_status || INSTALLATION_INGEST_STATUS.uploaded;
  const finished = Boolean(file.processing_finished_at || file.processed_at);
  if (summaryMatch && status === INSTALLATION_INGEST_STATUS.ready && finished) {
    return true;
  }

  return false;
}

export function shouldQueueFileForIngest(file, ctx) {
  const {
    bySourceSummary,
    bySourceRows,
    nowMs = Date.now(),
    timeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS,
  } = ctx;

  const complete = sourceFileHasCompleteIngest(file, bySourceSummary, bySourceRows);
  const status = file.ingest_status || INSTALLATION_INGEST_STATUS.uploaded;
  const stale = isProcessingStale(file, nowMs, timeoutMs);

  if (status === INSTALLATION_INGEST_STATUS.processing && !stale) {
    return { queue: false, reason: "processing_active" };
  }
  if (complete && (status === INSTALLATION_INGEST_STATUS.queued || status === INSTALLATION_INGEST_STATUS.uploaded)) {
    return { queue: true, reason: "status_not_ready" };
  }
  if (complete && status === INSTALLATION_INGEST_STATUS.ready) {
    return { queue: false, reason: "ready_complete" };
  }
  if (stale) {
    return { queue: true, reason: "processing_stale" };
  }
  if (!complete) {
    return { queue: true, reason: "incomplete_source" };
  }
  if (status === INSTALLATION_INGEST_STATUS.failed || status === INSTALLATION_INGEST_STATUS.failed_timeout) {
    return { queue: true, reason: "failed_retry" };
  }

  return { queue: false, reason: "default_skip" };
}

export function buildIngestQueue(files, ctx) {
  const queue = [];
  const skipped = [];
  for (const file of files || []) {
    const decision = shouldQueueFileForIngest(file, ctx);
    if (decision.queue) queue.push({ file, reason: decision.reason });
    else skipped.push({ file, reason: decision.reason });
  }
  return { queue, skipped };
}

export function buildIngestionAudit(args) {
  const warnings = Array.isArray(args?.warnings) ? args.warnings : [];
  const distinctRowDates = distinctIsoDates(args?.distinctRowDates || []);
  const parsedMaterialRows = Number(args?.parsedMaterialRows || 0);
  const parsedLaborRows = Number(args?.parsedLaborRows || 0);
  const insertedMaterialRows = Number(args?.insertedMaterialRows || 0);
  const insertedLaborRows = Number(args?.insertedLaborRows || 0);
  const parserError = args?.error ? String(args.error) : null;
  const status = parserError
    ? args?.timedOut
      ? INSTALLATION_INGEST_STATUS.failed_timeout
      : INSTALLATION_INGEST_STATUS.failed
    : INSTALLATION_INGEST_STATUS.ready;

  return {
    ingestStatus: status,
    warningCount: warnings.length,
    warnings,
    distinctRowDates,
    parsedMaterialRows,
    parsedLaborRows,
    insertedMaterialRows,
    insertedLaborRows,
    parseError: parserError,
  };
}
