import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy } from "lucide-react";
import { Alert } from "../../shared/ui/Alert";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { formatDateTime } from "../../shared/domain/format";
import { can } from "../access/permissions";
import { SEVERITIES } from "../../shared/domain/constants";
import { useAccess } from "../access/useAccess";
import { listAllEnvironments, listProjects } from "../projects/projectsApi";
import { listEvidence } from "../evidence/evidenceApi";
import { IssueSeverityBadge, IssueStatusBadge } from "./IssueBadges";
import { listIssues, updateIssue } from "./issuesApi";
import type { IssueRecord } from "./issuesApi";
import { listSteps } from "./stepsApi";
import { StepsPanel } from "./StepsPanel";
import { DuplicatesPanel } from "./DuplicatesPanel";
import { IssueControls } from "./IssueControls";
import { OutcomePanel } from "./OutcomePanel";
import { RetestPanel } from "./RetestPanel";
import { listRetestRuns } from "./retestApi";
import { DiscussionPanel, LinksPanel } from "./DiscussionPanels";
import { listComments, listLinks } from "./discussionApi";
import { listIssueFacts } from "../investigations/findingsApi";
import { listMembers } from "../workspace/workspaceApi";

function reportAsText(issue: IssueRecord, steps: { seen?: string; stepOrder?: number; text?: string }[], projectName: string, environmentName: string): string {
  const lines = [
    `${issue.issueKey ?? ""} — ${issue.title ?? ""}`,
    `Status: ${issue.status ?? "New"}    Severity: ${issue.severity ?? "—"}`,
    `Project: ${projectName}    Environment: ${environmentName}${issue.route ? `    Route: ${issue.route}` : ""}`,
    "",
    "Summary:",
    issue.summary || "(none)",
    "",
    "Observed behaviour:",
    issue.observedBehaviour || "(none)",
    "",
    "Expected behaviour:",
    issue.expectedBehaviour || "Expected behavior not specified.",
    "",
    "Reproduction steps:"
  ];
  if (steps.length === 0) lines.push("(none recorded)");
  for (const step of steps) lines.push(`${step.stepOrder}. ${step.text ?? ""}${step.seen ? ` (seen: ${step.seen})` : ""}`);
  if (issue.report) lines.push("", "Report:", issue.report);
  return lines.join("\n");
}

