import { z } from "zod";

export const EvidenceSchema = z.object({
  page: z.number().int().positive().nullable(),
  text: z.string(),
});

export const DocumentExplanationSchema = z.object({
  documentType: z.string(),
  plainEnglishOverview: z.string(),
  keyFindings: z.array(z.object({
    title: z.string(),
    plainLanguage: z.string(),
    significance: z.enum(["routine", "follow_up", "timely", "urgent", "unclear"]),
    evidence: z.array(EvidenceSchema),
    uncertainty: z.string(),
  })),
  medicalTerms: z.array(z.object({
    term: z.string(),
    explanation: z.string(),
    evidence: z.array(EvidenceSchema),
  })),
  conditionsMentioned: z.array(z.object({
    name: z.string(),
    status: z.enum(["confirmed_in_document", "suspected", "being_evaluated", "historical", "ruled_out", "unclear"]),
    explanation: z.string(),
    evidence: z.array(EvidenceSchema),
  })),
  testResults: z.array(z.object({
    name: z.string(),
    value: z.string(),
    unit: z.string(),
    referenceRange: z.string(),
    interpretation: z.string(),
    evidence: z.array(EvidenceSchema),
  })),
  medicationsMentioned: z.array(z.object({
    name: z.string(),
    detail: z.string(),
    evidence: z.array(EvidenceSchema),
  })),
  nextStepsFromDocument: z.array(z.object({
    instruction: z.string(),
    timing: z.string(),
    evidence: z.array(EvidenceSchema),
  })),
  questionsForClinician: z.array(z.string()),
  urgentAttention: z.object({
    flag: z.boolean(),
    reason: z.string(),
    evidence: z.array(EvidenceSchema),
  }),
  unclearOrMissingInformation: z.array(z.string()),
  limitations: z.array(z.string()),
  patientNotice: z.string(),
});

export type DocumentExplanation = z.infer<typeof DocumentExplanationSchema>;
