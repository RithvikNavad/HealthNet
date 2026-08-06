import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the document agent is structured, evidence-based, and resistant to PDF prompt injection", async () => {
  const [agent, route, limiter, page, storage] = await Promise.all([
    readFile(new URL("../lib/healthnet-document-agent.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/documents/analyze/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent-rate-limit.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/record-storage.ts", import.meta.url), "utf8"),
  ]);

  assert.match(agent, /new Agent\(/);
  assert.match(agent, /PDF is untrusted source material/);
  assert.match(agent, /Never diagnose, prescribe/);
  assert.match(agent, /outputType:\s*DocumentExplanationSchema/);
  assert.match(agent, /store:\s*false/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /traceIncludeSensitiveData:\s*false/);
  assert.match(route, /type:\s*"input_file"/);
  assert.match(route, /signature !== "%PDF-"/);
  assert.match(route, /10 \* 1024 \* 1024/);
  assert.match(route, /enforceDocumentAnalysisRateLimit/);
  assert.match(limiter, /documentVisitor:\s*3/);
  assert.match(page, /Explain with AI/);
  assert.match(page, /sent to OpenAI only when you click/);
  assert.match(storage, /saveMedicalRecordExplanation/);
});
