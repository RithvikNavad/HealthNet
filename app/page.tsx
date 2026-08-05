"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { emptyPatientCase, type IntakeApiResult, type PatientCase } from "./intake-types";

type View = "home" | "intake" | "timeline" | "records" | "labs" | "medications" | "appointments" | "care-plan" | "review" | "summary";
type TimelineEvent = PatientCase["timeline"][number] & { id: string };
type Message = { role: "assistant" | "patient"; text: string };

const VISITOR_ID_KEY = "healthnet-public-demo-visitor";
const PATIENT_NAME_KEY = "healthnet-patient-name";
const WORKSPACE_KEY = "healthnet-device-workspace";

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

function timelineFrom(patientCase: PatientCase): TimelineEvent[] {
  return patientCase.timeline.map((item, index) => ({ ...item, id: `${index}-${item.when}-${item.title}` }));
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [patientCase, setPatientCase] = useState<PatientCase>(emptyPatientCase);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [input, setInput] = useState("");
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [urgentWarning, setUrgentWarning] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  useEffect(() => {
    const savedName = window.localStorage.getItem(PATIENT_NAME_KEY)?.trim() || "";
    setPatientName(savedName);
    if (!savedName) setNameOpen(true);
    try {
      const savedWorkspace = window.localStorage.getItem(WORKSPACE_KEY);
      if (savedWorkspace) {
        const saved = JSON.parse(savedWorkspace) as { messages?: Message[]; patientCase?: PatientCase; intakeComplete?: boolean; conversationId?: string | null; visitId?: string | null };
        if (saved.messages?.length) setMessages(saved.messages);
        if (saved.patientCase) {
          setPatientCase(saved.patientCase);
          setTimeline(timelineFrom(saved.patientCase));
        }
        setIntakeComplete(Boolean(saved.intakeComplete));
        setConversationId(saved.conversationId || null);
        setVisitId(saved.visitId || null);
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_KEY);
    }
    setWorkspaceLoaded(true);
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ messages, patientCase, intakeComplete, conversationId, visitId }));
  }, [workspaceLoaded, messages, patientCase, intakeComplete, conversationId, visitId]);

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
    } catch (error) {
      setMessages(previousMessages);
      setInput(answer);
      setErrorMessage(error instanceof Error ? error.message : "The AI could not process that answer. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  function savePatientName(name: string) {
    const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!cleaned) return;
    window.localStorage.setItem(PATIENT_NAME_KEY, cleaned);
    setPatientName(cleaned);
    setNameOpen(false);
  }

  const displayName = patientName || "Patient";
  const patientInitials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";

  function startOver() {
    setMessages(starterMessages);
    setPatientCase(emptyPatientCase);
    setTimeline([]);
    setIntakeComplete(false);
    setErrorMessage("");
    setUrgentWarning(null);
    setConversationId(null);
    setVisitId(null);
    window.localStorage.removeItem(WORKSPACE_KEY);
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
  const hasIntakeData = patientAnswers.length > 0 || Boolean(patientCase.primaryConcern) || timeline.length > 0;

  return (
    <main className="app-shell">
      <aside className="sidebar no-print">
        <button className="brand" onClick={() => setView("home")} aria-label="HealthNet home"><span className="brand-mark">H</span><span>HealthNet</span></button>
        <nav className="main-nav" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <NavButton icon="⌂" label="Home" target="home" current={view} onSelect={setView} />
          <NavButton icon="✦" label="Health intake" target="intake" current={view} onSelect={setView} />
          <NavButton icon="↯" label="Timeline" target="timeline" current={view} onSelect={setView} />
          <NavButton icon="▤" label="Records" target="records" current={view} onSelect={setView} />
          <NavButton icon="⌁" label="Lab results" target="labs" current={view} onSelect={setView} />
          <NavButton icon="⊕" label="Medications" target="medications" current={view} onSelect={setView} />
          <NavButton icon="□" label="Appointments" target="appointments" current={view} onSelect={setView} />
          <NavButton icon="✓" label="Care plan" target="care-plan" current={view} onSelect={setView} />
          <NavButton icon="▧" label="Visit summary" target="summary" current={view} onSelect={setView} />
        </nav>
        <div className="sidebar-links"><button>Privacy</button><button>Settings</button><button>Help</button><button className="emergency-link">Emergency</button></div>
        <div className="privacy-note"><span className="privacy-dot" /><div><strong>Protected public demo</strong><p>Fictional information only. AI usage is limited.</p></div></div>
        <button className="profile" onClick={() => setNameOpen(true)} aria-label="Edit patient name"><div className="avatar">{patientInitials}</div><div><strong>{displayName}</strong><span>{patientName ? "Patient profile" : "Set up profile"}</span></div><span className="profile-edit">Edit</span></button>
      </aside>

      <section className="workspace">
        <header className="topbar no-print">
          <button className="mobile-brand" onClick={() => setView("home")}><span className="brand-mark">H</span> HealthNet</button>
          <button className="global-search" onClick={() => setSearchOpen(true)} aria-label="Search HealthNet"><span>⌕</span><b>Search your health information</b><kbd>⌘ K</kbd></button>
          <button className="add-button" onClick={() => setAddOpen(true)}><span>＋</span> Add</button>
        </header>

        {view === "home" && <Dashboard patientName={displayName} hasName={Boolean(patientName)} patientCase={patientCase} timeline={timeline} intakeComplete={intakeComplete} hasIntakeData={hasIntakeData} onEditName={() => setNameOpen(true)} onNavigate={setView} onAdd={() => setAddOpen(true)} />}
        {view === "intake" && <div className="intake-page">
          <div className="page-intro no-print"><div><p className="eyebrow">PREPARE FOR YOUR VISIT</p><h1>Tell us what’s been happening</h1><p>Share your story naturally. AI asks focused follow-up questions and organizes the details for you.</p></div>{hasIntakeData && <button className="demo-button" onClick={() => { if (window.confirm("Start a new intake and clear the current fictional patient history?")) startOver(); }}>Start new intake</button>}</div>
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
        {view === "summary" && (hasIntakeData ? <SummaryView patientName={displayName} concern={summaryConcern} timeline={timeline} patientCase={patientCase} onBack={() => setView("review")} /> : <EmptyDestination icon="▧" eyebrow="VISIT SUMMARY" title="No visit summary yet" text="Complete a health intake first. HealthNet will organize only the information you provide into a printable summary." action="Start health intake" onAction={() => setView("intake")} />)}
        {view === "timeline" && <TimelineWorkspace timeline={timeline} editingId={editingId} setEditingId={setEditingId} updateTimeline={updateTimeline} onIntake={() => setView("intake")} />}
        {view === "records" && <ModulePreview kind="records" onAdd={() => setAddOpen(true)} />}
        {view === "labs" && <ModulePreview kind="labs" onAdd={() => setAddOpen(true)} />}
        {view === "medications" && <ModulePreview kind="medications" onAdd={() => setAddOpen(true)} />}
        {view === "appointments" && <AppointmentsPreview hasIntakeData={hasIntakeData} onPrepare={() => setView("intake")} />}
        {view === "care-plan" && <CarePlanPreview patientCase={patientCase} hasIntakeData={hasIntakeData} onNavigate={setView} />}
      </section>
      <nav className="mobile-nav no-print" aria-label="Mobile navigation">
        <NavButton icon="⌂" label="Home" target="home" current={view} onSelect={setView} />
        <NavButton icon="✦" label="Intake" target="intake" current={view} onSelect={setView} />
        <NavButton icon="▤" label="Records" target="records" current={view} onSelect={setView} />
        <NavButton icon="✓" label="Care plan" target="care-plan" current={view} onSelect={setView} />
        <button onClick={() => setAddOpen(true)}><span>＋</span>More</button>
      </nav>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} onNavigate={(next) => { setView(next); setSearchOpen(false); }} />}
      {addOpen && <AddModal onClose={() => setAddOpen(false)} onNavigate={(next) => { setView(next); setAddOpen(false); }} />}
      {nameOpen && <NameModal currentName={patientName} canClose={Boolean(patientName)} onClose={() => setNameOpen(false)} onSave={savePatientName} />}
    </main>
  );
}

