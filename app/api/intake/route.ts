import {
  InputGuardrailTripwireTriggered,
  OpenAIConversationsSession,
  Runner,
} from "@openai/agents";
import { z } from "zod";
import {
  HEALTHNET_AGENT_MODEL,
  HEALTHNET_AGENT_NAME,
  PatientCaseSchema,
  healthNetAgent,
} from "../../../lib/healthnet-agent";

const agentRunner = new Runner({
  workflowName: "HealthNet fictional patient intake",
  traceIncludeSensitiveData: false,
});

const RequestSchema = z.object({
  patientMessage: z.string().trim().min(1).max(4000),
  patientCase: PatientCaseSchema,
  conversationId: z.string().trim().min(1).max(200).nullable().optional(),
});

function agentDetails(overrides?: Partial<{
  conversationId: string | null;
  safetyCheck: "passed" | "triggered";
  stateRecorded: boolean;
}>) {
  return {
    name: HEALTHNET_AGENT_NAME,
    model: HEALTHNET_AGENT_MODEL,
    conversationId: overrides?.conversationId ?? null,
    memoryActive: Boolean(overrides?.conversationId),
    safetyCheck: overrides?.safetyCheck ?? "passed",
    stateRecorded: overrides?.stateRecorded ?? false,
  };
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "The HealthNet AI key is not configured." }, { status: 503 });
  }

  const parsedRequest = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return Response.json({ error: "The intake request was not valid." }, { status: 400 });
  }

  const { patientMessage, patientCase, conversationId } = parsedRequest.data;
  const session = new OpenAIConversationsSession({
    apiKey: process.env.OPENAI_API_KEY,
    conversationId: conversationId || undefined,
  });

  try {
    const result = await agentRunner.run(
      healthNetAgent,
      JSON.stringify({
        currentDate: new Date().toISOString().slice(0, 10),
        patientMessage,
        currentPatientCase: patientCase,
      }),
      {
        session,
        maxTurns: 4,
      },
    );

    if (!result.finalOutput) {
      return Response.json({ error: "The care agent could not organize that answer. Please try again." }, { status: 502 });
    }

    const resolvedConversationId = await session.getSessionId();
    const stateRecorded = result.newItems.some((item) =>
      item.type === "tool_call_item" &&
      item.rawItem &&
      "name" in item.rawItem &&
      item.rawItem.name === "record_intake_state"
    );

    return Response.json({
      ...result.finalOutput,
      conversationId: resolvedConversationId,
      agent: agentDetails({
        conversationId: resolvedConversationId,
        safetyCheck: "passed",
        stateRecorded,
      }),
    });
  } catch (error) {
    if (error instanceof InputGuardrailTripwireTriggered) {
      const outputInfo = error.result.output.outputInfo as { urgentWarning?: string | null };
      const urgentWarning = outputInfo.urgentWarning || "Some symptoms you described may require immediate medical help.";
      return Response.json({
        assistantMessage: "Please seek immediate help now rather than waiting to finish this intake.",
        patientCase,
        intakeComplete: false,
        urgentWarning,
        conversationId: conversationId || null,
        agent: agentDetails({
          conversationId: conversationId || null,
          safetyCheck: "triggered",
          stateRecorded: false,
        }),
      });
    }

    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unknown";
    console.error("HealthNet agent run failed", { status, code });
    if (status === 401) return Response.json({ error: "The AI key was rejected. Please check the project key." }, { status: 502 });
    if (code === "insufficient_quota") return Response.json({ error: "The OpenAI account needs API credits before HealthNet can answer." }, { status: 429 });
    if (status === 429) return Response.json({ error: "The care agent is busy right now. Please try again shortly." }, { status: 429 });
    return Response.json({ error: "The care agent could not process that answer right now. Please try again." }, { status: 502 });
  }
}
