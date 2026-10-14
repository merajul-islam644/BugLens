import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { formatDateTime } from "../../shared/domain/format";
import { failureMessage } from "../../lib/blocks/records";
import { CONFIDENCES } from "../../shared/domain/constants";
import { removeFact, removeHypothesis, saveFact, saveHypothesis } from "./findingsApi";
import type { HypothesisRecord, ObservedFactRecord } from "./findingsApi";
import type { EvidenceRecord } from "../evidence/evidenceApi";
import type { Access } from "../access/useAccess";

type Options = { evidence: EvidenceRecord[] };

export function EvidencePicker({
  evidence,
  selected,
  onSelected
}: Options & { onSelected: (ids: string[]) => void; selected: string[] }) {
  if (evidence.length === 0) return <p className="field-hint">No evidence to link yet.</p>;
  return (
    <div className="chips">
      {evidence.map((item) => {
        const id = String(item.itemId ?? "");
        const on = selected.includes(id);
        return (
          <button
            aria-pressed={on}
            className={on ? "chip" : "icon-button"}
            key={id}
            onClick={() => onSelected(on ? selected.filter((value) => value !== id) : [...selected, id])}
            type="button"
          >
            {item.evdId} {item.type}
          </button>
        );
      })}
    </div>
  );
}

function evidenceLabels(evidence: EvidenceRecord[], ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return "No evidence linked yet";
  return ids
    .map((id) => evidence.find((item) => (item.itemId ?? "") === id)?.evdId)
    .filter(Boolean)
    .join(", ") || "No evidence linked yet";
}

/** IS-02 — Observed facts, two panels kept apart from hypotheses. */
export function FactsPanel({
  access,
  evidence,
  facts,
  investigationId,
  onChanged,
  readOnly
}: Options & {
  access: Access;
  facts: ObservedFactRecord[];
  investigationId: string;
  onChanged: () => void;
  readOnly: boolean;
}) {
  const [text, setText] = useState("");
  const [linked, setLinked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ObservedFactRecord | undefined>();

  async function save() {
    setError("");
    try {
      await saveFact({ access, evidenceIds: linked, existing: editing, investigationId, text });
      setText("");
      setLinked([]);
      setEditing(undefined);
      onChanged();
    } catch (caught) {
      setError(failureMessage(caught, "The fact could not be saved."));
    }
  }

  async function remove(fact: ObservedFactRecord) {
    setError("");
    try {
      await removeFact(access, fact);
      onChanged();
    } catch (caught) {
      setError(failureMessage(caught, "The fact could not be removed."));
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Observed facts</h3></div>
      {facts.length === 0 ? <p className="muted">Nothing recorded yet. A fact is something you saw, with the evidence it came from.</p> : null}
      {facts.map((fact) => (
        <div className="finding" key={fact.itemId}>
          <p style={{ margin: 0 }}>{fact.text}</p>
          <span className="muted">
            Evidence: {evidenceLabels(evidence, fact.evidenceIds)} · {fact.authorName}, {formatDateTime(fact.time)}
          </span>
          {!readOnly ? (
            <div className="row-actions">
              <button className="link-button" onClick={() => { setEditing(fact); setText(String(fact.text ?? "")); setLinked(fact.evidenceIds ?? []); }}>Edit</button>
              <button className="link-button" onClick={() => void remove(fact)}>Remove</button>
            </div>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <div className="grid" style={{ gap: 8 }}>
          <label className="form-field">
            <span>{editing ? "Edit fact" : "New observed fact"}</span>
            <textarea onChange={(event) => setText(event.target.value)} placeholder="What happened, exactly as observed." value={text} />
          </label>
          <span className="field-hint">Linked evidence</span>
          <EvidencePicker evidence={evidence} onSelected={setLinked} selected={linked} />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="form-actions">
            {editing ? <button className="icon-button" onClick={() => { setEditing(undefined); setText(""); setLinked([]); }}>Cancel</button> : null}
            <button className="primary-button" disabled={!text.trim()} onClick={() => void save()}>Save fact</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** IS-03 — hypotheses, always labelled, never in the facts panel. */
export function HypothesesPanel({
  access,
  evidence,
  hypotheses,
  investigationId,
  onChanged,
  readOnly
}: Options & {
  access: Access;
  hypotheses: HypothesisRecord[];
  investigationId: string;
  onChanged: () => void;
  readOnly: boolean;
}) {
  const [text, setText] = useState("");
  const [linked, setLinked] = useState<string[]>([]);
  const [missing, setMissing] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [confidence, setConfidence] = useState<string>("Unverified");
  const [error, setError] = useState("");

  async function save() {
    setError("");
    try {
      await saveHypothesis({
        access,
        confidence,
        evidenceIds: linked,
        investigationId,
        missingEvidence: missing,
        nextStep,
        text
      });
      setText("");
      setLinked([]);
      setMissing("");
      setNextStep("");
      onChanged();
    } catch (caught) {
      setError(failureMessage(caught, "The hypothesis could not be saved."));
    }
  }

  async function remove(item: HypothesisRecord) {
    setError("");
    try {
      await removeHypothesis(access, item);
      onChanged();
    } catch (caught) {
      setError(failureMessage(caught, "The hypothesis could not be removed."));
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Possible explanation (not confirmed)</h3></div>
      {hypotheses.length === 0 ? <p className="muted">No hypotheses yet. Propose a cause, say what is missing, and label how sure you are.</p> : null}
      {hypotheses.map((item) => (
        <div className="finding" key={item.itemId}>
          <p style={{ margin: 0 }}><span className="badge badge-warn">Hypothesis</span> {item.text}</p>
          <span className="muted">Evidence: {evidenceLabels(evidence, item.evidenceIds)}</span>
          {item.missingEvidence ? <span className="muted">Still missing: {item.missingEvidence}</span> : null}
          {item.nextStep ? <span className="muted">Next step: {item.nextStep}</span> : null}
          <span className="muted">Confidence: {item.confidence} · {item.authorName}, {formatDateTime(item.time)}</span>
          {!readOnly ? (
            <div className="row-actions">
              <button className="link-button" onClick={() => void remove(item)}>Remove</button>
            </div>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <div className="grid" style={{ gap: 8 }}>
          <label className="form-field">
            <span>New hypothesis</span>
            <textarea onChange={(event) => setText(event.target.value)} placeholder="A proposed cause — always labelled a hypothesis." value={text} />
          </label>
          <span className="field-hint">Supporting evidence (optional)</span>
          <EvidencePicker evidence={evidence} onSelected={setLinked} selected={linked} />
          <label className="form-field"><span>Evidence still missing</span><input onChange={(event) => setMissing(event.target.value)} value={missing} /></label>
          <label className="form-field"><span>Suggested next verification step</span><input onChange={(event) => setNextStep(event.target.value)} value={nextStep} /></label>
          <label className="form-field">
            <span>Confidence</span>
            <select onChange={(event) => setConfidence(event.target.value)} value={confidence}>
              {CONFIDENCES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="form-actions">
            <button className="primary-button" disabled={!text.trim()} onClick={() => void save()}>Save hypothesis</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
