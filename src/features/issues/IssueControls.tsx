import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "../../shared/ui/Alert";
import { SEVERITIES, STATUSES } from "../../shared/domain/constants";
import { can } from "../access/permissions";
import type { Access } from "../access/useAccess";
import { listMembers } from "../workspace/workspaceApi";
import { emailAssignment, notifyUsers } from "../records/notifyApi";
import { writeAudit } from "../records/auditApi";
import type { IssueRecord } from "./issuesApi";
import { nextStatuses, updateIssue, updateSeverity, updateStatus } from "./issuesApi";

export function IssueControls({ access, assigneeEmail, hasFact, issue, latestResult, onChanged }: {
  access: Access;
  assigneeEmail?: string;
  hasFact: boolean;
  issue: IssueRecord;
  latestResult?: string;
  onChanged: () => void;
}) {
  const [assigneeId, setAssigneeId] = useState(issue.assigneeId ?? "");
  const [error, setError] = useState("");
  const [impact, setImpact] = useState(issue.impact ?? "");
  const [reason, setReason] = useState(issue.severityReason ?? "");
  const [severity, setSeverity] = useState(issue.severity || "Medium");
  const [status, setStatus] = useState(issue.status || "New");

  const members = useQuery({ queryFn: () => listMembers(), queryKey: ["members"] });
  const current = issue.status || "New";
  const isAdminOrQa = can(access.role, "setResolved");
  const resolveAllowed = isAdminOrQa && latestResult === "Passed";
  const statusOptions = [current, ...nextStatuses(current)].filter((value) => value !== "Resolved" || resolveAllowed);
  const resolveBlockedNote =
    current === "Ready for Retest" && nextStatuses(current).includes("Resolved") && !resolveAllowed
      ? latestResult === "Inconclusive"
        ? "An inconclusive run cannot resolve an issue."
        : "Resolve needs a retest that Passed."
      : "";
  const showSeverityEditor = can(access.role, "contribute");
  const assignable = (members.data ?? []).filter((member) => member.active !== false);

  async function changeAssignee() {
    setError("");
    try {
      const member = assignable.find((item) => (item.userId ?? "") === assigneeId);
      await updateIssue(access, String(issue.itemId ?? ""), {
        assigneeId: member?.userId ?? "",
        assigneeName: member?.displayName || member?.email || ""
      });
      await writeAudit(access.workspaceId, access.actor, {
        action: "Issue assignee changed",
        newValue: member?.displayName || member?.email || "Unassigned",
        oldValue: issue.assigneeName || "Unassigned",
        recordId: String(issue.itemId ?? ""),
        recordLabel: issue.issueKey || "Issue",
        recordType: "Issue"
      }).catch(() => undefined);
      if (member?.userId && member.userId !== access.actor.id) {
        const email = member.email || assigneeEmail;
        if (email) emailAssignment({ assignerName: access.actor.name, email, issueKey: issue.issueKey ?? "An issue", issueTitle: issue.title ?? "" });
        notifyUsers([member.userId], `${access.actor.name} assigned ${issue.issueKey ?? "an issue"} — ${issue.title ?? "an issue"} — to you.`);
      }
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assignee could not be changed.");
    }
  }

  async function changeStatus() {
    if (status === current) return;
    setError("");
    try {
      await updateStatus({ access, issue, latestResult, status });
      onChanged();
    } catch (caught) {
      setStatus(current);
      setError(caught instanceof Error ? caught.message : "The status could not be changed.");
    }
  }

  async function changeSeverity() {
    setError("");
    try {
      await updateSeverity({ access, hasFact, impact, issue, reason, severity });
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The severity could not be changed.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Status and severity</h3></div>
      <div className="filter-grid">
        <label className="form-field"><span>Status</span>
          <select
            disabled={!can(access.role, "contribute") || (status === "Resolved" && !isAdminOrQa)}
            onChange={(event) => { setStatus(event.target.value); }}
            value={status}
          >
            {STATUSES.filter((value) => statusOptions.includes(value)).map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <span className="form-field"><span> </span>
          <span><button className="secondary-button" disabled={status === current || !can(access.role, "contribute")} onClick={() => void changeStatus()}>Change status</button></span>
        </span>
      </div>
      {resolveBlockedNote ? <p className="field-hint">{resolveBlockedNote}</p> : null}
      {showSeverityEditor ? (
        <div className="filter-grid">
          <label className="form-field"><span>Assignee</span>
            <select onChange={(event) => setAssigneeId(event.target.value)} value={assigneeId}>
              <option value="">Unassigned</option>
              {assignable.map((member) => (
                <option key={String(member.userId ?? member.itemId)} value={String(member.userId ?? "")}>{member.displayName || member.email}</option>
              ))}
            </select>
          </label>
          <span className="form-field"><span> </span>
            <span><button className="secondary-button" disabled={assigneeId === (issue.assigneeId ?? "")} onClick={() => void changeAssignee()}>Change assignee</button></span>
          </span>
        </div>
      ) : null}
      {showSeverityEditor ? (
        <div className="filter-grid">
          <label className="form-field"><span>Severity</span>
            <select onChange={(event) => setSeverity(event.target.value)} value={severity}>
              {SEVERITIES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="form-field"><span>Severity reason{severity === "Critical" ? " (required for Critical)" : ""}</span>
            <input onChange={(event) => setReason(event.target.value)} placeholder="Why this severity" value={reason} />
          </label>
          <label className="form-field"><span>Impact</span>
            <input onChange={(event) => setImpact(event.target.value)} placeholder="Who is affected and how much" value={impact} />
          </label>
          <span className="form-field"><span> </span>
            <span><button className="secondary-button" disabled={severity === (issue.severity || "Medium") && reason === (issue.severityReason ?? "") && impact === (issue.impact ?? "")} onClick={() => void changeSeverity()}>Save severity</button></span>
          </span>
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
