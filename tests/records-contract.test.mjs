import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("medical records and lab results use direct, validated PDF uploads with device-local storage", async () => {
  const [page, storage, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/record-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type="file" accept="application\/pdf,\.pdf"/);
  assert.match(page, /DocumentWorkspace kind="records"/);
  assert.match(page, /DocumentWorkspace kind="labs"/);
  assert.match(page, /Your lab result documents/);
  assert.match(page, /saveMedicalRecord/);
  assert.match(page, /Maximum file size 10 MB/);
  assert.doesNotMatch(page, /records: \{ eyebrow:/);
  assert.doesNotMatch(page, /labs: \{ eyebrow:/);
  assert.match(storage, /window\.indexedDB\.open/);
  assert.match(storage, /category\?: DocumentCategory/);
  assert.match(storage, /record\.category === category/);
  assert.match(storage, /transaction\(STORE_NAME, "readwrite"\)/);
  assert.match(storage, /objectStore\(STORE_NAME\)\.delete/);
  assert.equal(JSON.parse(hosting).r2, null);
});
