import test from "node:test";
import assert from "node:assert/strict";
import {
  INSTALLATION_INGEST_STATUS,
  buildIngestQueue,
  buildIngestionAudit,
  sourceFileHasCompleteIngest,
} from "../src/lib/field-installation/ingestion-lifecycle.js";

test("Case A: matching row dates -> ready status with inserted rows", () => {
  const audit = buildIngestionAudit({
    distinctRowDates: ["2026-02-28"],
    parsedMaterialRows: 12,
    parsedLaborRows: 4,
    insertedMaterialRows: 12,
    insertedLaborRows: 4,
    warnings: [],
  });
  assert.equal(audit.ingestStatus, INSTALLATION_INGEST_STATUS.ready);
  assert.equal(audit.insertedMaterialRows, 12);
  assert.equal(audit.warningCount, 0);
});

test("Case B: mismatched row dates still ingested and warning retained", () => {
  const audit = buildIngestionAudit({
    distinctRowDates: ["2026-02-27", "2026-02-28"],
    parsedMaterialRows: 8,
    parsedLaborRows: 2,
    insertedMaterialRows: 8,
    insertedLaborRows: 2,
    warnings: [{ code: "sheet_date_mismatch", message: "Some row dates differ." }],
  });
  assert.equal(audit.ingestStatus, INSTALLATION_INGEST_STATUS.ready);
  assert.equal(audit.insertedMaterialRows > 0, true);
  assert.equal(audit.warningCount, 1);
});

test("Case C: file discovered but never ingested is queued", () => {
  const file = { id: "f1", work_date: "2026-02-28", ingest_status: "queued" };
  const bySummary = new Map();
  const byRows = new Map();
  const queue = buildIngestQueue([file], { bySourceSummary: bySummary, bySourceRows: byRows });
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].reason, "incomplete_source");
});

test("Case D: stale processing gets queued for retry", () => {
  const file = {
    id: "f1",
    work_date: "2026-02-28",
    ingest_status: "processing",
    processing_started_at: "2026-02-28T00:00:00.000Z",
  };
  const queue = buildIngestQueue([file], {
    bySourceSummary: new Map(),
    bySourceRows: new Map(),
    nowMs: Date.parse("2026-02-28T01:00:00.000Z"),
    timeoutMs: 10 * 60 * 1000,
  });
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].reason, "processing_stale");
});

test("Case E: repeated ready+complete file is skipped (idempotent)", () => {
  const file = {
    id: "f1",
    work_date: "2026-02-28",
    ingest_status: "ready",
    processing_finished_at: "2026-02-28T00:20:00.000Z",
  };
  const bySummary = new Map([["f1", "2026-02-28"]]);
  const byRows = new Map([["f1", "2026-02-28"]]);
  assert.equal(sourceFileHasCompleteIngest(file, bySummary, byRows), true);
  const queue = buildIngestQueue([file], { bySourceSummary: bySummary, bySourceRows: byRows });
  assert.equal(queue.queue.length, 0);
});

test("Case E2: queued+complete file is re-queued to refresh stale rows", () => {
  const file = {
    id: "f1",
    work_date: "2026-02-28",
    ingest_status: "queued",
    processing_finished_at: "2026-02-28T00:20:00.000Z",
  };
  const bySummary = new Map([["f1", "2026-02-28"]]);
  const byRows = new Map([["f1", "2026-02-28"]]);
  const queue = buildIngestQueue([file], { bySourceSummary: bySummary, bySourceRows: byRows });
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].reason, "status_not_ready");
});

test("Case F: parser failure yields failed status with parse_error", () => {
  const audit = buildIngestionAudit({ error: "Sheet not found" });
  assert.equal(audit.ingestStatus, INSTALLATION_INGEST_STATUS.failed);
  assert.equal(audit.parseError, "Sheet not found");
});
