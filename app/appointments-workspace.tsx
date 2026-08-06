"use client";

import { FormEvent, useMemo, useState } from "react";
import type { PatientCase } from "./intake-types";
import { appointmentTimestamp, persistAppointments, type HealthNetAppointment } from "../lib/appointment-storage";

type AppointmentDraft = Omit<HealthNetAppointment, "id" | "status" | "createdAt" | "updatedAt">;

const blankDraft = (date: string): AppointmentDraft => ({
  title: "",
  visitType: "Primary care",
  date,
  time: "09:00",
  clinician: "",
  location: "",
  reason: "",
  goal: "",
  concerns: "",
  questions: "",
  notes: "",
});

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", options || { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export default function AppointmentsWorkspace({ appointments, patientCase, onChange }: {
  appointments: HealthNetAppointment[];
  patientCase: PatientCase;
  onChange: (appointments: HealthNetAppointment[]) => void;
}) {
  const today = localDateKey(new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [draft, setDraft] = useState<AppointmentDraft>(() => blankDraft(today));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");

  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  const sortedAppointments = useMemo(() => [...appointments].sort((left, right) => appointmentTimestamp(left) - appointmentTimestamp(right)), [appointments]);
  const selectedAppointments = sortedAppointments.filter((appointment) => appointment.date === selectedDate);
  const upcomingAppointments = sortedAppointments.filter((appointment) => appointment.status === "scheduled" && appointmentTimestamp(appointment) >= new Date(`${today}T00:00:00`).getTime());

  function commit(next: HealthNetAppointment[]) {
    persistAppointments(next);
    onChange(next);
  }

  function selectDay(date: Date) {
    const dateKey = localDateKey(date);
    setSelectedDate(dateKey);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setMessage("");
  }

  function beginNew(date = selectedDate) {
    setEditingId(null);
    setDraft(blankDraft(date));
    setSelectedDate(date);
    setFormOpen(true);
    setMessage("");
  }

  function beginEdit(appointment: HealthNetAppointment) {
    setEditingId(appointment.id);
    setSelectedDate(appointment.date);
    setDraft({
      title: appointment.title,
      visitType: appointment.visitType,
      date: appointment.date,
      time: appointment.time,
      clinician: appointment.clinician,
      location: appointment.location,
      reason: appointment.reason,
      goal: appointment.goal,
      concerns: appointment.concerns,
      questions: appointment.questions,
      notes: appointment.notes,
    });
    setFormOpen(true);
    setMessage("");
  }

  function update<K extends keyof AppointmentDraft>(field: K, value: AppointmentDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function importIntake() {
    const questions = patientCase.physicianQuestions.join("\n");
    setDraft((current) => ({
      ...current,
      reason: current.reason || patientCase.primaryConcern,
      concerns: current.concerns || patientCase.historyNarrative,
      questions: current.questions || questions,
    }));
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const cleanedTitle = draft.title.trim();
    if (!cleanedTitle || !draft.date || !draft.time) return;
    const now = new Date().toISOString();
    if (editingId) {
      const next = appointments.map((appointment) => appointment.id === editingId ? { ...appointment, ...draft, title: cleanedTitle, updatedAt: now } : appointment);
      commit(next);
      setMessage("Appointment changes saved on this device.");
    } else {
      const next = [...appointments, { ...draft, title: cleanedTitle, id: window.crypto.randomUUID(), status: "scheduled" as const, createdAt: now, updatedAt: now }];
      commit(next);
      setMessage("Appointment added to your HealthNet calendar.");
    }
    setFormOpen(false);
    setEditingId(null);
  }

  function remove(appointment: HealthNetAppointment) {
    if (!window.confirm(`Delete ${appointment.title} from your HealthNet calendar?`)) return;
    commit(appointments.filter((item) => item.id !== appointment.id));
    setMessage("Appointment deleted.");
  }

  function toggleComplete(appointment: HealthNetAppointment) {
    const status = appointment.status === "completed" ? "scheduled" : "completed";
    commit(appointments.map((item) => item.id === appointment.id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
    setMessage(status === "completed" ? "Appointment marked complete." : "Appointment returned to upcoming visits.");
  }

  return <div className="module-page appointments-page">
    <div className="module-heading appointments-heading"><div><p className="eyebrow">APPOINTMENTS</p><h1>Plan your next visit</h1><p>Choose a date, organize what matters, and walk in with a clear agenda.</p></div><button className="primary-button" onClick={() => beginNew()}>＋ Add appointment</button></div>
    {message && <div className="appointment-message" role="status">✓ {message}</div>}
    <div className="appointment-planner">
      <section className="calendar-card" aria-label="Appointment calendar">
        <header><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button><div><h2>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(month)}</h2><button onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); selectDay(now); }}>Today</button></div><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button></header>
        <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{days.map((date) => {
          const key = localDateKey(date);
          const dayAppointments = appointments.filter((appointment) => appointment.date === key);
          return <button key={key} className={`${date.getMonth() !== month.getMonth() ? "outside" : ""} ${key === today ? "today" : ""} ${key === selectedDate ? "selected" : ""}`} onClick={() => selectDay(date)} aria-label={`${displayDate(key)}${dayAppointments.length ? `, ${dayAppointments.length} appointment${dayAppointments.length === 1 ? "" : "s"}` : ""}`}><span>{date.getDate()}</span>{dayAppointments.length > 0 && <i>{dayAppointments.length}</i>}</button>;
        })}</div>
        <footer><span><i />Today</span><span><i />Selected date</span><span><i />Appointment scheduled</span></footer>
      </section>

      <aside className="selected-day-card">
        <p className="eyebrow">SELECTED DATE</p><h2>{displayDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h2>
        {selectedAppointments.length ? <div className="selected-appointment-list">{selectedAppointments.map((appointment) => <button key={appointment.id} onClick={() => beginEdit(appointment)}><span>{appointment.time ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`${appointment.date}T${appointment.time}:00`)) : "Time TBD"}</span><strong>{appointment.title}</strong><small>{appointment.clinician || appointment.visitType}</small><b>›</b></button>)}</div> : <div className="selected-day-empty"><span>□</span><strong>No visit planned</strong><p>Add an appointment and prepare what you want to discuss.</p></div>}
        <button className="selected-day-add" onClick={() => beginNew(selectedDate)}>＋ Schedule on this date</button>
      </aside>
    </div>

    <section className="upcoming-visits"><header><div><p className="eyebrow">YOUR VISITS</p><h2>Upcoming appointments</h2></div><span>{upcomingAppointments.length}</span></header>{upcomingAppointments.length ? <div>{upcomingAppointments.map((appointment) => <article key={appointment.id}><div className="appointment-date-tile"><span>{displayDate(appointment.date, { month: "short" }).toUpperCase()}</span><strong>{Number(appointment.date.slice(-2))}</strong></div><div className="appointment-detail"><div><span>{appointment.visitType}</span>{appointment.status === "completed" && <span className="completed-chip">Completed</span>}</div><h3>{appointment.title}</h3><p>{displayDate(appointment.date)} at {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`${appointment.date}T${appointment.time}:00`))}{appointment.clinician ? ` · ${appointment.clinician}` : ""}</p>{appointment.goal && <blockquote><strong>Visit goal</strong>{appointment.goal}</blockquote>}<div className="appointment-card-actions"><button onClick={() => beginEdit(appointment)}>Edit agenda</button><button onClick={() => toggleComplete(appointment)}>Mark complete</button><button className="danger" onClick={() => remove(appointment)}>Delete</button></div></div></article>)}</div> : <div className="appointments-empty"><span>□</span><div><h3>No upcoming appointments</h3><p>Select a date on the calendar to start preparing for a visit.</p></div></div>}</section>

    <p className="appointment-disclaimer"><span>ⓘ</span><strong>HealthNet is a planning tool.</strong> Adding an appointment here does not reserve a time with a clinic or notify a healthcare provider.</p>

    {formOpen && <div className="modal-backdrop appointment-backdrop" onMouseDown={() => setFormOpen(false)}><section className="appointment-form-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="appointment-form-title"><header><div><p className="eyebrow">{editingId ? "EDIT VISIT" : "NEW VISIT"}</p><h2 id="appointment-form-title">{editingId ? "Update your appointment" : "Prepare for an appointment"}</h2><p>Only add details you know. You can return and edit this later.</p></div><button onClick={() => setFormOpen(false)} aria-label="Close appointment form">×</button></header><form onSubmit={save}>
      <div className="appointment-form-grid"><label><span>Appointment name *</span><input required maxLength={100} value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="Annual checkup" /></label><label><span>Visit type</span><select value={draft.visitType} onChange={(event) => update("visitType", event.target.value)}><option>Primary care</option><option>Specialist</option><option>Follow-up</option><option>Urgent care</option><option>Telehealth</option><option>Other</option></select></label><label><span>Date *</span><input required type="date" value={draft.date} onChange={(event) => { update("date", event.target.value); setSelectedDate(event.target.value); }} /></label><label><span>Time *</span><input required type="time" value={draft.time} onChange={(event) => update("time", event.target.value)} /></label><label><span>Physician or clinic</span><input maxLength={100} value={draft.clinician} onChange={(event) => update("clinician", event.target.value)} placeholder="Dr. Lee or clinic name" /></label><label><span>Location or telehealth link</span><input maxLength={200} value={draft.location} onChange={(event) => update("location", event.target.value)} placeholder="Address or meeting link" /></label></div>
      {patientCase.primaryConcern && <button className="import-intake" type="button" onClick={importIntake}>✦ Bring in my intake concern and questions</button>}
      <label className="full-field"><span>Why are you going?</span><textarea rows={3} maxLength={1200} value={draft.reason} onChange={(event) => update("reason", event.target.value)} placeholder="Describe the reason for this appointment in your own words." /></label><label className="full-field featured"><span>What do you want to get out of this visit?</span><textarea rows={3} maxLength={1200} value={draft.goal} onChange={(event) => update("goal", event.target.value)} placeholder="For example: understand what could be causing my symptoms and agree on next steps." /></label><label className="full-field"><span>Concerns you want addressed</span><textarea rows={3} maxLength={1800} value={draft.concerns} onChange={(event) => update("concerns", event.target.value)} placeholder="List any symptoms, changes, or worries you do not want to forget." /></label><label className="full-field"><span>Questions for the physician</span><textarea rows={4} maxLength={1800} value={draft.questions} onChange={(event) => update("questions", event.target.value)} placeholder="Put each question on a new line." /></label><label className="full-field"><span>Additional notes</span><textarea rows={2} maxLength={1200} value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Anything else that will help you prepare." /></label><div className="appointment-form-actions"><button type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" type="submit">{editingId ? "Save changes" : "Add appointment"}</button></div>
    </form></section></div>}
  </div>;
}
