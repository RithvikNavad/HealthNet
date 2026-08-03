import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the intake route uses a session-aware guarded agent", async () => {
  const [agent, route] = await Promise.all([
    readFile(new URL("../lib/healthnet-agent.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/intake/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(agent, /new Agent\(/);
  assert.match(agent, /record_intake_state/);
  assert.match(agent, /urgent_symptom_screen/);
  assert.match(agent, /outputType:\s*AgentResultSchema/);
  assert.match(agent, /model:\s*HEALTHNET_AGENT_MODEL/);
  assert.match(route, /OpenAIConversationsSession/);
  assert.match(route, /conversationId/);
  assert.match(route, /traceIncludeSensitiveData:\s*false/);
});
