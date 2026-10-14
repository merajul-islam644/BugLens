import { useState } from "react";
import { EvidencePicker } from "../investigations/FindingsPanels";
import { can } from "../access/permissions";
import { Alert } from "../../shared/ui/Alert";
import { formatDateTime } from "../../shared/domain/format";
import type { EvidenceRecord } from "../evidence/evidenceApi";
import type { Access } from "../access/useAccess";
import { addStep, removeStep, updateStep } from "./stepsApi";
import type { ReproductionStepRecord } from "./stepsApi";

export function StepsPanel({ access, evidence, issueId, onChanged, steps }: {
  access: Access;
  evidence: EvidenceRecord[];
  issueId: string;
  onChanged: () => void;
  steps: ReproductionStepRecord[];
}) {
  const [editing, setEditing] = useState<ReproductionStepRecord | undefined>();
  const [error, setError] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [seen, setSeen] = useState("");
  const [text, setText] = useState("");

  const canEdit = can(access.role, "contribute");

  function label(ids: string[] | undefined): string {
    if (!ids || ids.length === 0) return "No evidence linked";
    return ids.map((id) => evidence.find((item) => (item.itemId ?? "") === id)?.evdId).filter(Boolean).join(", ") || "No evidence linked";
  }

  function startEdit(step: ReproductionStepRecord) {
    setEditing(step);
    setText(step.text ?? "");
    setSeen(step.seen ?? "");
    setEvidenceIds(step.evidenceIds ?? []);
    setError("");
  }

  function reset() {
    setEditing(undefined);
    setText("");
    setSeen("");
    setEvidenceIds([]);
  }

  async function save() {
    if (!text.trim() || saving) return;
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateStep(access, String(editing.itemId ?? ""), {
          evidenceIds,
          ranAt: seen ? new Date().toISOString() : editing.ranAt,
          ranBy: seen && !editing.ranBy ? access.actor.name : editing.ranBy,
          seen,
          text: text.trim()
        });
      } else {
        await addStep({ access, evidenceIds, issueId, seen, text });
      }
      reset();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The step could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(step: ReproductionStepRecord) {
    setError("");
    try {
      await removeStep(access, String(step.itemId ?? ""));
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The step could not be removed.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Reproduction steps</h3></div>
      {steps.length === 0 ? (
        <p className="muted">{canEdit ? "No steps yet. Numbered steps with evidence links are what make a bug reproducible." : "No steps recorded."}</p>
      ) : (
        <ol className="feed">
          {steps.map((step) => (
            <li key={String(step.itemId)}>
              <strong>{step.stepOrder}.</strong>
              <span>
                {step.text}
                <span className="field-hint"> {label(step.evidenceIds)}{step.seen ? ` — seen: ${step.seen}` : ""}{step.ranBy ? ` (ran by ${step.ranBy})` : ""}</span>
              </span>
              {canEdit ? (
                <span className="row-actions">
                  <button className="link-button" onClick={() => startEdit(step)}>Edit</button>
                  <button className="link-button" onClick={() => void remove(step)}>Remove</button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {canEdit ? (
        <div className="form-grid">
          <label className="form-field span-all"><span>{editing ? "Step text" : "New step"}</span>
            <input onChange={(event) => setText(event.target.value)} placeholder="Click Checkout with an empty cart" value={text} />
          </label>
          <label className="form-field span-all"><span>What was seen (optional)</span>
            <input onChange={(event) => setSeen(event.target.value)} placeholder="A 500 error page appears" value={seen} />
          </label>
          <div className="form-field span-all"><span>Linked evidence</span>
            <EvidencePicker evidence={evidence} onSelected={setEvidenceIds} selected={evidenceIds} />
          </div>
          {error ? <div className="span-all"><Alert tone="error">{error}</Alert></div> : null}
          <div className="form-actions span-all">
            {editing ? <button className="secondary-button" onClick={reset}>Cancel</button> : null}
            <button className="primary-button" disabled={!text.trim() || saving} onClick={() => void save()}>
              {editing ? "Save step" : "Add step"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
