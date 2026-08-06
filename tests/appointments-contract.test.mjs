import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("appointments replace care plan with an interactive, device-local visit planner", async () => {
  const [page, workspace, storage, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/appointments-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/appointment-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /target="care-plan"/);
  assert.doesNotMatch(page, /CarePlanPreview/);
  assert.match(page, /AppointmentsWorkspace/);
  assert.match(page, /appointment=\{nextScheduledAppointment\(appointments\)\}/);
  assert.match(workspace, /calendar-grid/);
  assert.match(workspace, /What do you want to get out of this visit\?/);
  assert.match(workspace, /Bring in my intake concern and questions/);
  assert.match(workspace, /does not reserve a time with a clinic/);
  assert.match(workspace, /Mark complete/);
  assert.match(storage, /window\.localStorage/);
  assert.match(styles, /@media \(max-width: 620px\)/);
});
