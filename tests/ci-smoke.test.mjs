import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("repository includes tracked Supabase migrations", () => {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  assert.equal(fs.existsSync(migrationsDir), true, "supabase/migrations directory should exist");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  assert.ok(files.length > 0, "expected at least one SQL migration");
});
