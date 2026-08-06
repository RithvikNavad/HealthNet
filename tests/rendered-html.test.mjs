import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the HealthNet interface keeps its product, privacy, and safety messaging", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /HealthNet — Prepare for better care/);
  assert.match(page, /HealthNet care agent/);
  assert.match(page, /Tell us what’s been happening/);
  assert.match(page, /Device-private workspace/);
  assert.match(page, /PDFs stay in this browser on this device/);
  assert.doesNotMatch(page, /fictional information/i);
  assert.match(page, /Visit summary/);
  assert.doesNotMatch(page, /OPENAI_API_KEY|sk-[A-Za-z0-9_-]+/);
});
