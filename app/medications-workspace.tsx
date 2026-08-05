"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { listSavedMedications, removeSavedMedication, saveMedication, type SavedMedication } from "../lib/medication-storage";

type MedicationResult = { name: string; strengthsAndForms: string[]; rxcuis: string[] };

const VISITOR_ID_KEY = "healthnet-public-demo-visitor";

function visitorIdForDevice() {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.localStorage.setItem(VISITOR_ID_KEY, created);
  return created;
}

function defaultDoseTimes(count: number) {
  if (count === 1) return ["08:00"];
  if (count === 2) return ["08:00", "20:00"];
  if (count === 3) return ["08:00", "14:00", "20:00"];
  if (count === 4) return ["08:00", "12:00", "16:00", "20:00"];
  return Array.from({ length: count }, () => "08:00");
}

function formatTime(time: string) {
  if (!time) return "Time not set";
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hour, minute));
}

export default function MedicationsWorkspace() {
  const searchArea = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<MedicationResult | null>(null);
  const [strengthAndForm, setStrengthAndForm] = useState("");
  const [dosage, setDosage] = useState("");
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [doseTimes, setDoseTimes] = useState(["08:00"]);
  const [saved, setSaved] = useState<SavedMedication[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    listSavedMedications(visitorIdForDevice()).then(setSaved).catch(() => setStatus("Saved medications could not be loaded in this browser."));
  }, []);

  useEffect(() => {
    const terms = query.trim();
    if (selected?.name === terms || terms.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/medications/search?terms=${encodeURIComponent(terms)}`, { signal: controller.signal });
        const data = await response.json() as { results?: MedicationResult[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Medication search is temporarily unavailable.");
        setResults(data.results || []);
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Medication search is temporarily unavailable.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  useEffect(() => {
    function closeResults(event: MouseEvent) {
      if (!searchArea.current?.contains(event.target as Node)) setResults([]);
    }
    document.addEventListener("mousedown", closeResults);
    return () => document.removeEventListener("mousedown", closeResults);
  }, []);

  function selectMedication(result: MedicationResult) {
    setSelected(result);
    setQuery(result.name);
    setStrengthAndForm(result.strengthsAndForms[0] || "");
    setResults([]);
    setStatus("");
  }

  function changeFrequency(count: number) {
    setTimesPerDay(count);
    setDoseTimes(defaultDoseTimes(count));
  }

  async function addMedication(event: FormEvent) {
    event.preventDefault();
    if (!selected || !dosage.trim() || doseTimes.some((time) => !time)) {
      setStatus("Select a medication and complete the dosage and time fields.");
      return;
    }
    try {
      const strengthIndex = selected.strengthsAndForms.indexOf(strengthAndForm);
      const medication = await saveMedication({
        visitorId: visitorIdForDevice(),
        name: selected.name,
        strengthAndForm,
        dosage: dosage.trim().slice(0, 80),
        timesPerDay,
        doseTimes,
        rxcui: strengthIndex >= 0 ? selected.rxcuis[strengthIndex] : undefined,
      });
      setSaved((current) => [medication, ...current]);
      setSelected(null);
      setQuery("");
      setStrengthAndForm("");
      setDosage("");
      changeFrequency(1);
      setStatus(`${medication.name} was added to your medication list.`);
    } catch {
      setStatus("The medication could not be saved in this browser.");
    }
  }

  async function removeMedication(medication: SavedMedication) {
    if (!window.confirm(`Remove ${medication.name} from your medication list?`)) return;
    try {
      await removeSavedMedication(medication.id);
      setSaved((current) => current.filter((item) => item.id !== medication.id));
      setStatus(`${medication.name} was removed.`);
    } catch {
      setStatus("The medication could not be removed.");
    }
  }

  return <div className="module-page medications-page">
    <div className="module-heading"><div><p className="eyebrow">MEDICATIONS</p><h1>Build your medication list</h1><p>Search current U.S. medication names, then record the exact schedule shown on your prescription label.</p></div></div>
    <section className="medication-builder">
      <div className="medication-search-panel">
        <div className="medication-step"><span>1</span><div><strong>Find your medication</strong><p>Search by a generic or brand name.</p></div></div>
        <div className="medication-search" ref={searchArea}>
          <label htmlFor="medication-search">Medication name</label>
          <div className="medication-search-input"><span>⌕</span><input id="medication-search" role="combobox" aria-expanded={results.length > 0} aria-controls="medication-results" autoComplete="off" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Start typing, for example amoxicillin…" />{searching && <i />}</div>
          {results.length > 0 && <div className="medication-results" id="medication-results" role="listbox">{results.map((result) => <button key={result.name} role="option" aria-selected="false" onClick={() => selectMedication(result)}><span>⊕</span><div><strong>{result.name}</strong><small>{result.strengthsAndForms.slice(0, 3).join(" · ") || "Form information available after selection"}</small></div><b>›</b></button>)}</div>}
          {query.trim().length >= 2 && !searching && results.length === 0 && !selected && !searchError && <p className="medication-search-note">No matching medication found. Check the spelling or try the generic name.</p>}
          {searchError && <p className="medication-search-error" role="alert">{searchError}</p>}
        </div>

        {selected && <form className="medication-form" onSubmit={addMedication}>
          <div className="selected-medication"><span>✓</span><div><strong>{selected.name}</strong><p>Matched in the U.S. National Library of Medicine’s RxTerms list</p></div><button type="button" onClick={() => { setSelected(null); setQuery(""); }}>Change</button></div>
          <div className="medication-step schedule-step"><span>2</span><div><strong>Add the schedule from your label</strong><p>HealthNet will organize what you enter; it will not calculate a dose.</p></div></div>
          <div className="medication-fields">
            <label><span>Strength and form</span>{selected.strengthsAndForms.length ? <select value={strengthAndForm} onChange={(event) => setStrengthAndForm(event.target.value)}>{selected.strengthsAndForms.map((strength) => <option key={strength}>{strength}</option>)}</select> : <input value={strengthAndForm} onChange={(event) => setStrengthAndForm(event.target.value)} placeholder="Enter strength and form" />}</label>
            <label><span>Dosage each time</span><input required maxLength={80} value={dosage} onChange={(event) => setDosage(event.target.value)} placeholder="For example, 1 tablet" /></label>
            <label><span>How many times a day?</span><select value={timesPerDay} onChange={(event) => changeFrequency(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count} time{count === 1 ? "" : "s"} daily</option>)}</select></label>
          </div>
          <div className="dose-times"><span>What time{timesPerDay === 1 ? "" : "s"}?</span><div>{doseTimes.map((time, index) => <label key={index}><span>Dose {index + 1}</span><input required type="time" value={time} onChange={(event) => setDoseTimes((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /></label>)}</div></div>
          <button className="save-medication" type="submit">Add to my medication list</button>
        </form>}
      </div>

      <aside className="saved-medications">
        <div><p className="eyebrow">YOUR LIST</p><h2>Saved medications</h2><span>{saved.length}</span></div>
        {status && <p className="medication-status" role="status">{status}</p>}
        {saved.length === 0 ? <div className="medications-empty"><span>⊕</span><h3>No medications added</h3><p>Search for a medication and enter the directions from its label.</p></div> : <div className="medication-list">{saved.map((medication) => <article key={medication.id}><div className="medication-pill">Rx</div><div><strong>{medication.name}</strong><p>{medication.strengthAndForm || "Strength not entered"}</p><span>{medication.dosage} · {medication.timesPerDay}× daily</span><small>{medication.doseTimes.map(formatTime).join(" · ")}</small></div><button onClick={() => removeMedication(medication)} aria-label={`Remove ${medication.name}`}>Remove</button></article>)}</div>}
        <p className="medication-safety"><span>ⓘ</span> Verify the medication, strength, dosage, and times against your prescription label or with a pharmacist. Do not change how you take a medication based on this list.</p>
      </aside>
    </section>
    <p className="nlm-credit">This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.</p>
  </div>;
}
