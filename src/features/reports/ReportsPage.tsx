import { useQuery } from "@tanstack/react-query";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { SEVERITIES, STATUSES } from "../../shared/domain/constants";
import { useAccess } from "../access/useAccess";
import { listEvidence } from "../evidence/evidenceApi";
import { listInvestigations } from "../investigations/investigationsApi";
import { listAllRetestRuns } from "../issues/retestApi";
import { listIssues } from "../issues/issuesApi";

function CountList({ counts, total }: { counts: { label: string; value: number }[]; total: number }) {
  return (
    <ul className="feed">
      {counts.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <span className="report-meter"><span style={{ width: `${total === 0 ? 0 : (row.value / total) * 100}%` }} /></span>
          <strong>{row.value}</strong>
        </li>
      ))}
    </ul>
  );
}

export function ReportsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const access = useAccess();
  const issues = useQuery({ enabled: Boolean(access.data), queryFn: () => listIssues(access.data?.workspaceId ?? ""), queryKey: ["issues", access.data?.workspaceId] });
  const investigations = useQuery({ enabled: Boolean(access.data), queryFn: () => listInvestigations(access.data?.workspaceId ?? ""), queryKey: ["investigations", access.data?.workspaceId] });
  const evidence = useQuery({ enabled: Boolean(access.data), queryFn: () => listEvidence(access.data?.workspaceId ?? ""), queryKey: ["evidence"] });
  const retests = useQuery({ enabled: Boolean(access.data), queryFn: () => listAllRetestRuns(access.data?.workspaceId ?? ""), queryKey: ["retests-all", access.data?.workspaceId] });

  if (access.isLoading || issues.isLoading) return <LoadingScreen />;
  if (!access.data) return <ErrorState message="Workspace access could not be read." />;
  if (issues.isError) return <ErrorState message="The reports could not be read." />;

  const issueRows = issues.data ?? [];
  const investigationRows = investigations.data ?? [];
  const retestRows = retests.data ?? [];

  const byStatus = STATUSES.map((status) => ({ label: status, value: issueRows.filter((issue) => (issue.status || "New") === status).length }));
  const bySeverity = SEVERITIES.map((severity) => ({ label: severity, value: issueRows.filter((issue) => issue.severity === severity).length }));
  const findingTypes = Array.from(new Set(issueRows.map((issue) => issue.findingType).filter(Boolean))) as string[];
  const byFinding = findingTypes.map((type) => ({ label: type, value: issueRows.filter((issue) => issue.findingType === type).length }));
  const byOutcome = ["Reproduced", "Not reproduced", "Intermittent", "Blocked", "Needs manual verification"].map((outcome) => ({
    label: outcome,
    value: issueRows.filter((issue) => issue.reproductionOutcome === outcome).length
  }));

  const retestCounts = ["Passed", "Failed", "Inconclusive", "Blocked"].map((result) => ({
    label: result,
    value: retestRows.filter((run) => run.result === result).length
  }));
  const passRate = retestRows.length === 0 ? "—" : `${Math.round((retestRows.filter((run) => run.result === "Passed").length / retestRows.length) * 100)} %`;

  const invCounts: Record<string, number> = {};
  for (const item of investigationRows) invCounts[item.status || "In progress"] = (invCounts[item.status || "In progress"] ?? 0) + 1;
  const finished = investigationRows.filter((item) => item.startedAt && item.endedAt);
  const avgElapsed = finished.length === 0
    ? "—"
    : `${Math.round(finished.reduce((sum, item) => sum + (new Date(String(item.endedAt)).getTime() - new Date(String(item.startedAt)).getTime()), 0) / finished.length / 60000)} min`;

  const topEvidence = [...issueRows]
    .sort((a, b) => ((b.evidenceIds ?? []).length + (evidence.data ?? []).filter((item) => item.issueId === b.itemId).length) - ((a.evidenceIds ?? []).length + (evidence.data ?? []).filter((item) => item.issueId === a.itemId).length))
    .slice(0, 5)
    .map((issue) => ({
      issue,
      count: (issue.evidenceIds ?? []).length + (evidence.data ?? []).filter((item) => item.issueId === issue.itemId).length
    }))
    .filter((row) => row.count > 0);

  return (
    <section>
      <PageHeader subtitle="Everything BugLens knows, on screen. Counts are computed from live records." title="Reports" />

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="panel">
          <div className="panel-title"><h3>Issues by status</h3><span className="muted">{issueRows.length} total</span></div>
          <CountList counts={byStatus} total={issueRows.length} />
        </div>
        <div className="panel">
          <div className="panel-title"><h3>Issues by severity</h3><span className="muted">{issueRows.length} total</span></div>
          <CountList counts={bySeverity} total={issueRows.length} />
        </div>
        <div className="panel">
          <div className="panel-title"><h3>Issues by finding type</h3></div>
          {byFinding.length === 0 ? <p className="muted">No classified issues yet.</p> : <CountList counts={byFinding} total={issueRows.length} />}
        </div>
        <div className="panel">
          <div className="panel-title"><h3>Reproduction outcomes</h3></div>
          <CountList counts={byOutcome} total={issueRows.filter((issue) => issue.reproductionOutcome).length} />
        </div>
        <div className="panel">
          <div className="panel-title"><h3>Retest runs</h3><span className="muted">Pass rate {passRate}</span></div>
          {retestRows.length === 0 ? <p className="muted">No retest runs yet.</p> : <CountList counts={retestCounts} total={retestRows.length} />}
        </div>
        <div className="panel">
          <div className="panel-title"><h3>Investigations</h3></div>
          <dl className="meta-list">
            {Object.entries(invCounts).map(([status, count]) => (
              <div key={status} style={{ display: "contents" }}>
                <dt>{status}</dt><dd>{count}</dd>
              </div>
            ))}
            <dt>Average time to close</dt><dd>{avgElapsed}</dd>
          </dl>
        </div>
        <div className="panel">
          <div className="panel-title"><h3>Best-documented issues</h3></div>
          {topEvidence.length === 0 ? <p className="muted">No issues with evidence yet.</p> : (
            <ul className="feed">
              {topEvidence.map((row) => (
                <li key={String(row.issue.itemId)}>
                  <button className="link-button" onClick={() => onNavigate(`/issues/${row.issue.itemId ?? ""}`)}>
                    {row.issue.issueKey} — {row.issue.title}
                  </button>
                  <strong>{row.count} evidence</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
