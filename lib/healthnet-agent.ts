import { Agent, tool, type InputGuardrail } from "@openai/agents";
import { z } from "zod";
import { detectUrgentWarning } from "./healthnet-safety.mjs";

export const HEALTHNET_AGENT_NAME = "HealthNet Care Navigation Agent";
export const HEALTHNET_AGENT_MODEL = "gpt-5.6-sol";

export const TimelineFactSchema = z.object({
  when: z.string(),
  normalizedDate: z.string().nullable(),
  title: z.string(),
  detail: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const PatientCaseSchema = z.object({
  primaryConcern: z.string(),
  historyNarrative: z.string(),
  symptomsPresent: z.array(z.string()),
  symptomsDenied: z.array(z.string()),
  relevantHistory: z.array(z.string()),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  treatmentsTried: z.array(z.string()),
  timeline: z.array(TimelineFactSchema),
  clinicalConsiderations: z.array(z.object({
    title: z.string(),
    rationale: z.string(),
    uncertainty: z.string(),
  })),
  physicianQuestions: z.array(z.string()),
  missingInformation: z.array(z.string()),
  progress: z.number().int().min(10).max(100),
});

export const AgentResultSchema = z.object({
  assistantMessage: z.string(),
  patientCase: PatientCaseSchema,
  intakeComplete: z.boolean(),
  urgentWarning: z.string().nullable(),
});

const recordIntakeState = tool({
  name: "record_intake_state",
  description: "Validate and record the complete, deduplicated patient history and timeline before returning the next question or final summary.",
  parameters: PatientCaseSchema,
  outputSchema: z.object({
    recorded: z.boolean(),
    timelineEvents: z.number().int().nonnegative(),
    progress: z.number().int().min(10).max(100),
  }),
  async execute(patientCase) {
    return {
      recorded: true,
      timelineEvents: patientCase.timeline.length,
      progress: patientCase.progress,
    };
  },
});

function extractPatientMessage(input: string | unknown[]) {
  if (typeof input !== "string") return JSON.stringify(input);
  try {
    const payload = JSON.parse(input) as { patientMessage?: unknown };
    return typeof payload.patientMessage === "string" ? payload.patientMessage : input;
  } catch {
    return input;
  }
}

export const urgentSymptomGuardrail: InputGuardrail = {
  name: "urgent_symptom_screen",
  runInParallel: false,
  async execute({ input }) {
    const urgentWarning = detectUrgentWarning(extractPatientMessage(input));
    return {
      tripwireTriggered: Boolean(urgentWarning),
      outputInfo: { urgentWarning },
    };
  },
};

const instructions = `Role: You are the HealthNet Care Navigation Agent for a school portfolio prototype that uses fictional patient information.

Goal: Conduct a focused, patient-centered pre-visit interview and maintain a clinician-ready patient history and timeline.

Success criteria:
- Ask exactly one concise follow-up question unless the intake is complete.
- Collect the main concern; onset; timing; progression; location; quality; severity; triggers; relieving factors; associated symptoms; explicit negatives; treatments; relevant history; medications and recent changes; allergies; and the patient's goal for the visit.
- Return the complete, deduplicated patient case on every turn.
- Call record_intake_state exactly once with that complete case before returning the final structured output.
- Mark the intake complete when the major categories are covered or after 12 patient answers.

Constraints:
- Do not diagnose, prescribe, recommend a dose change, or claim certainty.
- Never invent facts, negatives, dates, medications, allergies, or test results.
- Treat all information as patient-reported. Preserve uncertainty and approximate dates. normalizedDate must be null unless a calendar date is clearly supported.
- Clinical considerations are discussion points, not diagnoses. Include them only when enough history supports them and state what remains uncertain.
- If information conflicts, preserve the conflict in missingInformation and ask for clarification.
- If symptoms may be urgent but were not blocked by the safety screen, provide a calm urgentWarning directing the patient to immediate help.
- Use plain, warm language without generic reassurance.

Output: Return the required structured result. assistantMessage contains either one next question or a short statement that the organized summary is ready.`;

export const healthNetAgent = new Agent({
  name: HEALTHNET_AGENT_NAME,
  instructions,
  model: HEALTHNET_AGENT_MODEL,
  modelSettings: {
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
    store: true,
  },
  tools: [recordIntakeState],
  inputGuardrails: [urgentSymptomGuardrail],
  outputType: AgentResultSchema,
});
