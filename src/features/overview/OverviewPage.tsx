import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Microscope } from "lucide-react";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { timeAgo } from "../../shared/domain/format";
import { isOpenStatus } from "../../shared/domain/constants";
import { can } from "../access/permissions";
import { useAccess } from "../access/useAccess";
import { listEvidence } from "../evidence/evidenceApi";
import { listInvestigations } from "../investigations/investigationsApi";
import { listAllRetestRuns } from "../issues/retestApi";
import { listIssues } from "../issues/issuesApi";

const RANGES = [7, 14, 30];

function sameDay(value: string | undefined, day: Date): boolean {
  if (!value) return false;
  const at = new Date(value);
  return !Number.isNaN(at.getTime()) && at.toDateString() === day.toDateString();
}

export function OverviewPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const access = useAccess();
  const [range, setRange] = useState(14);
  const [target, setTarget] = useState("");

  const issues = useQuery({ enabled: Boolean(access.data), queryFn: () => listIssues(access.data?.workspaceId ?? ""), queryKey: ["issues", access.data?.workspaceId] });
  const investigations = useQuery({ enabled: Boolean(access.data), queryFn: () => listInvestigations(access.data?.workspaceId ?? ""), queryKey: ["investigations", access.data?.workspaceId] });
  const evidence = useQuery({ enabled: Boolean(access.data), queryFn: () => listEvidence(access.data?.workspaceId ?? ""), queryKey: ["evidence"] });
  const retests = useQuery({ enabled: Boolean(access.data), queryFn: () => listAllRetestRuns(access.data?.workspaceId ?? ""), queryKey: ["retests-all", access.data?.workspaceId] });

  if (access.isLoading || issues.isLoading || investigations.isLoading) return <LoadingScreen />;
  if (!access.data) return <ErrorState message="Workspace access could not be read." />;
  if (issues.isError) return <ErrorState message="The overview could not be read." />;

  const issueRows = issues.data ?? [];
  const openCount = issueRows.filter((issue) => isOpenStatus(issue.status)).length;
  const resolved = issueRows.filter((issue) => issue.status === "Resolved").length;
  const investigating = (investigations.data ?? []).filter((item) => item.status === "In progress").length;
  const evidenceCount = (evidence.data ?? []).length;

  const days = Array.from({ length: range }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (range - 1 - index));
    return day;
  });
  const buckets = days.map((day) => ({
    day,
    newCount: issueRows.filter((issue) => sameDay(issue.createdAt, day)).length,
    resolvedCount: issueRows.filter((issue) => sameDay(issue.resolvedAt || (issue.status === "Resolved" ? issue.lastUpdated : undefined), day)).length
  }));
  const peak = Math.max(1, ...buckets.map((bucket) => Math.max(bucket.newCount, bucket.resolvedCount)));

  const activity = [
    ...issueRows.slice(0, 8).map((issue) => ({ at: issue.lastUpdated, href: `/issues/${issue.itemId ?? ""}`, label: `${issue.issueKey} updated — ${issue.title}` })),
    ...(investigations.data ?? []).slice(0, 6).map((item) => ({ at: item.startedAt, href: `/investigations/${item.itemId ?? ""}`, label: `Investigation ${item.invId} ${item.status === "In progress" ? "running" : "closed"}` })),
    ...(retests.data ?? []).slice(0, 6).map((run) => ({ at: run.ranAt, href: `/issues/${run.issueId ?? ""}`, label: `Retest run ${run.runNo} — ${run.result}` }))
  ]
    .filter((line) => Boolean(line.at))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 10);

  const canRun = can(access.data.role, "runInvestigations");

  return (
    <section>
      <PageHeader subtitle="What BugLens is holding right now, at a glance." title="Overview" />

      <div className="metrics">
        <div className="metric"><span>Open issues</span><strong>{openCount}</strong></div>
        <div className="metric"><span>Resolved</span><strong>{resolved}</strong></div>
        <div className="metric"><span>Investigating now</span><strong>{investigating}</strong></div>
        <div className="metric"><span>Evidence items</span><strong>{evidenceCount}</strong></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }}>
        <div className="panel">
          <div className="panel-title">
            <h3>New vs resolved</h3>
            <span className="toolbar-actions">
              {RANGES.map((days) => (
                <button className={days === range ? "chip" : "icon-button"} key={days} onClick={() => setRange(days)} type="button">
                  {days} days
                </button>
              ))}
            </span>
          </div>
          <div className="chart">
            {buckets.map((bucket) => (
              <div className="chart-day" key={bucket.day.toISOString()}>
                <div className="chart-bars">
                  <div className="chart-bar new" style={{ height: `${(bucket.newCount / peak) * 100}%` }} title={`${bucket.newCount} new`} />
                  <div className="chart-bar resolved" style={{ height: `${(bucket.resolvedCount / peak) * 100}%` }} title={`${bucket.resolvedCount} resolved`} />
                </div>
                {bucket.day.getDate() === 1 || bucket.day.getTime() === days[0]?.getTime() ? (
                  <span className="muted">{bucket.day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                ) : (
                  <span>&nbsp;</span>
                )}
              </div>
            ))}
          </div>
          <span className="field-hint"><span className="chart-legend new" /> New&nbsp;&nbsp;<span className="chart-legend resolved" /> Resolved</span>
        </div>

        {canRun ? (
          <div className="panel">
            <div className="panel-title"><h3><Microscope size={16} /> Start an investigation</h3></div>
            <p className="muted">Point BugLens at a URL and it will walk you through target, evidence and checks.</p>
            <label className="form-field"><span>Target</span>
              <input onChange={(event) => setTarget(event.target.value)} placeholder="https://staging.example.com/checkout" value={target} />
            </label>
            <button
              className="primary-button"
              onClick={() => onNavigate(target.trim() ? `/investigations/new?target=${encodeURIComponent(target.trim())}` : "/investigations/new")}
            >
              Investigate <ArrowRight size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-title"><h3>Recent activity</h3></div>
        {activity.length === 0 ? (
          <p className="muted">Nothing has happened yet. Create an issue or start an investigation.</p>
        ) : (
          <ul className="feed">
            {activity.map((line, index) => (
              <li key={`${line.href}-${index}`}>
                <button className="link-button" onClick={() => onNavigate(line.href)}>{line.label}</button>
                <span className="muted">{timeAgo(line.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
