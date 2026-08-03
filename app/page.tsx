"use client";

import { FormEvent, useMemo, useState } from "react";

type View = "intake" | "review" | "summary";
type TimelineEvent = { id: number; when: string; title: string; detail: string };
type Message = { role: "assistant" | "patient"; text: string };

const intakeQuestions = [
  "Tell me what has been bothering you, in your own words.",
  "When did this first begin? An approximate date is completely fine.",
  "How would you describe the feeling, and how severe is it from 0 to 10?",
  "What seems to trigger it or make it better?",
  "Have you noticed anything else at the same time, such as nausea, weakness, chest pain, or vision changes?",
  "Have you started or changed any medications recently?",
];

const demoMessages: Message[] = [
  { role: "assistant", text: "Hi Maya. I’ll help organize what’s been happening before your appointment. Start wherever feels natural—what has been bothering you?" },
  { role: "patient", text: "I’ve been getting dizzy spells for about three weeks, mostly when I stand up." },
  { role: "assistant", text: "I’m sorry you’ve been dealing with that. Do you remember what was happening around the time the dizziness began?" },
  { role: "patient", text: "My doctor started lisinopril for high blood pressure a few days before it began." },
  { role: "assistant", text: "That timing is helpful. How long do the spells last, and have you ever fainted?" },
  { role: "patient", text: "Usually 20 to 30 seconds. I haven’t fainted, but I need to hold onto something." },
  { role: "assistant", text: "Got it. Have you had chest pain, a racing heartbeat, weakness on one side, or changes in your vision?" },
  { role: "patient", text: "No chest pain or weakness. My vision gets a little dim during the spell, then returns to normal." },
  { role: "assistant", text: "Thanks—that helps clarify the pattern. Have you started or changed any medications recently?" },
];

const demoTimeline: TimelineEvent[] = [
  { id: 1, when: "About 3 weeks ago", title: "Started lisinopril", detail: "10 mg once daily for high blood pressure" },
  { id: 2, when: "A few days later", title: "Dizziness began", detail: "Brief spells after standing up" },
  { id: 3, when: "Past 2 weeks", title: "Spells continued", detail: "20–30 seconds, dim vision, no fainting" },
  { id: 4, when: "Today", title: "Preparing for appointment", detail: "Symptoms remain present" },
];

const starterMessages: Message[] = [
  { role: "assistant", text: "Hi! I’ll help organize your symptoms before your appointment. Start wherever feels natural—what has been bothering you?" },
];