function NavButton({ icon, label, target, current, onSelect }: { icon: string; label: string; target: View; current: View; onSelect: (view: View) => void }) {
  const active = current === target || (target === "intake" && (current === "review" || current === "summary"));
  return <button className={active ? "active" : ""} onClick={() => onSelect(target)}><span className="nav-icon">{icon}</span>{label}</button>;
}

function Dashboard({ patientName, hasName, patientCase, timeline, intakeComplete, hasIntakeData, onEditName, onNavigate, onAdd }: { patientName: string; hasName: boolean; patientCase: PatientCase; timeline: TimelineEvent[]; intakeComplete: boolean; hasIntakeData: boolean; onEditName: () => void; onNavigate: (view: View) => void; onAdd: () => void }) {
  const attentionItems = patientCase.missingInformation;
  const questions = patientCase.physicianQuestions;
  return <div className="dashboard-page">
    <section className="welcome-row"><div><p className="eyebrow">YOUR HEALTHNET HOME</p><h1>{hasName ? `Good morning, ${patientName}` : "Welcome to HealthNet"}</h1><p>What would you like help with today? {!hasName && <button className="inline-name-button" onClick={onEditName}>Add your name</button>}</p></div></section>
    <section className="action-grid" aria-label="Quick actions">
      <ActionCard icon="□" tone="blue" title="Prepare for an appointment" text="Organize your concerns and create a one-page visit agenda." action="Start preparing" onClick={() => onNavigate("appointments")} />
      <ActionCard icon="✦" tone="teal" title="Describe a new concern" text="Talk with HealthNet and build a clear symptom history." action="Start health intake" onClick={() => onNavigate("intake")} />
      <ActionCard icon="▤" tone="violet" title="Understand a medical document" text="Turn a written report into a plain-language explanation." action="Open records" onClick={() => onNavigate("records")} />
      <ActionCard icon="✓" tone="green" title="Review your care plan" text="See appointments, medications, tests, and next steps together." action="View care plan" onClick={() => onNavigate("care-plan")} />
    </section>
    <div className="dashboard-columns">
      <div className="dashboard-main">
        <section className="dashboard-card tasks-card"><div className="card-title"><div><p className="eyebrow">NEXT STEPS</p><h2>What needs your attention</h2></div>{attentionItems.length > 0 && <span className="count-badge">{attentionItems.length} to review</span>}</div>
          {attentionItems.length > 0 ? attentionItems.map((item, index) => <TaskRow key={`${item}-${index}`} checked={false} title={item} meta="Missing information identified during intake" tag="AI-organized" />) : <DashboardEmpty icon="✓" title="No next steps yet" text="After your intake, information that still needs clarification will appear here." action="Start health intake" onAction={() => onNavigate("intake")} />}
        </section>
        <section className="dashboard-card"><div className="card-title"><div><p className="eyebrow">YOUR HEALTH INFORMATION</p><h2>From your intake</h2></div>{hasIntakeData && <button onClick={() => onNavigate("review")}>Review all</button>}</div>
          {hasIntakeData ? <><button className="health-info-row" onClick={() => onNavigate("review")}><span className="record-icon">✦</span><div><strong>{patientCase.primaryConcern || "Health concern in progress"}</strong><p>{intakeComplete ? "Intake ready for review" : `${patientCase.progress}% of intake organized`}</p></div><span className="source-pill patient-source">Patient-reported</span><b>›</b></button>{timeline.length > 0 && <button className="health-info-row" onClick={() => onNavigate("timeline")}><span className="record-icon lab">↯</span><div><strong>Health timeline</strong><p>{timeline.length} event{timeline.length === 1 ? "" : "s"} organized from the conversation</p></div><span className="source-pill patient-source">Patient-reported</span><b>›</b></button>}</> : <DashboardEmpty icon="✦" title="Nothing added yet" text="Your concern, timeline, and summary will appear here after you begin talking with the care agent." action="Begin conversation" onAction={() => onNavigate("intake")} />}
        </section>
      </div>
      <aside className="dashboard-side">
        <section className="dashboard-card appointment-empty"><p className="eyebrow">NEXT APPOINTMENT</p><DashboardEmpty icon="□" title="No appointment added" text="Appointment details will appear here only after you add them." action="Open appointments" onAction={() => onNavigate("appointments")} /></section>
        <section className="dashboard-card questions-card"><div className="card-title"><div><p className="eyebrow">QUESTIONS</p><h2>Ask your physician</h2></div>{questions.length > 0 && <span>{questions.length}</span>}</div>{questions.length > 0 ? <>{questions.slice(0, 3).map((question, index) => <p key={`${question}-${index}`}>{question}</p>)}<button onClick={() => onNavigate("summary")}>View in visit summary</button></> : <DashboardEmpty icon="?" title="No questions yet" text="HealthNet will suggest questions based only on the concern you describe." action="Start health intake" onAction={() => onNavigate("intake")} />}</section>
        <section className="workspace-tip"><span>✦</span><div><strong>{hasIntakeData ? "Your workspace is updating" : "Start with your own story"}</strong><p>{hasIntakeData ? "HealthNet is using your conversation to organize this workspace. Review every detail before sharing it." : "Describe a fictional health concern and the AI will begin building your personalized workspace."}</p><button onClick={() => onNavigate(hasIntakeData ? "review" : "intake")}>{hasIntakeData ? "Review organized information" : "Begin health intake"}</button></div></section>
      </aside>
    </div>
    <div className="dashboard-disclaimer"><span>ⓘ</span><p><strong>HealthNet helps you organize health information.</strong> It does not diagnose conditions or replace professional medical care.</p><button onClick={onAdd}>＋ Add health information</button></div>
  </div>;
}

