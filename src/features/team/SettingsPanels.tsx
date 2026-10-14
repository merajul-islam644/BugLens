import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../../shared/ui/Alert";
import { EmptyState } from "../../shared/ui/EmptyState";
import { formatDateTime } from "../../shared/domain/format";
import { failureMessage } from "../../lib/blocks/records";
import { listAudit } from "../records/auditApi";
import { writeAudit } from "../records/auditApi";
import { MASKING_RULE_LABELS } from "../evidence/masking";
import { updateWorkspace } from "../workspace/workspaceApi";
import type { WorkspaceRecord } from "../workspace/workspaceApi";
import type { Access } from "../access/useAccess";

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** PR-03 — allowed hosts and paths are the workspace's permission list for targets. */
export function TargetScopePanel({ access }: { access: Access }) {
  const queryClient = useQueryClient();
  const workspace = access.workspace;
  const [hosts, setHosts] = useState((workspace.allowedHosts ?? []).join("\n"));
  const [paths, setPaths] = useState((workspace.allowedPaths ?? []).join("\n"));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const hostList = workspace.allowedHosts ?? [];
  const pathList = workspace.allowedPaths ?? [];

  async function save() {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const itemId = String(workspace.itemId ?? "");
      await updateWorkspace(itemId, { allowedHosts: splitList(hosts), allowedPaths: splitList(paths) });
      await writeAudit(access.workspaceId, access.actor, {
        action: "Target scope changed",
        newValue: `${splitList(hosts).join(", ") || "none"} | ${splitList(paths).join(", ") || "all paths"}`,
        oldValue: `${hostList.join(", ") || "none"} | ${pathList.join(", ") || "all paths"}`,
        recordId: itemId,
        recordLabel: "Browser and target scope",
        recordType: "Workspace"
      }).catch(() => undefined);
      setSaved("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["access"] });
    } catch (caught) {
      setError(failureMessage(caught, "The target scope could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <p className="muted">
        Investigations may only start on these hosts and paths. An environment's Base URL host joins this
        list automatically when the environment is saved.
      </p>
      <div className="panel">
        <div className="panel-title"><h3>Currently set</h3></div>
        <dl className="meta-list">
          <dt>Allowed hosts</dt><dd>{hostList.length > 0 ? hostList.join(", ") : "None set — no investigation can start."}</dd>
          <dt>Allowed paths</dt><dd>{pathList.length > 0 ? pathList.join(", ") : "Not set — every path on an allowed host is permitted."}</dd>
        </dl>
      </div>
      <label className="form-field"><span>Allowed hosts (one per line)</span>
        <textarea onChange={(event) => setHosts(event.target.value)} placeholder="staging.customerportal.example" value={hosts} />
      </label>
      <label className="form-field"><span>Allowed paths (one per line, e.g. /app/*)</span>
        <textarea onChange={(event) => setPaths(event.target.value)} placeholder="/app/*" value={paths} />
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="info">{saved}</Alert> : null}
      <div className="form-actions">
        <button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save target scope"}</button>
      </div>
    </div>
  );
}

/** EV-05 — retention per workspace, default 12 months. */
export function RetentionPanel({ access }: { access: Access }) {
  const queryClient = useQueryClient();
  const workspace = access.workspace;
  const [months, setMonths] = useState(String(workspace.retentionMonths ?? 12));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = Number(months);
    if (!Number.isFinite(value) || value < 1) {
      setError("Enter a whole number of months, at least 1.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const itemId = String(workspace.itemId ?? "");
      await updateWorkspace(itemId, { retentionMonths: value });
      await writeAudit(access.workspaceId, access.actor, {
        action: "Retention changed",
        newValue: `${value} months`,
        oldValue: `${workspace.retentionMonths ?? 12} months`,
        recordId: itemId,
        recordLabel: "Evidence retention",
        recordType: "Workspace"
      }).catch(() => undefined);
      setSaved("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["access"] });
    } catch (caught) {
      setError(failureMessage(caught, "The retention setting could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <p className="muted">
        Evidence keeps a retire-by date this many months after capture. Retiring a file early moves it to
        trash and is recorded in the audit log.
      </p>
      <div className="panel">
        <div className="panel-title"><h3>Currently set</h3></div>
        <dl className="meta-list">
          <dt>Retention</dt><dd>{workspace.retentionMonths ?? 12} months</dd>
        </dl>
      </div>
      <label className="form-field"><span>Retention in months</span>
        <input min={1} onChange={(event) => setMonths(event.target.value)} type="number" value={months} />
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="info">{saved}</Alert> : null}
      <div className="form-actions">
        <button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save retention"}</button>
      </div>
    </div>
  );
}

/** EV-03 — the fixed rules text fields are checked against; stated plainly. */
export function MaskingPanel() {
  return (
    <div className="grid" style={{ gap: 12 }}>
      <p className="muted">
        BugLens refuses any typed text containing a credential. Uploaded files are kept whole and flagged, never
        edited. A member marks an item “Contains sensitive values” and an admin can retire it.
      </p>
      <div className="panel">
        <div className="panel-title"><h3>Rules enforced on typed text</h3></div>
        <ul className="feed">
          {MASKING_RULE_LABELS.map((label) => (
            <li key={label}><span className="mono">{label}</span><span className="muted">Refused in notes, facts, steps and pasted text.</span></li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <div className="panel-title"><h3>Not set</h3></div>
        <p className="muted">
          There is no automatic redaction inside uploaded files in this version. Masking stays a person's
          confirmation that evidence is safe to share.
        </p>
      </div>
    </div>
  );
}

const NOTIFY_EVENTS = [
  "An issue is assigned to you",
  "A comment mentions you",
  "A status moves to Ready for Retest",
  "A retest run is recorded",
  "You are invited to the workspace"
];

/** NO-01 — the events that notify in-app and by email. */
export function NotificationsPanel() {
  return (
    <div className="grid" style={{ gap: 12 }}>
      <p className="muted">These events send an in-app notification with an unread count, and an email.</p>
      <div className="panel">
        <div className="panel-title"><h3>Events that notify</h3></div>
        <ul className="feed">
          {NOTIFY_EVENTS.map((label) => (
            <li key={label}><span>{label}</span><span className="badge badge-good">On</span></li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <div className="panel-title"><h3>Not set</h3></div>
        <p className="muted">Notifications cannot be turned off per event in this version, and there is no digest schedule.</p>
      </div>
    </div>
  );
}

/** AC-01 — the audit log; only an admin reads it. */
export function AuditLogPanel({ access }: { access: Access }) {
  const audit = useQuery({
    queryFn: () => listAudit(access.workspaceId),
    queryKey: ["audit", access.workspaceId]
  });

  if (audit.isLoading) return <p className="muted">Loading the audit log…</p>;
  if (audit.isError) return <Alert tone="error">{failureMessage(audit.error, "The audit log could not be read.")}</Alert>;
  const entries = audit.data ?? [];
  if (entries.length === 0) {
    return <EmptyState title="Nothing recorded yet" description="Changes to severity, status, assignee, scope, retention, evidence, roles and invitations appear here." />;
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr><th>Time</th><th>Who</th><th>What changed</th><th>From</th><th>To</th><th>Record</th></tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={String(entry.itemId)}>
              <td>{formatDateTime(entry.time)}</td>
              <td>{entry.actorName || "—"}</td>
              <td>{entry.action || "Change"}</td>
              <td>{entry.oldValue || "—"}</td>
              <td>{entry.newValue || "—"}</td>
              <td>{entry.recordLabel || entry.recordType || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { WorkspaceRecord };