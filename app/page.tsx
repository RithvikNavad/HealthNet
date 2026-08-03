"use client";

import { FormEvent, useMemo, useState } from "react";
import { emptyPatientCase, type IntakeApiResult, type PatientCase } from "./intake-types";

type View = "intake" | "review" | "summary";
type TimelineEvent = PatientCase["timeline"][number] & { id: string };
type Message = { role: "assistant" | "patient"; text: string };

const VISITOR_ID_KEY = "healthnet-public-demo-visitor";

function storedVisitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}

const starterMessages: Message[] = [
  { role: "assistant", text: "Hi! I’ll help organize your symptoms before your appointment. Start wherever feels natural—what has been bothering you?" },
];

const demoMessages: Message[] = [
  { role: "assistant", text: "Hi Maya. I’ll help organize what’s been happening before your appointment. What has been bothering you?" },
  { role: "patient", text: "I’ve been getting dizzy spells for about three weeks, mostly when I stand up." },
  { role: "assistant", text: "Do you remember what was happening around the time the dizziness began?" },
  { role: "patient", text: "My doctor started lisinopril for high blood pressure a few days before it began." },
  { role: "assistant", text: "How long do the spells last, and have you ever fainted?" },
  { role: "patient", text: "Usually 20 to 30 seconds. I haven’t fainted, but I need to hold onto something." },
  { role: "assistant", text: "Have you had chest pain, weakness on one side, or changes in your vision?" },
  { role: "patient", text: "No chest pain or weakness. My vision gets a little dim during the spell, then returns to normal." },
  { role: "assistant", text: "Thanks—that helps clarify the pattern. What would you most like your doctor to help you understand or decide?" },
];

const demoPatientCase: PatientCase = {
  primaryConcern: "Recurring dizziness when standing, beginning shortly after starting lisinopril.",
  historyNarrative: "Maya reports brief episodes of dizziness, primarily after standing. Episodes last approximately 20–30 seconds and include temporary dimming of vision. She has not fainted. Symptoms began a few days after starting lisinopril for high blood pressure.",
  symptomsPresent: ["Dizziness after standing", "Temporary dimming of vision"],
  symptomsDenied: ["Fainting", "Chest pain", "One-sided weakness"],
  relevantHistory: ["High blood pressure"],
  medications: ["Lisinopril 10 mg once daily"],
  allergies: [],
  treatmentsTried: ["Holds onto something or sits down during spells"],
  timeline: [
    { when: "About 3 weeks ago", normalizedDate: null, title: "Started lisinopril", detail: "10 mg once daily for high blood pressure", confidence: "medium" },
    { when: "A few days later", normalizedDate: null, title: "Dizziness began", detail: "Brief spells after standing up", confidence: "medium" },
    { when: "Past 2 weeks", normalizedDate: null, title: "Spells continued", detail: "20–30 seconds with dim vision; no fainting", confidence: "medium" },
    { when: "Today", normalizedDate: null, title: "Preparing for appointment", detail: "Symptoms remain present", confidence: "high" },
  ],
  clinicalConsiderations: [
    { title: "Postural blood-pressure change", rationale: "The episodes occur after standing and began after a blood-pressure medication change.", uncertainty: "Blood-pressure measurements and clinical evaluation are needed." },
    { title: "Other causes of dizziness", rationale: "Dizziness can have several medication, hydration, heart-rhythm, inner-ear, or neurological causes.", uncertainty: "The history alone cannot determine the cause." },
  ],
  physicianQuestions: ["Could my blood-pressure medication be contributing?", "Should my blood pressure be checked lying down and standing?", "Are any tests or medication changes appropriate?"],
  missingInformation: ["Hydration and fluid intake", "Home blood-pressure readings", "Goal for the visit"],
  progress: 78,
};

function timelineFrom(patientCase: PatientCase): TimelineEvent[] {
  return patientCase.timeline.map((item, index) => ({ ...item, id: `${index}-${item.when}-${item.title}` }));
}

