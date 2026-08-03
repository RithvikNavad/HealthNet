import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["assistant", "patient"]),
  text: z.string().min(1).max(4000),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
  patientCase: z.unknown(),
});

const TimelineFactSchema = z.object({
  when: z.string(),
  normalizedDate: z.string().nullable(),
  title: z.string(),
  detail: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

const PatientCaseSchema = z.object({
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

const IntakeResultSchema = z.object({
  assistantMessage: z.string(),
  patientCase: PatientCaseSchema,
  intakeComplete: z.boolean(),
  urgentWarning: z.string().nullable(),
});

const instructions = `You are HealthNet, an AI intake organizer for a school portfolio prototype using fictional patient information.

Your job is to organize patient-reported history and build a clinician-ready timeline. Ask exactly one concise, empathetic follow-up question at a time unless the intake is complete.

Collect: main concern; onset and approximate date; timing, progression, location, quality and severity; triggers and relieving factors; associated symptoms and explicit negatives; treatments tried; relevant history; medications and recent changes; allergies; and the patient's goals for the visit.

Rules:
- Do not diagnose, prescribe, or claim certainty. Never invent facts, negatives, dates, or medications.
- Preserve uncertainty and phrases such as “about three weeks ago.” normalizedDate must be null unless a calendar date is clearly supported.
- Return the full, deduplicated patient case and full timeline on every turn, not only new facts.
- Add qualified clinical considerations only when enough history supports them. Each must explain its rationale and uncertainty.
- Suggest practical questions for the physician based on the history.
- Set progress from 10 to 100 based on coverage, not message count. Complete after the major categories are covered or after 12 patient answers.
- If the report could indicate an emergency, add a calm urgentWarning telling the patient to seek immediate help. Otherwise return null.
- Use plain, supportive language. The final assistant message should say the organized summary is ready.`;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "The HealthNet AI key is not configured." }, { status: 503 });
  }

  const parsedRequest = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return Response.json({ error: "The intake request was not valid." }, { status: 400 });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: "gpt-5.6-sol",
      reasoning: { effort: "low" },
      store: false,
      instructions,
      input: JSON.stringify({
        currentDate: new Date().toISOString().slice(0, 10),
        conversation: parsedRequest.data.messages,
        currentPatientCase: parsedRequest.data.patientCase,
      }),
      text: { format: zodTextFormat(IntakeResultSchema, "healthnet_intake") },
    });

    if (!response.output_parsed) {
      return Response.json({ error: "The AI could not organize that answer. Please try again." }, { status: 502 });
    }
    return Response.json(response.output_parsed);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unknown";
    console.error("HealthNet intake request failed", { status, code });
    if (status === 401) return Response.json({ error: "The AI key was rejected. Please check the project key." }, { status: 502 });
    if (code === "insufficient_quota") return Response.json({ error: "The OpenAI account needs API credits before HealthNet can answer." }, { status: 429 });
    if (status === 429) return Response.json({ error: "The AI is busy right now. Please try again shortly." }, { status: 429 });
    return Response.json({ error: "The AI could not process that answer right now. Please try again." }, { status: 502 });
  }
}
