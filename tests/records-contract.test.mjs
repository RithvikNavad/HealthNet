import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("medical records use a direct, validated PDF upload with persistent storage", async () => {
  const [page, route, schema, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type="file" accept="application\/pdf,\.pdf"/);
  assert.match(page, /XMLHttpRequest/);
  assert.match(page, /Maximum file size 10 MB/);
  assert.doesNotMatch(page, /records: \{ eyebrow:/);
  assert.match(route, /MAX_PDF_BYTES = 10 \* 1024 \* 1024/);
  assert.match(route, /signature !== "%PDF-"/);
  assert.match(route, /recordsBucket\.put/);
  assert.match(route, /recordsBucket\.delete/);
  assert.match(schema, /medical_records/);
  assert.equal(JSON.parse(hosting).r2, "RECORDS");
});