function DashboardEmpty({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="dashboard-empty"><span>{icon}</span><div><strong>{title}</strong><p>{text}</p><button onClick={onAction}>{action} →</button></div></div>;
}

function EmptyDestination({ icon, eyebrow, title, text, action, onAction }: { icon: string; eyebrow: string; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="module-page"><div className="module-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div></div><section className="full-timeline-card"><div className="empty-module"><span>{icon}</span><h2>{title}</h2><p>{text}</p><button onClick={onAction}>{action}</button></div></section></div>;
}

function ActionCard({ icon, tone, title, text, action, onClick }: { icon: string; tone: string; title: string; text: string; action: string; onClick: () => void }) {
  return <button className={`action-card ${tone}`} onClick={onClick}><span className="action-icon">{icon}</span><div><h2>{title}</h2><p>{text}</p><strong>{action} <b>→</b></strong></div></button>;
}

function TaskRow({ checked, title, meta, tag }: { checked: boolean; title: string; meta: string; tag: string }) {
  return <div className={`care-task ${checked ? "complete" : ""}`}><button aria-label={checked ? "Completed" : "Mark complete"}>{checked ? "✓" : ""}</button><div><strong>{title}</strong><p>{meta}</p></div><span>{tag}</span></div>;
}

function TimelineWorkspace({ timeline, editingId, setEditingId, updateTimeline, onIntake }: { timeline: TimelineEvent[]; editingId: string | null; setEditingId: (id: string | null) => void; updateTimeline: (id: string, field: "when" | "title" | "detail", value: string) => void; onIntake: () => void }) {
  return <div className="module-page timeline-workspace"><div className="module-heading"><div><p className="eyebrow">YOUR HEALTH STORY</p><h1>Health timeline</h1><p>Review symptoms, treatments, medication changes, and appointments in one clear sequence.</p></div><button className="primary-button" onClick={onIntake}>＋ Add through intake</button></div>
    <div className="source-legend"><span><i className="patient-dot" />Patient-reported</span><span><i className="record-dot" />Uploaded record</span><span><i className="clinician-dot" />Clinician instruction</span></div>
    <section className="full-timeline-card">{timeline.length === 0 ? <div className="empty-module"><span>↯</span><h2>Your timeline is ready to be built</h2><p>Complete a health intake and HealthNet will organize dates, symptom changes, treatments, and other important events here.</p><button onClick={onIntake}>Start health intake</button></div> : <div className="full-timeline-list">{timeline.map((item, index) => <article key={item.id}><div className="full-date"><strong>{item.when}</strong><span>{item.confidence === "high" ? "Exact" : "Approximate"}</span></div><div className="full-rail"><i />{index < timeline.length - 1 && <b />}</div><div className="full-event">{editingId === item.id ? <><input value={item.when} onChange={(event) => updateTimeline(item.id, "when", event.target.value)} /><input value={item.title} onChange={(event) => updateTimeline(item.id, "title", event.target.value)} /><textarea value={item.detail} onChange={(event) => updateTimeline(item.id, "detail", event.target.value)} /><button className="save-link" onClick={() => setEditingId(null)}>Save changes</button></> : <><div><span className="source-pill patient-source">Patient-reported</span><button onClick={() => setEditingId(item.id)}>Edit</button></div><h2>{item.title}</h2><p>{item.detail}</p></>}</div></article>)}</div>}</section>
  </div>;
}

const moduleContent = {
  records: { eyebrow: "MEDICAL RECORDS", title: "Understand your health documents", text: "Keep reports organized and turn complex medical language into clear, patient-friendly explanations.", icon: "▤", action: "Add a medical document", steps: ["Upload a written report or visit note", "Review important findings in plain language", "Save questions for your physician"] },
  labs: { eyebrow: "LAB RESULTS", title: "See what changed over time", text: "Organize results, reference ranges, and trends so you can prepare better questions for your care team.", icon: "⌁", action: "Add lab results", steps: ["Add results manually or from a report", "Compare values and reference ranges", "Bring trend questions to your physician"] },
  medications: { eyebrow: "MEDICATIONS", title: "Keep every medication in one place", text: "Create a clear medication list with doses, timing, purpose, prescriber, and changes over time.", icon: "⊕", action: "Add a medication", steps: ["Record prescriptions and supplements", "Track start dates and side effects", "Print an up-to-date medication list"] },
} as const;

function ModulePreview({ kind, onAdd }: { kind: keyof typeof moduleContent; onAdd: () => void }) {
  const content = moduleContent[kind];
  return <div className="module-page"><div className="module-heading"><div><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.text}</p></div><span className="development-badge">Next feature</span></div><section className="module-preview-card"><div className="module-visual"><span>{content.icon}</span><i /><i /><i /></div><div><span className="coming-chip">Planned for the next build</span><h2>A connected workspace—not another folder</h2><p>Information added here will connect to your timeline, appointment agenda, clinician-ready summary, and care plan.</p><ol>{content.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol><button onClick={onAdd}>{content.action}</button><small>The interface is ready; processing and permanent storage will be connected in the next phase.</small></div></section></div>;
}

function AppointmentsPreview({ hasIntakeData, onPrepare }: { hasIntakeData: boolean; onPrepare: () => void }) {
  return <div className="module-page"><div className="module-heading"><div><p className="eyebrow">APPOINTMENTS</p><h1>Walk in prepared</h1><p>Bring your goals, recent changes, timeline, and questions together before the visit.</p></div></div><section className="full-timeline-card"><div className="empty-module"><span>□</span><h2>No appointment added</h2><p>HealthNet will never invent appointment details. When appointment entry is connected, the date, clinician, location, and visit agenda will appear here.</p><button onClick={onPrepare}>{hasIntakeData ? "Continue health intake" : "Start health intake"}</button></div></section></div>;
}

function CarePlanPreview({ patientCase, hasIntakeData, onNavigate }: { patientCase: PatientCase; hasIntakeData: boolean; onNavigate: (view: View) => void }) {
  const items = patientCase.missingInformation;
  return <div className="module-page"><div className="module-heading"><div><p className="eyebrow">CARE PLAN</p><h1>Your next steps, together</h1><p>See what needs to happen next and where every instruction came from.</p></div></div>{items.length > 0 ? <section className="dashboard-card care-list"><div className="card-title"><div><p className="eyebrow">FROM YOUR INTAKE</p><h2>Information to clarify</h2></div><span className="count-badge">{items.length} items</span></div>{items.map((item, index) => <TaskRow key={`${item}-${index}`} checked={false} title={item} meta="Missing information identified during intake" tag="AI-organized" />)}<div className="care-plan-actions"><button onClick={() => onNavigate("intake")}>Continue intake</button><button onClick={() => onNavigate("summary")}>Review summary</button></div></section> : <section className="full-timeline-card"><div className="empty-module"><span>✓</span><h2>No care-plan items yet</h2><p>{hasIntakeData ? "No unfinished information has been identified from the current intake. Clinician instructions and after-visit tasks will appear only after they are added." : "Begin a health intake first. HealthNet will organize missing information here without inventing clinical instructions or tasks."}</p><button onClick={() => onNavigate("intake")}>{hasIntakeData ? "Return to intake" : "Start health intake"}</button></div></section>}</div>;
}

function SearchModal({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="search-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search HealthNet"><div className="search-input"><span>⌕</span><input autoFocus placeholder="Search your HealthNet workspace…" /><button onClick={onClose}>Esc</button></div><p>QUICK LINKS</p><button onClick={() => onNavigate("intake")}><span>✦</span><div><strong>Health intake</strong><small>Your conversation with the care agent</small></div><b>›</b></button><button onClick={() => onNavigate("timeline")}><span>↯</span><div><strong>Health timeline</strong><small>Events organized from your information</small></div><b>›</b></button><button onClick={() => onNavigate("summary")}><span>▧</span><div><strong>Visit summary</strong><small>Your clinician-ready information</small></div><b>›</b></button></section></div>;
}

function AddModal({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  const options: { icon: string; title: string; text: string; view: View }[] = [{ icon: "✦", title: "New health concern", text: "Start a guided intake", view: "intake" }, { icon: "▤", title: "Medical document", text: "Add a report or visit note", view: "records" }, { icon: "⊕", title: "Medication", text: "Add a dose and schedule", view: "medications" }, { icon: "⌁", title: "Lab result", text: "Record a result or range", view: "labs" }, { icon: "□", title: "Appointment", text: "Prepare for a visit", view: "appointments" }, { icon: "↯", title: "Timeline event", text: "Review your health story", view: "timeline" }];
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="add-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add health information"><header><div><p className="eyebrow">ADD TO HEALTHNET</p><h2>What would you like to add?</h2></div><button onClick={onClose}>×</button></header><div>{options.map((option) => <button key={option.title} onClick={() => onNavigate(option.view)}><span>{option.icon}</span><div><strong>{option.title}</strong><small>{option.text}</small></div><b>›</b></button>)}</div><p>Use fictional information only in this public prototype.</p></section></div>;
}

function NameModal({ currentName, canClose, onClose, onSave }: { currentName: string; canClose: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(currentName);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(name);
  }
  return <div className="modal-backdrop name-backdrop" onMouseDown={() => canClose && onClose()}><section className="name-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="name-title"><div className="name-mark">H</div><p className="eyebrow">WELCOME TO HEALTHNET</p><h2 id="name-title">What should we call you?</h2><p>Your name personalizes your workspace and printed visit summary. It stays on this device for this prototype.</p><form onSubmit={submit}><label htmlFor="patient-name">Your name</label><input id="patient-name" autoFocus autoComplete="name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" /><button type="submit" disabled={!name.trim()}>Save and continue</button></form>{canClose && <button className="name-cancel" onClick={onClose}>Cancel</button>}<small>Please use fictional information while testing this public demo.</small></section></div>;
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

function SummaryView({ patientName, concern, timeline, patientCase, onBack }: { patientName: string; concern: string; timeline: TimelineEvent[]; patientCase: PatientCase; onBack: () => void }) {
  const prepared = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date());
  return <div className="summary-page">
    <div className="summary-toolbar no-print"><div><p className="eyebrow">VISIT SUMMARY</p><h1>Ready for your appointment</h1><p>Print this summary or save it as a PDF to share with your physician.</p></div><div><button className="secondary-button" onClick={onBack}>Edit information</button><button className="primary-button" onClick={() => window.print()}>Print summary</button></div></div>
    <article className="clinical-summary">
      <header className="document-header"><div><span className="document-logo">H</span><div><strong>HealthNet</strong><p>Pre-Visit Patient Summary</p></div></div><div className="document-meta"><span>Prepared</span><strong>{prepared}</strong></div></header>
      <div className="patient-strip"><div><span>PATIENT</span><strong>{patientName}</strong></div><div><span>VISIT TYPE</span><strong>Primary care</strong></div><div><span>INFORMATION SOURCE</span><strong>Patient-reported</strong></div></div>
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
