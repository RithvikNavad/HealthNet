import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the intake route uses a session-aware, guarded, rate-limited agent", async () => {
  const [agent, route, limiter, hosting] = await Promise.all([
    readFile(new URL("../lib/healthnet-agent.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/intake/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent-rate-limit.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(agent, /new Agent\(/);
  assert.match(agent, /record_intake_state/);
  assert.match(agent, /urgent_symptom_screen/);
  assert.match(agent, /outputType:\s*AgentResultSchema/);
  assert.match(agent, /model:\s*HEALTHNET_AGENT_MODEL/);
  assert.match(route, /OpenAIConversationsSession/);
  assert.match(route, /conversationId/);
  assert.match(route, /traceIncludeSensitiveData:\s*false/);
  assert.match(route, /enforceAgentRateLimit/);
  assert.match(limiter, /visitor:\s*20/);
  assert.match(limiter, /network:\s*120/);
  assert.match(limiter, /visit:\s*15/);
  assert.match(limiter, /SHA-256/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});