export default function Home() {
  const [view, setView] = useState<View>("intake");
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [patientCase, setPatientCase] = useState<PatientCase>(emptyPatientCase);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [input, setInput] = useState("");
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [urgentWarning, setUrgentWarning] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);

  const patientAnswers = messages.filter((message) => message.role === "patient");
  const progress = intakeComplete ? 100 : patientCase.progress;
  const summaryConcern = patientCase.primaryConcern || patientAnswers[0]?.text || "Not collected yet";
  const canReview = intakeComplete || patientAnswers.length >= 3;

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    const answer = input.trim();
    if (!answer || intakeComplete || isSending) return;

    const previousMessages = messages;
    const updatedMessages = [...messages, { role: "patient" as const, text: answer }];
    setMessages(updatedMessages);
    setInput("");
    setErrorMessage("");
    setIsSending(true);

    const resolvedVisitorId = visitorId || storedVisitorId();
    const resolvedVisitId = visitId || window.crypto.randomUUID();
    if (!visitorId) setVisitorId(resolvedVisitorId);
    if (!visitId) setVisitId(resolvedVisitId);

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientMessage: answer, patientCase, conversationId, visitorId: resolvedVisitorId, visitId: resolvedVisitId }),
      });
      const result = await response.json() as IntakeApiResult | { error?: string };
      if (!response.ok || !("patientCase" in result)) {
        throw new Error("error" in result && result.error ? result.error : "The AI could not process that answer.");
      }

      setMessages((current) => [...current, { role: "assistant", text: result.assistantMessage }]);
      setPatientCase(result.patientCase);
      setTimeline(timelineFrom(result.patientCase));
      setIntakeComplete(result.intakeComplete);
      setUrgentWarning(result.urgentWarning);
      setConversationId(result.conversationId);
      setDemoLoaded(false);
    } catch (error) {
      setMessages(previousMessages);
      setInput(answer);
      setErrorMessage(error instanceof Error ? error.message : "The AI could not process that answer. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  function loadDemo() {
    setMessages(demoMessages);
    setPatientCase(demoPatientCase);
    setTimeline(timelineFrom(demoPatientCase));
    setDemoLoaded(true);
    setIntakeComplete(false);
    setErrorMessage("");
    setUrgentWarning(null);
    setConversationId(null);
    setVisitId(null);
  }

  function startOver() {
    setMessages(starterMessages);
    setPatientCase(emptyPatientCase);
    setTimeline([]);
    setDemoLoaded(false);
    setIntakeComplete(false);
    setErrorMessage("");
    setUrgentWarning(null);
    setConversationId(null);
    setVisitId(null);
    setView("intake");
  }

  function updateTimeline(id: string, field: "when" | "title" | "detail", value: string) {
    setTimeline((current) => {
      const updated = current.map((item) => item.id === id ? { ...item, [field]: value } : item);
      setPatientCase((currentCase) => ({ ...currentCase, timeline: updated.map(({ id: _id, ...item }) => item) }));
      return updated;
    });
  }

  const statusLabel = useMemo(() => {
    if (intakeComplete) return "Ready to review";
    if (progress > 70) return "Almost ready to review";
    if (progress > 35) return "Building your history";
    return "Getting started";
  }, [intakeComplete, progress]);

  return (
    <main className="app-shell">
      <aside className="sidebar no-print">
        <button className="brand" onClick={() => setView("intake")} aria-label="HealthNet home"><span className="brand-mark">H</span><span>HealthNet</span></button>
        <nav className="main-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <button className={view === "intake" ? "active" : ""} onClick={() => setView("intake")}><span className="nav-icon">+</span> Health intake</button>
          <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}><span className="nav-icon">≡</span> Review history</button>
          <button className={view === "summary" ? "active" : ""} onClick={() => setView("summary")}><span className="nav-icon">□</span> Visit summary</button>
          <p className="nav-label coming-label">Coming later</p>
          <button disabled><span className="nav-icon">↗</span> Understand records</button><button disabled><span className="nav-icon">⌁</span> Track my health</button>
        </nav>
        <div className="privacy-note"><span className="privacy-dot" /><div><strong>Protected public demo</strong><p>Fictional information only. AI usage is limited.</p></div></div>
        <div className="profile"><div className="avatar">MN</div><div><strong>Maya Nguyen</strong><span>Sample patient</span></div><button aria-label="Profile menu">•••</button></div>
      </aside>

      <section className="workspace">
        <header className="topbar no-print">
          <div className="mobile-brand"><span className="brand-mark">H</span> HealthNet</div>
          <div className="stepper" aria-label="Visit preparation progress">
            <button className={view === "intake" ? "current" : "done"} onClick={() => setView("intake")}><span>1</span> Intake</button><i />
            <button className={view === "review" ? "current" : view === "summary" ? "done" : ""} onClick={() => setView("review")}><span>2</span> Review</button><i />
            <button className={view === "summary" ? "current" : ""} onClick={() => setView("summary")}><span>3</span> Summary</button>
          </div>
          <button className="ghost-button" onClick={startOver}>Start over</button>
        </header>

        {view === "intake" && <div className="intake-page">
          <div className="page-intro no-print"><div><p className="eyebrow">PREPARE FOR YOUR VISIT</p><h1>Tell us what’s been happening</h1><p>Share your story naturally. AI asks focused follow-up questions and organizes the details for you.</p></div><button className="demo-button" onClick={loadDemo}>Load example patient</button></div>
          <div className="intake-grid">
            <section className="conversation-card">
              <div className="conversation-header no-print"><div className="ai-orb"><span /></div><div><strong>HealthNet care agent</strong><span><i /> {conversationId ? "Visit memory active" : "Ready to organize your history"}</span></div><button aria-label="More options">•••</button></div>
              <div className="messages" aria-live="polite">
                <div className="date-divider"><span>Today</span></div>
                {messages.map((message, index) => <div className={`message-row ${message.role}`} key={`${message.role}-${index}`}>{message.role === "assistant" && <div className="mini-orb">H</div>}<div className="message-bubble">{message.text}</div></div>)}
                {isSending && <div className="message-row assistant"><div className="mini-orb">H</div><div className="message-bubble typing-message"><i /><i /><i /></div></div>}
                {urgentWarning && <div className="urgent-warning"><strong>Seek urgent help</strong><p>{urgentWarning}</p></div>}
                {timeline.length > 0 && <div className="insight-card"><span>✓</span><div><strong>Timeline updated</strong><p>HealthNet has organized {timeline.length} patient-reported event{timeline.length === 1 ? "" : "s"} so far.</p></div></div>}
              </div>
              {intakeComplete ? <div className="intake-complete no-print"><span>✓</span><div><strong>Intake complete</strong><p>Your answers are organized and ready for you to check.</p></div><button onClick={() => setView("review")}>Review my history <b>→</b></button></div> :
                <form className="composer no-print" onSubmit={submitAnswer}><label htmlFor="patient-answer">Your answer</label><div><textarea id="patient-answer" value={input} onChange={(event) => setInput(event.target.value)} placeholder={isSending ? "Organizing your answer…" : "Type your answer here…"} rows={2} disabled={isSending} /><button type="submit" aria-label="Send answer" disabled={isSending || !input.trim()}>↑</button></div>{errorMessage ? <p className="intake-error" role="alert">{errorMessage}</p> : <p>You can use everyday language—medical terms aren’t necessary.</p>}</form>}
            </section>

            <aside className="timeline-card">
              <div className="timeline-header"><div><p className="eyebrow">LIVE TIMELINE</p><h2>Your story, in order</h2></div><span>{timeline.length} events</span></div>
              {timeline.length === 0 ? <div className="empty-timeline"><div className="timeline-illustration"><span /><i /><b /></div><h3>Your timeline will appear here</h3><p>As you answer questions, dates and important changes will be organized automatically.</p></div> :
                <div className="timeline-list">{timeline.map((item, index) => <article className="timeline-item" key={item.id}><div className="timeline-rail"><span>{index + 1}</span>{index < timeline.length - 1 && <i />}</div><div className="timeline-content">{editingId === item.id ? <><input value={item.when} onChange={(event) => updateTimeline(item.id, "when", event.target.value)} /><input value={item.title} onChange={(event) => updateTimeline(item.id, "title", event.target.value)} /><textarea value={item.detail} onChange={(event) => updateTimeline(item.id, "detail", event.target.value)} /><button className="save-link" onClick={() => setEditingId(null)}>Save changes</button></> : <><span>{item.when}</span><h3>{item.title}</h3><p>{item.detail}</p><button className="edit-link no-print" onClick={() => setEditingId(item.id)}>Edit</button></>}</div></article>)}</div>}
              <div className="timeline-footer no-print"><span>ⓘ</span> Nothing is final—you’ll review every detail before creating your summary.</div>
            </aside>
          </div>
          <div className="progress-panel no-print"><div><strong>{statusLabel}</strong><span>{progress}% complete</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><button disabled={!canReview} onClick={() => setView("review")}>Review my history <span>→</span></button></div>
        </div>}

        {view === "review" && <ReviewView concern={summaryConcern} timeline={timeline} patientCase={patientCase} onBack={() => setView("intake")} onContinue={() => setView("summary")} />}
        {view === "summary" && <SummaryView concern={summaryConcern} timeline={timeline} patientCase={patientCase} onBack={() => setView("review")} />}
      </section>
    </main>
  );
}