export default function Home() {
  const [view, setView] = useState<View>("intake");
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const progress = intakeComplete ? 100 : demoLoaded ? 78 : Math.min(12 + step * 14, 82);
  const patientAnswers = messages.filter((message) => message.role === "patient");

  const summaryConcern = demoLoaded
    ? "Recurring dizziness when standing, beginning shortly after starting lisinopril."
    : patientAnswers[0]?.text || "Not collected yet";

  const canReview = demoLoaded || patientAnswers.length >= 3;

  function submitAnswer(event: FormEvent) {
    event.preventDefault();
    const answer = input.trim();
    if (!answer || intakeComplete) return;

    const isLastQuestion = step === intakeQuestions.length - 1;
    const nextStep = step + 1;
    const nextQuestion = isLastQuestion
      ? "Thank you—your intake is complete. I’ve organized your answers and timeline so you can review them before creating your visit summary."
      : intakeQuestions[nextStep];
    setMessages((current) => [
      ...current,
      { role: "patient", text: answer },
      { role: "assistant", text: nextQuestion },
    ]);

    if (step === 1 || (step === 5 && !demoLoaded)) {
      setTimeline((current) => [
        ...current,
        {
          id: Date.now(),
          when: step === 1 ? "Patient-reported onset" : "Recent change",
          title: step === 1 ? "Symptoms began" : "Medication update",
          detail: answer,
        },
      ]);
    }

    if (isLastQuestion) {
      setIntakeComplete(true);
    } else {
      setStep(nextStep);
    }
    setInput("");
  }

  function loadDemo() {
    setMessages(demoMessages);
    setTimeline(demoTimeline);
    setStep(5);
    setDemoLoaded(true);
    setIntakeComplete(false);
  }

  function startOver() {
    setMessages(starterMessages);
    setTimeline([]);
    setStep(0);
    setDemoLoaded(false);
    setIntakeComplete(false);
    setView("intake");
  }

  function updateTimeline(id: number, field: "when" | "title" | "detail", value: string) {
    setTimeline((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
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
        <button className="brand" onClick={() => setView("intake")} aria-label="HealthNet home">
          <span className="brand-mark">H</span>
          <span>HealthNet</span>
        </button>

        <nav className="main-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <button className={view === "intake" ? "active" : ""} onClick={() => setView("intake")}>
            <span className="nav-icon">+</span> Health intake
          </button>
          <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}>
            <span className="nav-icon">≡</span> Review history
          </button>
          <button className={view === "summary" ? "active" : ""} onClick={() => setView("summary")}>
            <span className="nav-icon">□</span> Visit summary
          </button>
          <p className="nav-label coming-label">Coming later</p>
          <button disabled><span className="nav-icon">↗</span> Understand records</button>
          <button disabled><span className="nav-icon">⌁</span> Track my health</button>
        </nav>

        <div className="privacy-note">
          <span className="privacy-dot" />
          <div><strong>Demo environment</strong><p>Use fictional patient information only.</p></div>
        </div>

        <div className="profile">
          <div className="avatar">MN</div>
          <div><strong>Maya Nguyen</strong><span>Sample patient</span></div>
          <button aria-label="Profile menu">•••</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar no-print">
          <div className="mobile-brand"><span className="brand-mark">H</span> HealthNet</div>
          <div className="stepper" aria-label="Visit preparation progress">
            <button className={view === "intake" ? "current" : "done"} onClick={() => setView("intake")}><span>1</span> Intake</button>
            <i />
            <button className={view === "review" ? "current" : view === "summary" ? "done" : ""} onClick={() => setView("review")}><span>2</span> Review</button>
            <i />
            <button className={view === "summary" ? "current" : ""} onClick={() => setView("summary")}><span>3</span> Summary</button>
          </div>
          <button className="ghost-button" onClick={startOver}>Start over</button>
        </header>

        {view === "intake" && (
          <div className="intake-page">
            <div className="page-intro no-print">
              <div><p className="eyebrow">PREPARE FOR YOUR VISIT</p><h1>Tell us what’s been happening</h1><p>Share your story naturally. We’ll ask focused follow-up questions and organize the details for you.</p></div>
              <button className="demo-button" onClick={loadDemo}>Load example patient</button>
            </div>

            <div className="intake-grid">
              <section className="conversation-card">
                <div className="conversation-header no-print">
                  <div className="ai-orb"><span /></div>
                  <div><strong>Care guide</strong><span><i /> Organizing your history</span></div>
                  <button aria-label="More options">•••</button>
                </div>
                <div className="messages" aria-live="polite">
                  <div className="date-divider"><span>Today</span></div>
                  {messages.map((message, index) => (
                    <div className={`message-row ${message.role}`} key={`${message.role}-${index}`}>
                      {message.role === "assistant" && <div className="mini-orb">C</div>}
                      <div className="message-bubble">{message.text}</div>
                    </div>
                  ))}
                  {demoLoaded && (
                    <div className="insight-card">
                      <span>✓</span><div><strong>Important detail captured</strong><p>The dizziness began shortly after a medication change and is triggered by standing.</p></div>
                    </div>
                  )}
                </div>
                {intakeComplete ? (
                  <div className="intake-complete no-print">
                    <span>✓</span>
                    <div><strong>Intake complete</strong><p>Your answers are organized and ready for you to check.</p></div>
                    <button onClick={() => setView("review")}>Review my history <b>→</b></button>
                  </div>
                ) : (
                  <form className="composer no-print" onSubmit={submitAnswer}>
                    <label htmlFor="patient-answer">Your answer</label>
                    <div>
                      <textarea id="patient-answer" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type your answer here…" rows={2} />
                      <button type="submit" aria-label="Send answer">↑</button>
                    </div>
                    <p>You can use everyday language—medical terms aren’t necessary.</p>
                  </form>
                )}
              </section>

              <aside className="timeline-card">
                <div className="timeline-header">
                  <div><p className="eyebrow">LIVE TIMELINE</p><h2>Your story, in order</h2></div>
                  <span>{timeline.length} events</span>
                </div>
                {timeline.length === 0 ? (
                  <div className="empty-timeline">
                    <div className="timeline-illustration"><span /><i /><b /></div>
                    <h3>Your timeline will appear here</h3>
                    <p>As you answer questions, dates and important changes will be organized automatically.</p>
                  </div>
                ) : (
                  <div className="timeline-list">
                    {timeline.map((item, index) => (
                      <article className="timeline-item" key={item.id}>
                        <div className="timeline-rail"><span>{index + 1}</span>{index < timeline.length - 1 && <i />}</div>
                        <div className="timeline-content">
                          {editingId === item.id ? (
                            <>
                              <input value={item.when} onChange={(event) => updateTimeline(item.id, "when", event.target.value)} />
                              <input value={item.title} onChange={(event) => updateTimeline(item.id, "title", event.target.value)} />
                              <textarea value={item.detail} onChange={(event) => updateTimeline(item.id, "detail", event.target.value)} />
                              <button className="save-link" onClick={() => setEditingId(null)}>Save changes</button>
                            </>
                          ) : (
                            <>
                              <span>{item.when}</span><h3>{item.title}</h3><p>{item.detail}</p>
                              <button className="edit-link no-print" onClick={() => setEditingId(item.id)}>Edit</button>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <div className="timeline-footer no-print"><span>ⓘ</span> Nothing is final—you’ll review every detail before creating your summary.</div>
              </aside>
            </div>

            <div className="progress-panel no-print">
              <div><strong>{statusLabel}</strong><span>{progress}% complete</span></div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
              <button disabled={!canReview} onClick={() => setView("review")}>Review my history <span>→</span></button>
            </div>
          </div>
        )}

        {view === "review" && (
          <ReviewView concern={summaryConcern} timeline={timeline} messages={messages} onBack={() => setView("intake")} onContinue={() => setView("summary")} />
        )}

        {view === "summary" && (
          <SummaryView concern={summaryConcern} timeline={timeline.length ? timeline : demoTimeline} onBack={() => setView("review")} />
        )}
      </section>
    </main>
  );
}

function ReviewView({ concern, timeline, messages, onBack, onContinue }: { concern: string; timeline: TimelineEvent[]; messages: Message[]; onBack: () => void; onContinue: () => void }) {
  const answers = messages.filter((message) => message.role === "patient").map((message) => message.text);
  return (
    <div className="review-page">
      <div className="page-intro"><div><p className="eyebrow">REVIEW YOUR HISTORY</p><h1>Make sure we understood correctly</h1><p>Edit anything that doesn’t look right before creating your visit summary.</p></div><span className="review-badge">Patient review required</span></div>
      <div className="review-grid">
        <section className="review-section"><div className="section-heading"><div><span>01</span><h2>Main concern</h2></div><button>Edit</button></div><p className="lead-answer">{concern}</p></section>
        <section className="review-section"><div className="section-heading"><div><span>02</span><h2>Details you shared</h2></div><button>Edit in conversation</button></div>{answers.length ? <ul className="answer-list">{answers.map((answer, index) => <li key={index}>{answer}</li>)}</ul> : <p className="muted">Complete the intake to add details.</p>}</section>
        <section className="review-section full"><div className="section-heading"><div><span>03</span><h2>Symptom timeline</h2></div><button onClick={onBack}>Edit timeline</button></div>{timeline.length ? <div className="compact-timeline">{timeline.map((item) => <div key={item.id}><strong>{item.when}</strong><span>{item.title}</span><p>{item.detail}</p></div>)}</div> : <p className="muted">No timeline events have been added yet.</p>}</section>
      </div>
      <div className="review-actions"><button className="secondary-button" onClick={onBack}>← Back to intake</button><button className="primary-button" onClick={onContinue}>Create visit summary →</button></div>
    </div>
  );
}

function SummaryView({ concern, timeline, onBack }: { concern: string; timeline: TimelineEvent[]; onBack: () => void }) {
  return (
    <div className="summary-page">
      <div className="summary-toolbar no-print"><div><p className="eyebrow">VISIT SUMMARY</p><h1>Ready for your appointment</h1><p>Print this summary or save it as a PDF to share with your physician.</p></div><div><button className="secondary-button" onClick={onBack}>Edit information</button><button className="primary-button" onClick={() => window.print()}>Print summary</button></div></div>
      <article className="clinical-summary">
        <header className="document-header"><div><span className="document-logo">H</span><div><strong>HealthNet</strong><p>Pre-Visit Patient Summary</p></div></div><div className="document-meta"><span>Prepared</span><strong>August 3, 2026</strong></div></header>
        <div className="patient-strip"><div><span>PATIENT</span><strong>Maya Nguyen</strong></div><div><span>AGE</span><strong>42 years</strong></div><div><span>VISIT TYPE</span><strong>Primary care</strong></div><div><span>INFORMATION SOURCE</span><strong>Patient-reported</strong></div></div>
        <section className="document-section priority"><p className="section-kicker">PRIMARY CONCERN</p><h2>{concern}</h2></section>
        <div className="document-columns">
          <div>
            <section className="document-section"><p className="section-kicker">HISTORY OF PRESENT ILLNESS</p><p>Maya reports brief episodes of dizziness, primarily after standing. Episodes last approximately 20–30 seconds and are accompanied by temporary dimming of vision. She has not fainted. Symptoms began a few days after starting lisinopril.</p></section>
            <section className="document-section"><p className="section-kicker">SYMPTOM TIMELINE</p><div className="document-timeline">{timeline.map((item) => <div key={item.id}><span>{item.when}</span><p><strong>{item.title}</strong> — {item.detail}</p></div>)}</div></section>
            <section className="document-section"><p className="section-kicker">RELEVANT HISTORY</p><div className="fact-grid"><div><span>Known condition</span><strong>High blood pressure</strong></div><div><span>Recent medication</span><strong>Lisinopril 10 mg daily</strong></div><div><span>Reported allergy</span><strong>None reported</strong></div><div><span>Treatment attempted</span><strong>Sits down during spells</strong></div></div></section>
          </div>
          <aside>
            <section className="document-section positives"><p className="section-kicker">KEY FINDINGS</p><ul><li>Dizziness triggered by standing</li><li>Brief duration: 20–30 seconds</li><li>Temporary dimming of vision</li><li>Started after medication change</li></ul></section>
            <section className="document-section negatives"><p className="section-kicker">IMPORTANT NEGATIVES</p><ul><li>No fainting reported</li><li>No chest pain reported</li><li>No one-sided weakness reported</li></ul></section>
            <section className="document-section considerations"><p className="section-kicker">POSSIBLE CONSIDERATIONS</p><div><strong>Postural blood-pressure change</strong><p>Timing with standing and a recent medication change may be relevant. Blood pressure measurements and clinical evaluation are needed.</p></div><div><strong>Other causes of dizziness</strong><p>Hydration, heart rhythm, inner-ear, neurological, and other causes cannot be assessed from this history alone.</p></div></section>
            <section className="document-section questions"><p className="section-kicker">QUESTIONS FOR THE PHYSICIAN</p><ol><li>Could my blood-pressure medication be contributing?</li><li>Should my blood pressure be checked lying down and standing?</li><li>Are any tests or medication changes appropriate?</li></ol></section>
          </aside>
        </div>
        <footer className="document-footer"><strong>Patient-reviewed summary</strong><p>AI-organized from patient-reported information. This document does not provide a diagnosis or replace clinical evaluation.</p><span>1 / 1</span></footer>
      </article>
    </div>
  );
}