export function IssueDetailPage({ itemId, onNavigate }: { itemId: string; onNavigate: (path: string) => void }) {
  const access = useAccess();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<string | undefined>();
  const [reportError, setReportError] = useState("");
  const [saving, setSaving] = useState(false);

  const items = useQuery({ enabled: Boolean(access.data), queryFn: () => listIssues(access.data?.workspaceId ?? ""), queryKey: ["issues", access.data?.workspaceId] });
  const steps = useQuery({ queryFn: () => listSteps(itemId), queryKey: ["issue-steps", itemId] });
  const evidence = useQuery({ enabled: Boolean(access.data), queryFn: () => listEvidence(access.data?.workspaceId ?? ""), queryKey: ["evidence"] });
  const projects = useQuery({ enabled: Boolean(access.data), queryFn: () => listProjects(access.data?.workspaceId ?? ""), queryKey: ["projects", access.data?.workspaceId] });
  const environments = useQuery({ enabled: Boolean(access.data), queryFn: () => listAllEnvironments(access.data?.workspaceId ?? ""), queryKey: ["environments-all", access.data?.workspaceId] });
  const comments = useQuery({ queryFn: () => listComments(itemId), queryKey: ["issue-comments", itemId] });
  const links = useQuery({ queryFn: () => listLinks(itemId), queryKey: ["issue-links", itemId] });
  const retests = useQuery({ queryFn: () => listRetestRuns(itemId), queryKey: ["issue-retests", itemId] });
  const members = useQuery({ queryFn: () => listMembers(), queryKey: ["members"] });
  const issueFacts = useQuery({ queryFn: () => listIssueFacts(itemId), queryKey: ["issue-facts", itemId] });

  if (access.isLoading || items.isLoading) return <LoadingScreen />;
  if (!access.data) return <ErrorState message="Workspace access could not be read." />;

  const issue = (items.data ?? []).find((item) => (item.itemId ?? "") === itemId);
  if (!issue) {
    return (
      <div className="empty-state">
        <h3>Not found</h3>
        <p>You do not have access to this issue.</p>
        <button className="secondary-button" onClick={() => onNavigate("/issues")}>Back to issues</button>
      </div>
    );
  }

  const accessData = access.data;
  const canEdit = can(accessData.role, "contribute");
  const projectName = (projects.data ?? []).find((project) => project.itemId === issue.projectId)?.name || "—";
  const environmentName = (environments.data ?? []).find((environment) => environment.itemId === issue.environmentId)?.name || "—";
  const linked = (evidence.data ?? []).filter((item) => item.issueId === itemId || (issue.evidenceIds ?? []).includes(String(item.itemId ?? "")));
  const reportText = draft ?? issue.report ?? "";
  const latestResult = (retests.data ?? [])[0]?.result;
  const assigneeMember = (members.data ?? []).find((member) => (member.userId ?? "") === (issue.assigneeId ?? "") && issue.assigneeId);
  const assigneeEmail = assigneeMember?.email;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["issues", accessData.workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["issue-steps", itemId] }),
      queryClient.invalidateQueries({ queryKey: ["issue-comments", itemId] }),
      queryClient.invalidateQueries({ queryKey: ["issue-links", itemId] }),
      queryClient.invalidateQueries({ queryKey: ["issue-retests", itemId] })
    ]);
  }

  async function saveReport() {
    if (saving) return;
    setReportError("");
    setSaving(true);
    try {
      await updateIssue(accessData, itemId, { report: reportText });
      setDraft(undefined);
      await invalidate();
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : "The report could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const copyAsText = async () => {
    await navigator.clipboard.writeText(reportAsText(issue, steps.data ?? [], projectName, environmentName));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section>
      <button className="link-button" onClick={() => onNavigate("/issues")}>
        <ChevronLeft size={16} /> Issues
      </button>
      <div className="workspace-head">
        <h2><span className="mono">{issue.issueKey}</span> {issue.title}</h2>
        <IssueStatusBadge status={issue.status} />
        <IssueSeverityBadge severity={issue.severity} />
      </div>

      {/* The detail reads top-down in report order: summary, environment, behaviour,
          severity, reproduction steps, outcome, evidence, then the written report. */}
      <div className="panel">
        <div className="panel-title"><h3>Summary</h3></div>
        <p className="muted">{issue.summary || "No summary yet."}</p>
      </div>

      <div className="panel">
        <div className="panel-title"><h3>Environment</h3></div>
        <dl className="meta-list">
          <dt>Project</dt><dd>{projectName}</dd>
          <dt>Environment</dt><dd>{environmentName}</dd>
          <dt>Route</dt><dd className="mono">{issue.route || "—"}</dd>
          <dt>URL</dt><dd className="mono">{issue.environmentUrl || "—"}</dd>
          <dt>Browser / OS</dt><dd>{[issue.environmentBrowser, issue.environmentOs].filter(Boolean).join(" · ") || "—"}</dd>
          <dt>Build</dt><dd className="mono">{issue.environmentBuild || "—"}</dd>
          <dt>Requested at</dt><dd>{formatDateTime(issue.environmentTimestamp)}</dd>
        </dl>
      </div>

      <div className="panel">
        <div className="panel-title"><h3>Behaviour</h3></div>
        <dl className="meta-list">
          <dt>Observed</dt><dd>{issue.observedBehaviour || "—"}</dd>
          <dt>Expected</dt><dd>{issue.expectedBehaviour || "Expected behavior not specified."}</dd>
          <dt>Error signature</dt><dd className="mono">{issue.errorSignature || "—"}</dd>
          <dt>Request IDs</dt><dd className="mono">{issue.requestIds || "—"}</dd>
        </dl>
      </div>

      <IssueControls access={accessData} assigneeEmail={assigneeEmail} hasFact={(issueFacts.data ?? []).length > 0} issue={issue} latestResult={latestResult} onChanged={() => void invalidate()} />

      <div className="panel">
        <div className="panel-title"><h3>Finding</h3></div>
        <dl className="meta-list">
          <dt>Finding type</dt><dd>{issue.findingType || "—"}</dd>
          <dt>Assignee</dt><dd>{issue.assigneeName || "Unassigned"}</dd>
          <dt>Source</dt><dd>{issue.source || "Manual"}</dd>
          <dt>Impact</dt><dd>{issue.impact || "—"}</dd>
          <dt>Updated</dt><dd>{formatDateTime(issue.lastUpdated)}</dd>
        </dl>
        {issue.findingType === "Security or data exposure" && issue.severity === "Informational" ? (
          <p className="field-hint">Security findings are checked by an admin before closing.</p>
        ) : null}
      </div>

      <StepsPanel
        access={accessData}
        evidence={evidence.data ?? []}
        issueId={itemId}
        onChanged={() => void invalidate()}
        steps={steps.data ?? []}
      />

      <OutcomePanel
        access={accessData}
        evidence={evidence.data ?? []}
        issue={issue}
        onChanged={() => void invalidate()}
      />

      <RetestPanel
        access={accessData}
        assigneeEmail={assigneeEmail}
        assigneeId={issue.assigneeId}
        environments={environments.data ?? []}
        evidence={evidence.data ?? []}
        hasPassedRun={latestResult === "Passed"}
        issueId={itemId}
        issueKey={issue.issueKey}
        onChanged={() => void invalidate()}
        runs={retests.data ?? []}
      />

      <DuplicatesPanel
        access={accessData}
        issue={issue}
        issues={items.data ?? []}
        onChanged={() => void invalidate()}
        onOpen={(id) => onNavigate(`/issues/${id}`)}
      />

      <div className="panel">
        <div className="panel-title"><h3>Evidence</h3></div>
        {linked.length === 0 ? <p className="muted">No evidence yet</p> : (
          <ul className="evidence-list">
            {linked.map((item) => (
              <li className="evidence-row" key={String(item.itemId)}>
                <span><strong className="mono">{item.evdId}</strong> {item.type}</span>
                <button className="link-button" onClick={() => onNavigate(`/evidence/${item.itemId ?? ""}`)}>Open</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">
          <h3>Report</h3>
          <div className="toolbar-actions">
            <button className="secondary-button" onClick={() => void copyAsText()}><Copy size={15} /> {copied ? "Copied to the clipboard." : "Copy as text"}</button>
          </div>
        </div>
        {canEdit ? (
          <textarea
            className="form-field"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write up what happened, what was expected and what the evidence shows."
            style={{ minHeight: 160 }}
            value={reportText}
          />
        ) : (
          <p className="muted">{issue.report || "No report written yet."}</p>
        )}
        {reportError ? <Alert tone="error">{reportError}</Alert> : null}
        {canEdit ? (
          <div className="form-actions">
            <button className="primary-button" disabled={draft === undefined || saving} onClick={() => void saveReport()}>
              {saving ? "Saving…" : "Save report"}
            </button>
          </div>
        ) : null}
      </div>

      <DiscussionPanel
        access={accessData}
        comments={comments.data ?? []}
        issueId={itemId}
        issueKey={issue.issueKey}
        onChanged={() => void invalidate()}
      />

      <LinksPanel
        access={accessData}
        issueId={itemId}
        links={links.data ?? []}
        onChanged={() => void invalidate()}
      />
    </section>
  );
}