function ReviewView({ concern, timeline, patientCase, onBack, onContinue }: { concern: string; timeline: TimelineEvent[]; patientCase: PatientCase; onBack: () => void; onContinue: () => void }) {
  const details = [...patientCase.symptomsPresent, ...patientCase.relevantHistory, ...patientCase.medications];
  return <div className="review-page">
    <div className="page-intro"><div><p className="eyebrow">REVIEW YOUR HISTORY</p><h1>Make sure we understood correctly</h1><p>Edit anything that doesn’t look right before creating your visit summary.</p></div><span className="review-badge">Patient review required</span></div>
    <div className="review-grid">
      <section className="review-section"><div className="section-heading"><div><span>01</span><h2>Main concern</h2></div><button onClick={onBack}>Edit</button></div><p className="lead-answer">{concern}</p></section>
      <section className="review-section"><div className="section-heading"><div><span>02</span><h2>Organized details</h2></div><button onClick={onBack}>Edit in conversation</button></div>{details.length ? <ul className="answer-list">{details.map((detail, index) => <li key={index}>{detail}</li>)}</ul> : <p className="muted">Complete the intake to add details.</p>}</section>
      <section className="review-section full"><div className="section-heading"><div><span>03</span><h2>Symptom timeline</h2></div><button onClick={onBack}>Edit timeline</button></div>{timeline.length ? <div className="compact-timeline">{timeline.map((item) => <div key={item.id}><strong>{item.when}</strong><span>{item.title}</span><p>{item.detail}</p></div>)}</div> : <p className="muted">No timeline events have been added yet.</p>}</section>
    </div>
    <div className="review-actions"><button className="secondary-button" onClick={onBack}>← Back to intake</button><button className="primary-button" onClick={onContinue}>Create visit summary →</button></div>
  </div>;
}

