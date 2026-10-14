import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Microscope, Plus } from "lucide-react";
import { PageHeader } from "../../shared/ui/PageHeader";
import { DataTable } from "../../shared/ui/DataTable";
import type { Column } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { can } from "../access/permissions";
import { useAccess } from "../access/useAccess";
import { listEvidence } from "../evidence/evidenceApi";
import { listAllEnvironments, listProjects } from "../projects/projectsApi";
import { hostOf } from "./scope";
import { listInvestigations, parseStages } from "./investigationsApi";
import type { InvestigationRecord } from "./investigationsApi";
import { formatElapsed, timeAgo } from "../../shared/domain/format";

function statusBadge(status: string | undefined) {
  const tone = status === "In progress" ? "badge-warn" : status === "Cancelled" ? "badge-neutral" : "badge-good";
  return <span className={`badge ${tone}`}>{status || "In progress"}</span>;
}

export function InvestigationsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const access = useAccess();
  const [hostFilter, setHostFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const items = useQuery({ enabled: Boolean(access.data), queryFn: () => listInvestigations(access.data?.workspaceId ?? ""), queryKey: ["investigations", access.data?.workspaceId] });
  const evidence = useQuery({ enabled: Boolean(access.data), queryFn: () => listEvidence(access.data?.workspaceId ?? ""), queryKey: ["evidence"] });
  const projects = useQuery({ enabled: Boolean(access.data), queryFn: () => listProjects(access.data?.workspaceId ?? ""), queryKey: ["projects", access.data?.workspaceId] });
  const environments = useQuery({ enabled: Boolean(access.data), queryFn: () => listAllEnvironments(access.data?.workspaceId ?? ""), queryKey: ["environments-all", access.data?.workspaceId] });

  if (access.isLoading || items.isLoading) return <LoadingScreen />;
  if (!access.data) return <ErrorState message="Workspace access could not be read." />;
  if (items.isError) return <ErrorState message="The investigations could not be read." />;

  const rows = (items.data ?? [])
    .filter((item) => (hostFilter ? hostOf(String(item.targetUrl)).includes(hostFilter.toLowerCase()) : true))
    .filter((item) => (statusFilter ? String(item.status) === statusFilter : true));

  const projectName = (id: string | undefined) => (projects.data ?? []).find((item) => item.itemId === id)?.name || "—";
  const environmentName = (id: string | undefined) => (environments.data ?? []).find((item) => item.itemId === id)?.name || "—";
  const evidenceCount = (itemId: string) => (evidence.data ?? []).filter((item) => item.investigationId === itemId).length;

  const columns: Column<InvestigationRecord>[] = [
    { key: "inv", header: "ID", render: (row) => <strong>{row.invId}</strong> },
    { key: "host", header: "Target host", render: (row) => <span className="mono">{hostOf(String(row.targetUrl))}</span> },
    { key: "project", header: "Project / environment", render: (row) => `${projectName(row.projectId)} / ${environmentName(row.environmentId)}` },
    {
      key: "stage",
      header: "Stage",
      render: (row) => {
        const stages = parseStages(row.stages);
        const done = stages.filter((stage) => stage.done).length;
        return `${done} of ${stages.length}`;
      }
    },
    { key: "evidence", header: "Evidence", render: (row) => String(evidenceCount(String(row.itemId ?? ""))) },
    {
      key: "elapsed",
      header: "Elapsed",
      render: (row) => (row.status === "In progress" ? formatElapsed(row.startedAt) : `${timeAgo(row.startedAt)} to close`)
    },
    { key: "status", header: "Status", render: (row) => statusBadge(row.status) },
    { key: "by", header: "Started by", render: (row) => row.startedByName || "—" }
  ];

  return (
    <section>
      <PageHeader
        actions={can(access.data.role, "runInvestigations") ? (
          <button className="primary-button" onClick={() => onNavigate("/investigations/new")}>
            <Plus size={16} /> Investigate a bug
          </button>
        ) : undefined}
        subtitle="Timed, evidence-first attempts to explain one suspected defect."
        title="Investigations"
      />
      <div className="filter-grid">
        <label className="form-field"><span>Target host</span><input onChange={(event) => setHostFilter(event.target.value)} placeholder="staging.example.com" value={hostFilter} /></label>
        <label className="form-field">
          <span>Status</span>
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="">All statuses</option>
            <option>In progress</option>
            <option>Closed — issue created</option>
            <option>Linked to issue</option>
            <option>Cancelled</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          action={can(access.data.role, "runInvestigations") ? <button className="primary-button" onClick={() => onNavigate("/investigations/new")}>Start the first investigation</button> : undefined}
          description="Start an investigation from a URL and work through target, evidence, checks and review."
          icon={<Microscope size={28} />}
          title="No investigations yet"
        />
      ) : (
        <DataTable columns={columns} onRowOpen={(row) => onNavigate(`/investigations/${row.itemId ?? ""}`)} rows={rows} />
      )}
    </section>
  );
}
