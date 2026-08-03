export type TimelineFact = {
  when: string;
  normalizedDate: string | null;
  title: string;
  detail: string;
  confidence: "high" | "medium" | "low";
};

export type ClinicalConsideration = {
  title: string;
  rationale: string;
  uncertainty: string;
};

export type PatientCase = {
  primaryConcern: string;
  historyNarrative: string;
  symptomsPresent: string[];
  symptomsDenied: string[];
  relevantHistory: string[];
  medications: string[];
  allergies: string[];
  treatmentsTried: string[];
  timeline: TimelineFact[];
  clinicalConsiderations: ClinicalConsideration[];
  physicianQuestions: string[];
  missingInformation: string[];
  progress: number;
};

export type IntakeApiResult = {
  assistantMessage: string;
  patientCase: PatientCase;
  intakeComplete: boolean;
  urgentWarning: string | null;
};

export const emptyPatientCase: PatientCase = {
  primaryConcern: "",
  historyNarrative: "",
  symptomsPresent: [],
  symptomsDenied: [],
  relevantHistory: [],
  medications: [],
  allergies: [],
  treatmentsTried: [],
  timeline: [],
  clinicalConsiderations: [],
  physicianQuestions: [],
  missingInformation: [],
  progress: 10,
};
