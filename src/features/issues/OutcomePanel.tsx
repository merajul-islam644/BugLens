import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { can } from "../access/permissions";
import { REPRODUCTION_OUTCOMES } from "../../shared/domain/constants";
import { formatDateTime } from "../../shared/domain/format";
import { EvidencePicker } from "../investigations/FindingsPanels";
import type { EvidenceRecord } from "../evidence/evidenceApi";
import type { Access } from "../access/useAccess";
import type { IssueRecord } from "./issuesApi";
import { parseAttempts, recordOutcome } from "./issuesApi";

export function OutcomePanel({ access, evidence, issue, onChanged }: {
  access: Access;
  evidence: EvidenceRecord[];
  issue: IssueRecord;
  onChanged: () => void;
}) {
  const [condition, setCondition] = useState(issue.outcomeCondition ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [outcome, setOutcome] = useState(issue.reproductionOutcome ?? "");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>(issue.outcomeEvidenceIds ?? []);
  const canEdit = can(access.role, "contribute");
  const attempts = parseAttempts(issue.outcomeAttempts);
  const evidenceLabel = (id: string) => evidence.find((item) => String(item.itemId ?? "") === id)?.evdId ?? id;

  async function save() {
    if (!outcome || saving) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const result = await recordOutcome({
        access,
        attempt: {
          condition,
          evidenceIds: selected,
          outcome,
          ranAt: new Date().toISOString(),
          ranBy: access.actor.name
        },
        issue
      });
      if (result.outcome !== result.requested) {
        setNotice("Two attempts gave different results, so this reads Intermittent. Both attempts' evidence is listed.");
      }
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outcome could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit && !issue.reproductionOutcome) {
    return (
      <div className="panel">
        <div className="panel-title"><h3>Reproduction outcome</h3></div>
        <p className="muted">No reproduction outcome recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Reproduction outcome</h3></div>
      {issue.reproductionOutcome ? (
        <dl className="meta-list">
          <dt>Outcome</dt><dd>{issue.reproductionOutcome}</dd>
          <dt>Under condition</dt><dd>{issue.outcomeCondition || "—"}</dd>
          <dt>Ran by</dt><dd>{issue.outcomeRanBy || "—"}</dd>
          <dt>At</dt><dd>{formatDateTime(issue.outcomeRanAt)}</dd>
        </dl>
      ) : (
        <p className="muted">No reproduction outcome recorded yet.</p>
      )}

      {attempts.length > 0 ? (
        <div>
          <div className="panel-title"><h4>Attempts</h4></div>
          <ul className="evidence-list">
            {attempts.map((attempt, index) => (
              <li className="evidence-row" key={`${attempt.ranAt}-${index}`}>
                <span><strong>{attempt.outcome}</strong> — {attempt.condition || "no condition noted"}</span>
                <span className="muted">
                  {attempt.ranBy} · {formatDateTime(attempt.ranAt)}
                  {attempt.evidenceIds.length > 0 ? ` · ${attempt.evidenceIds.map(evidenceLabel).join(", ")}` : " · no evidence"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canEdit ? (
        <div className="form-grid">
          <label className="form-field"><span>Outcome</span>
            <select onChange={(event) => setOutcome(event.target.value)} value={outcome}>
              <option value="">Choose the outcome</option>
              {REPRODUCTION_OUTCOMES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Under what condition</span>
            <input onChange={(event) => setCondition(event.target.value)} placeholder="Slow network, Safari 17 only" value={condition} />
          </label>
          <div className="form-field span-all"><span>Evidence of the outcome</span>
            <EvidencePicker evidence={evidence} onSelected={setSelected} selected={selected} />
          </div>
          <p className="field-hint span-all">Reproduced needs the condition you saw and the evidence showing it, before it saves.</p>
          {notice ? <div className="span-all"><Alert tone="info">{notice}</Alert></div> : null}
          {error ? <div className="span-all"><Alert tone="error">{error}</Alert></div> : null}
          <div className="form-actions span-all">
            <button className="primary-button" disabled={!outcome || saving} onClick={() => void save()}>
              {issue.reproductionOutcome ? "Record another attempt" : "Record outcome"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}