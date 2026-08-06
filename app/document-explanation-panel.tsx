"use client";

import type { DocumentExplanation } from "../lib/document-explanation";

const conditionLabels: Record<string, string> = {
  confirmed_in_document: "Documented",
  suspected: "Suspected",
  being_evaluated: "Being evaluated",
  historical: "History",
  ruled_out: "Ruled out",
  unclear: "Unclear",
};

function Evidence({ items }: { items: { page: number | null; text: string }[] }) {
  if (!items.length) return null;
  return <div className="explanation-evidence">{items.map((item, index) => <p key={`${item.page}-${item.text}-${index}`}><span>{item.page ? `Page ${item.page}` : "Document"}</span> “{item.text}”</p>)}</div>;
}

function EmptySection({ children }: { children: string }) {
  return <p className="explanation-empty">{children}</p>;
}

export default function DocumentExplanationPanel({ explanation, fileName, analyzedAt, onDelete, onAnalyzeAgain }: {
  explanation: DocumentExplanation;
  fileName: string;
  analyzedAt?: string;
  onDelete: () => void;
  onAnalyzeAgain: () => void;
}) {
  return <section className="document-explanation" aria-label={`AI explanation of ${fileName}`}>
    <header className="explanation-header">
      <div><p className="eyebrow">AI DOCUMENT EXPLANATION</p><h2>{explanation.documentType || "Medical document"}</h2><p>{analyzedAt ? `Analyzed ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(analyzedAt))}` : "Saved on this device"}</p></div>
      <div className="explanation-actions"><button onClick={() => window.print()}>Print</button><button onClick={onAnalyzeAgain}>Analyze again</button><button className="danger" onClick={onDelete}>Delete explanation</button></div>
    </header>

    {explanation.urgentAttention.flag && <div className="explanation-urgent"><strong>Document indicates urgent attention</strong><p>{explanation.urgentAttention.reason}</p><Evidence items={explanation.urgentAttention.evidence} /></div>}

    <section className="explanation-overview"><p className="eyebrow">PLAIN-ENGLISH OVERVIEW</p><p>{explanation.plainEnglishOverview}</p></section>

    <div className="explanation-grid">
      <section><h3>Key findings</h3>{explanation.keyFindings.length ? explanation.keyFindings.map((finding, index) => <article key={`${finding.title}-${index}`}><div className="finding-title"><strong>{finding.title}</strong><span className={`significance ${finding.significance}`}>{finding.significance.replace("_", " ")}</span></div><p>{finding.plainLanguage}</p>{finding.uncertainty && <small>Uncertainty: {finding.uncertainty}</small>}<Evidence items={finding.evidence} /></article>) : <EmptySection>No key findings were clearly identified.</EmptySection>}</section>

      <section><h3>Conditions mentioned</h3>{explanation.conditionsMentioned.length ? explanation.conditionsMentioned.map((condition, index) => <article key={`${condition.name}-${index}`}><div className="finding-title"><strong>{condition.name}</strong><span>{conditionLabels[condition.status] || "Unclear"}</span></div><p>{condition.explanation}</p><Evidence items={condition.evidence} /></article>) : <EmptySection>No conditions were mentioned in the document.</EmptySection>}</section>
    </div>

    {explanation.testResults.length > 0 && <section className="explanation-wide"><h3>Test results</h3><div className="test-results-table"><div className="test-results-head"><span>Test</span><span>Result</span><span>Reference</span><span>Plain-English note</span></div>{explanation.testResults.map((result, index) => <article key={`${result.name}-${index}`}><strong>{result.name}</strong><span>{[result.value, result.unit].filter(Boolean).join(" ") || "Not shown"}</span><span>{result.referenceRange || "Not shown"}</span><div><p>{result.interpretation}</p><Evidence items={result.evidence} /></div></article>)}</div></section>}

    <div className="explanation-grid">
      <section><h3>Medical terms</h3>{explanation.medicalTerms.length ? explanation.medicalTerms.map((term, index) => <article key={`${term.term}-${index}`}><strong>{term.term}</strong><p>{term.explanation}</p><Evidence items={term.evidence} /></article>) : <EmptySection>No terms needed an explanation.</EmptySection>}</section>
      <section><h3>Medications mentioned</h3>{explanation.medicationsMentioned.length ? explanation.medicationsMentioned.map((medication, index) => <article key={`${medication.name}-${index}`}><strong>{medication.name}</strong><p>{medication.detail}</p><Evidence items={medication.evidence} /></article>) : <EmptySection>No medications were clearly mentioned.</EmptySection>}</section>
    </div>

    <div className="explanation-grid next-steps">
      <section><h3>Steps written in the document</h3>{explanation.nextStepsFromDocument.length ? <ol>{explanation.nextStepsFromDocument.map((step, index) => <li key={`${step.instruction}-${index}`}><strong>{step.instruction}</strong>{step.timing && <p>Timing: {step.timing}</p>}<Evidence items={step.evidence} /></li>)}</ol> : <EmptySection>No next steps were clearly written in the document.</EmptySection>}</section>
      <section><h3>Questions to ask your clinician</h3>{explanation.questionsForClinician.length ? <ol>{explanation.questionsForClinician.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ol> : <EmptySection>No questions were generated.</EmptySection>}</section>
    </div>

    {(explanation.unclearOrMissingInformation.length > 0 || explanation.limitations.length > 0) && <section className="explanation-cautions"><h3>What is unclear or limited</h3><ul>{[...explanation.unclearOrMissingInformation, ...explanation.limitations].map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
    <footer><strong>Check this explanation with a clinician</strong><p>{explanation.patientNotice}</p></footer>
  </section>;
}
