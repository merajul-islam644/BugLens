import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { can } from "../access/permissions";
import { RETEST_METHODS, RETEST_RESULTS } from "../../shared/domain/constants";
import { formatDateTime } from "../../shared/domain/format";
import { EvidencePicker } from "../investigations/FindingsPanels";
import type { EvidenceRecord } from "../evidence/evidenceApi";
import type { Access } from "../access/useAccess";
import type { EnvironmentRecord } from "../projects/projectsApi";
import { addRetestRun } from "./retestApi";
import { emailRetest } from "../records/notifyApi";
import { notifyUsers } from "../records/notifyApi";
import type { RetestRunRecord } from "./retestApi";

function resultTone(result: string | undefined): string {
  if (result === "Passed") return "badge-good";
  if (result === "Failed" || result === "Blocked") return "badge-danger";
  return "badge-warn";
}

function EvidenceLabels({ evidence, ids }: { evidence: EvidenceRecord[]; ids: string[] | undefined }) {
  const labels = (ids ?? []).map((id) => evidence.find((item) => (item.itemId ?? "") === id)?.evdId).filter(Boolean);
  if (labels.length === 0) return <span className="field-hint">No evidence linked</span>;
  return <span className="mono">{labels.join(", ")}</span>;
}

export function RetestPanel({ access, assigneeEmail, assigneeId, environments, evidence, evidenceFilter, hasPassedRun, issueId, issueKey, onChanged, runs }: {
  access: Access;
  assigneeEmail?: string;
  assigneeId?: string;
  environments: EnvironmentRecord[];
  evidence: EvidenceRecord[];
  evidenceFilter?: boolean;
  hasPassedRun: boolean;
  issueId: string;
  issueKey?: string;
  onChanged: () => void;
  runs: RetestRunRecord[];
}) {
  const [authorised, setAuthorised] = useState(false);
  const [comparison, setComparison] = useState("");
  const [consoleErrors, setConsoleErrors] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [error, setError] = useState("");
  const [howRun, setHowRun] = useState<string>("Ran by hand");
  const [responseStatus, setResponseStatus] = useState("");
  const [result, setResult] = useState<string>(RETEST_RESULTS[0]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const canEdit = can(access.role, "contribute");
  const listEvidence = evidenceFilter ? evidence.filter((item) => (item.issueId ?? "") === issueId || true) : evidence;

  async function record() {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const environment = environments.find((item) => item.itemId === environmentId);
      const runNo = await addRetestRun({
        access,
        authorised,
        comparison,
        consoleErrors,
        environmentId,
        environmentName: environment?.name ?? "",
        evidenceIds: selected,
        howRun,
        issueId,
        responseStatus,
        result,
        target
      });
      setSelected([]);
      setComparison("");
      setConsoleErrors("");
      setResponseStatus("");
      setTarget("");
      setAuthorised(false);
      const label = issueKey ? `${issueKey} retest run ${runNo} — ${result}` : `Retest run ${runNo} — ${result}`;
      notifyUsers(assigneeId ? [assigneeId] : [], label);
      if (assigneeEmail) emailRetest({ email: assigneeEmail, environmentName: environment?.name ?? "the target", issueKey: issueKey ?? "An issue", ranBy: access.actor.name, result, runNo });
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The retest run could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  const runA = runs.find((run) => String(run.itemId) === compareA);
  const runB = runs.find((run) => String(run.itemId) === compareB);

  return (
    <div className="panel">
      <div className="panel-title">
        <h3>Retest runs</h3>
        {hasPassedRun ? <span className="badge badge-good">Latest run passed</span> : <span className="muted">No passing run yet</span>}
      </div>

      {runs.length === 0 ? <p className="muted">No retest runs recorded yet. Every run needs its own evidence.</p> : (
        <ul className="feed">
          {runs.map((run) => (
            <li key={String(run.itemId)}>
              <span className="mono">Run {run.runNo}</span>
              <span className={`badge ${resultTone(run.result)}`}>{run.result}</span>
              <span>
                {run.environmentName || "—"} · {run.howRun || "—"}{run.target ? ` · ${run.target}` : ""}
                <span className="field-hint"> by {run.ranByName} — {formatDateTime(run.ranAt)} · evidence: <EvidenceLabels evidence={evidence} ids={run.evidenceIds} /></span>
                {run.comparison ? <div className="field-hint">{run.comparison}</div> : null}
                {run.responseStatus || run.consoleErrors ? <div className="field-hint">status {run.responseStatus || "—"} · console {run.consoleErrors || "—"}</div> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {runs.length >= 2 ? (
        <div className="compare-grid">
          <label className="form-field"><span>Compare run</span>
            <select onChange={(event) => setCompareA(event.target.value)} value={compareA}>
              <option value="">First run</option>
              {runs.map((run) => <option key={String(run.itemId)} value={String(run.itemId)}>Run {run.runNo} — {run.result}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Against run</span>
            <select onChange={(event) => setCompareB(event.target.value)} value={compareB}>
              <option value="">Second run</option>
              {runs.map((run) => <option key={String(run.itemId)} value={String(run.itemId)}>Run {run.runNo} — {run.result}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {runA && runB ? (
        <div className="compare-grid">
          {[runA, runB].map((run, index) => (
            <div className="panel" key={index}>
              <div className="panel-title"><h3>Run {run.runNo}</h3><span className={`badge ${resultTone(run.result)}`}>{run.result}</span></div>
              <dl className="meta-list">
                <dt>Environment</dt><dd>{run.environmentName || "—"}</dd>
                <dt>Target</dt><dd className="mono">{run.target || "—"}</dd>
                <dt>How</dt><dd>{run.howRun || "—"}</dd>
                <dt>Response</dt><dd className="mono">{run.responseStatus || "—"}</dd>
                <dt>Console</dt><dd className="mono">{run.consoleErrors || "—"}</dd>
                <dt>Comparison</dt><dd>{run.comparison || "—"}</dd>
                <dt>Ran</dt><dd>{run.ranByName} — {formatDateTime(run.ranAt)}</dd>
              </dl>
            </div>
          ))}
        </div>
      ) : null}

      {canEdit ? (
        <div className="form-grid">
          <label className="form-field"><span>Environment</span>
            <select onChange={(event) => setEnvironmentId(event.target.value)} value={environmentId}>
              <option value="">Pick an environment</option>
              {environments.map((item) => <option key={item.itemId} value={item.itemId}>{item.name}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Target</span>
            <input onChange={(event) => setTarget(event.target.value)} placeholder="https://staging.example.com/checkout" value={target} />
          </label>
          <label className="form-field"><span>How run</span>
            <select onChange={(event) => setHowRun(event.target.value)} value={howRun}>
              {RETEST_METHODS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Result</span>
            <select onChange={(event) => setResult(event.target.value)} value={result}>
              {RETEST_RESULTS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Response status</span>
            <input onChange={(event) => setResponseStatus(event.target.value)} placeholder="500" value={responseStatus} />
          </label>
          <label className="form-field"><span>Console errors</span>
            <input onChange={(event) => setConsoleErrors(event.target.value)} placeholder="TypeError reading 'id'" value={consoleErrors} />
          </label>
          <label className="form-field span-all"><span>What changed vs the first report</span>
            <input onChange={(event) => setComparison(event.target.value)} placeholder="Now returns 200, no console error" value={comparison} />
          </label>
          <div className="form-field span-all"><span>Linked evidence</span>
            <EvidencePicker evidence={listEvidence} onSelected={setSelected} selected={selected} />
          </div>
          <label className="muted span-all" style={{ gap: 8 }}>
            <input checked={authorised} onChange={(event) => setAuthorised(event.target.checked)} type="checkbox" />
            <span>I am authorised to test this target.</span>
          </label>
          {error ? <div className="span-all"><Alert tone="error">{error}</Alert></div> : null}
          <div className="form-actions span-all">
            <button className="primary-button" disabled={!authorised || selected.length === 0 || saving} onClick={() => void record()}>
              {saving ? "Recording…" : "Record retest run"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
