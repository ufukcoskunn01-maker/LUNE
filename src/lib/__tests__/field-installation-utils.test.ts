import test from "node:test";
import assert from "node:assert/strict";
import { mapEfficiencyStatus, parseInstallationFileMeta } from "@/lib/field-installation/utils";

test("parseInstallationFileMeta parses yymmdd and rev", () => {
  const parsed = parseInstallationFileMeta("A27-E-INS-260219_rev00.xlsx");
  assert.ok(parsed);
  assert.equal(parsed.workDate, "2026-02-19");
  assert.equal(parsed.revision, "rev00");
});

test("parseInstallationFileMeta returns null for non-matching filenames", () => {
  const parsed = parseInstallationFileMeta("A27-E-PS-260219_rev00.xlsx");
  assert.equal(parsed, null);
});

test("mapEfficiencyStatus maps ranges correctly", () => {
  assert.equal(mapEfficiencyStatus(85), "good");
  assert.equal(mapEfficiencyStatus(60), "risk");
  assert.equal(mapEfficiencyStatus(30), "bad");
  assert.equal(mapEfficiencyStatus(null), "unknown");
});
