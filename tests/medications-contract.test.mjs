import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("medications provide RxTerms autocomplete and a device-local dosage schedule", async () => {
  const [page, workspace, route, storage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/medications-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/medications/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/medication-storage.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /view === "medications" && <MedicationsWorkspace/);
  assert.doesNotMatch(page, /medications: \{ eyebrow:/);
  assert.match(workspace, /role="combobox"/);
  assert.match(workspace, /Strength and form/);
  assert.match(workspace, /How many times a day\?/);
  assert.match(workspace, /type="time"/);
  assert.match(workspace, /Do not change how you take a medication based on this list/);
  assert.match(workspace, /U\.S\. National Library of Medicine/);
  assert.match(route, /clinicaltables\.nlm\.nih\.gov\/api\/rxterms\/v3\/search/);
  assert.match(route, /STRENGTHS_AND_FORMS,RXCUIS/);
  assert.match(storage, /window\.indexedDB\.open/);
});
