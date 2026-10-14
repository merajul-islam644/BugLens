import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { formatDateTime } from "../../shared/domain/format";
import { failureMessage } from "../../lib/blocks/records";
import type { InvestigationEventRecord } from "./investigationsApi";
import type { EvidenceRecord } from "../evidence/evidenceApi";
import type { Access } from "../access/useAccess";

/** IS-01 — one line per thing done: time, action, outcome, optional Evidence link. */
export function EventFeed({
  access,
  events,
  evidence,
  locked,
  onAdd,
  onOpenEvidence,
  onUpdate
}: {
  access: Access;
  events: InvestigationEventRecord[];
  evidence: EvidenceRecord[];
  locked: boolean;
  onAdd: (input: { action: string; evidenceId?: string; outcome: string }) => Promise<void>;
  onOpenEvidence: (itemId: string) => void;
  onUpdate: (event: InvestigationEventRecord, action: string) => Promise<void>;
}) {
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<InvestigationEventRecord | undefined>();
  const [editText, setEditText] = useState("");

  async function add() {
    setBusy(true);
    setError("");
    try {
      await onAdd({ action: action.trim(), evidenceId: evidenceId || undefined, outcome: outcome.trim() });
      setAction("");
      setOutcome("");
      setEvidenceId("");
    } catch (caught) {
      setError(failureMessage(caught, "The event could not be recorded."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Event feed</h3></div>
      {events.length === 0 ? <p className="muted">Nothing recorded yet. Add what you did and what you saw.</p> : null}
      <ol className="feed">
        {events.map((event) => {
          const linked = event.evidenceId ? evidence.find((item) => (item.itemId ?? "") === event.evidenceId) : undefined;
          const mine = event.authorId === access.actor.id && event.automatic !== true;
          return (
            <li key={String(event.itemId ?? event.time)}>
              <span className="muted mono">{formatDateTime(event.time)}</span>
              {editing?.itemId === event.itemId ? (
                <span className="grid" style={{ flex: 1, gap: 6 }}>
                  <input onChange={(e) => setEditText(e.target.value)} value={editText} />
                  <span className="row-actions">
                    <button className="link-button" onClick={() => { void onUpdate(event, editText.trim() || String(event.action ?? "")); setEditing(undefined); }}>Save</button>
                    <button className="link-button" onClick={() => setEditing(undefined)}>Cancel</button>
                  </span>
                </span>
              ) : (
                <span style={{ flex: 1 }}>
                  {event.action}
                  {event.outcome ? <> — {event.outcome}</> : null}
                  {linked ? <> <button className="link-button" onClick={() => onOpenEvidence(String(linked.itemId ?? ""))}>{linked.evdId}</button></> : null}
                  <span className="muted"> · {event.authorName}</span>
                </span>
              )}
              {!locked && mine && editing?.itemId !== event.itemId ? (
                <button className="link-button" onClick={() => { setEditing(event); setEditText(String(event.action ?? "")); }}>Edit</button>
              ) : null}
            </li>
          );
        })}
      </ol>
      {locked ? (
        <p className="field-hint">This investigation has ended. Its events are kept as recorded.</p>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          <div className="form-grid">
            <label className="form-field"><span>Action</span><input onChange={(e) => setAction(e.target.value)} placeholder="Clicked save twice; second attempt returned 500" value={action} /></label>
            <label className="form-field"><span>Outcome (optional)</span><input onChange={(e) => setOutcome(e.target.value)} value={outcome} /></label>
          </div>
          <label className="form-field">
            <span>Link evidence (optional)</span>
            <select onChange={(e) => setEvidenceId(e.target.value)} value={evidenceId}>
              <option value="">No evidence link</option>
              {evidence.map((item) => <option key={item.itemId} value={item.itemId}>{item.evdId} — {item.type}</option>)}
            </select>
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="form-actions">
            <button className="primary-button" disabled={busy || !action.trim()} onClick={() => void add()}>Add event</button>
          </div>
        </div>
      )}
    </div>
  );
}