function SummaryView({ concern, timeline, patientCase, onBack }: { concern: string; timeline: TimelineEvent[]; patientCase: PatientCase; onBack: () => void }) {
  const prepared = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date());
  return <div className="summary-page">
    <div className="summary-toolbar no-print"><div><p className="eyebrow">VISIT SUMMARY</p><h1>Ready for your appointment</h1><p>Print this summary or save it as a PDF to share with your physician.</p></div><div><button className="secondary-button" onClick={onBack}>Edit information</button><button className="primary-button" onClick={() => window.print()}>Print summary</button></div></div>
    <article className="clinical-summary">
      <header className="document-header"><div><span className="document-logo">H</span><div><strong>HealthNet</strong><p>Pre-Visit Patient Summary</p></div></div><div className="document-meta"><span>Prepared</span><strong>{prepared}</strong></div></header>
      <div className="patient-strip"><div><span>PATIENT</span><strong>Sample patient</strong></div><div><span>VISIT TYPE</span><strong>Primary care</strong></div><div><span>INFORMATION SOURCE</span><strong>Patient-reported</strong></div></div>
      <section className="document-section priority"><p className="section-kicker">PRIMARY CONCERN</p><h2>{concern}</h2></section>
      <div className="document-columns"><div>
        <section className="document-section"><p className="section-kicker">HISTORY OF PRESENT ILLNESS</p><p>{patientCase.historyNarrative || "History has not been fully collected yet."}</p></section>
        <section className="document-section"><p className="section-kicker">SYMPTOM TIMELINE</p><div className="document-timeline">{timeline.length ? timeline.map((item) => <div key={item.id}><span>{item.when}</span><p><strong>{item.title}</strong> — {item.detail}</p></div>) : <p>No timeline events collected.</p>}</div></section>
        <section className="document-section"><p className="section-kicker">RELEVANT HISTORY</p><div className="fact-grid"><Fact label="Known history" values={patientCase.relevantHistory} /><Fact label="Medications" values={patientCase.medications} /><Fact label="Reported allergies" values={patientCase.allergies} /><Fact label="Treatments attempted" values={patientCase.treatmentsTried} /></div></section>
      </div><aside>
        <SummaryList className="positives" title="KEY FINDINGS" values={patientCase.symptomsPresent} empty="No key findings collected" />
        <SummaryList className="negatives" title="IMPORTANT NEGATIVES" values={patientCase.symptomsDenied} empty="None explicitly reported" />
        <section className="document-section considerations"><p className="section-kicker">POSSIBLE CONSIDERATIONS</p>{patientCase.clinicalConsiderations.length ? patientCase.clinicalConsiderations.map((item, index) => <div key={index}><strong>{item.title}</strong><p>{item.rationale} {item.uncertainty}</p></div>) : <p>Not enough information collected to suggest discussion points.</p>}</section>
        <section className="document-section questions"><p className="section-kicker">QUESTIONS FOR THE PHYSICIAN</p>{patientCase.physicianQuestions.length ? <ol>{patientCase.physicianQuestions.map((item, index) => <li key={index}>{item}</li>)}</ol> : <p>Complete more of the intake to create questions.</p>}</section>
      </aside></div>
      <footer className="document-footer"><strong>Patient review recommended</strong><p>AI-organized from patient-reported information. This document does not provide a diagnosis or replace clinical evaluation.</p><span>1 / 1</span></footer>
    </article>
  </div>;
}

function Fact({ label, values }: { label: string; values: string[] }) {
  return <div><span>{label}</span><strong>{values.length ? values.join("; ") : "None reported"}</strong></div>;
}

function SummaryList({ className, title, values, empty }: { className: string; title: string; values: string[]; empty: string }) {
  return <section className={`document-section ${className}`}><p className="section-kicker">{title}</p><ul>{values.length ? values.map((item, index) => <li key={index}>{item}</li>) : <li>{empty}</li>}</ul></section>;
}
