import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LayoutGrid, Plus, Rows3, Search } from "lucide-react";
import { PageHeader } from "../../shared/ui/PageHeader";
import { DataTable } from "../../shared/ui/DataTable";
import type { Column } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { SEVERITIES, STATUSES } from "../../shared/domain/constants";
import { timeAgo } from "../../shared/domain/format";
import { can } from "../access/permissions";
import { useAccess } from "../access/useAccess";
import { listAllEnvironments, listProjects } from "../projects/projectsApi";
import { IssueSeverityBadge, IssueStatusBadge } from "./IssueBadges";
import { listIssues } from "./issuesApi";
import type { IssueRecord } from "./issuesApi";
import { NewIssueDialog } from "./NewIssueDialog";

const LIST_QUERY_KEY = "buglens.issues.list";
const PAGE_SIZE = 25;

type Filters = { page: number; projectId: string; severity: string; status: string; text: string; view: string };

// Filters live in the address, and the last set is remembered in the browser, so
// opening an issue and coming back lands on the same filtered, paged list.
function readFilters(raw: string): Filters {
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const page = Number(params.get("page") ?? "1");
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    projectId: params.get("project") ?? "",
    severity: params.get("severity") ?? "",
    status: params.get("status") ?? "",
    text: params.get("q") ?? "",
    view: params.get("view") === "board" ? "board" : "list"
  };
}

function writeFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.text) params.set("q", filters.text);
  if (filters.projectId) params.set("project", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.view === "board") params.set("view", "board");
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `/issues?${query}` : "/issues";
}

export function IssuesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const access = useAccess();
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState<Filters>(() =>
    readFilters(window.location.search || window.sessionStorage.getItem(LIST_QUERY_KEY) || "")
  );

  useEffect(() => {
    const next = writeFilters(filters);
    window.history.replaceState({}, "", next);
    if (next === "/issues") window.sessionStorage.removeItem(LIST_QUERY_KEY);
    else window.sessionStorage.setItem(LIST_QUERY_KEY, next);
  }, [filters]);

  function update(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  function openIssue(item: IssueRecord) {
    onNavigate(`/issues/${item.itemId ?? ""}`);
  }

  const items = useQuery({
    enabled: Boolean(access.data),
    queryFn: () => listIssues(access.data?.workspaceId ?? ""),
    queryKey: ["issues", access.data?.workspaceId]
  });
  const projects = useQuery({ enabled: Boolean(access.data), queryFn: () => listProjects(access.data?.workspaceId ?? ""), queryKey: ["projects", access.data?.workspaceId] });
  useQuery({ enabled: Boolean(access.data), queryFn: () => listAllEnvironments(access.data?.workspaceId ?? ""), queryKey: ["environments-all", access.data?.workspaceId] });

  const rows = useMemo(() => {
    const text = filters.text.trim().toLowerCase();
    return (items.data ?? [])
      .filter((item) => (filters.projectId ? item.projectId === filters.projectId : true))
      .filter((item) => (filters.status ? item.status === filters.status : true))
      .filter((item) => (filters.severity ? item.severity === filters.severity : true))
      .filter((item) => (text ? `${item.issueKey} ${item.title} ${item.summary ?? ""}`.toLowerCase().includes(text) : true));
  }, [filters, items.data]);

  if (access.isLoading || items.isLoading) return <LoadingScreen />;
  if (!access.data) return <ErrorState message="Workspace access could not be read." />;
  if (items.isError) return <ErrorState message="The issues could not be read." />;

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canCreate = can(access.data.role, "createIssues");
  const projectName = (id: string | undefined) => (projects.data ?? []).find((project) => project.itemId === id)?.name || "—";

  const columns: Column<IssueRecord>[] = [
    { key: "key", header: "ID", render: (row) => <strong className="mono">{row.issueKey}</strong> },
    { key: "title", header: "Title", render: (row) => <span>{row.title}{row.duplicateOfIssueId ? <span className="badge badge-neutral"> Duplicate</span> : null}</span> },
    { key: "project", header: "Project", render: (row) => projectName(row.projectId) },
    { key: "severity", header: "Severity", render: (row) => <IssueSeverityBadge severity={row.severity} /> },
    { key: "status", header: "Status", render: (row) => <IssueStatusBadge status={row.status} /> },
    { key: "assignee", header: "Assignee", render: (row) => row.assigneeName || "Unassigned" },
    { key: "updated", header: "Updated", render: (row) => timeAgo(row.lastUpdated) }
  ];

  return (
    <section>
      <PageHeader
        actions={canCreate ? (
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Plus size={16} /> Report an issue
          </button>
        ) : undefined}
        subtitle="Every recorded defect, with its report and outcome."
        title="Issues"
      />

      <div className="toolbar">
        <label className="search-box">
          <Search size={16} />
          <input onChange={(event) => update({ text: event.target.value })} placeholder="Search by ID or title" value={filters.text} />
        </label>
        <div className="toolbar-actions">
          <div className="tabs">
            <button className={`tab${filters.view === "list" ? " active" : ""}`} onClick={() => update({ view: "list" })}><Rows3 size={15} /> List</button>
            <button className={`tab${filters.view === "board" ? " active" : ""}`} onClick={() => update({ view: "board" })}><LayoutGrid size={14} /> Board</button>
          </div>
        </div>
      </div>

      <div className="filter-grid">
        <label className="form-field"><span>Project</span>
          <select onChange={(event) => update({ projectId: event.target.value })} value={filters.projectId}>
            <option value="">All projects</option>
            {(projects.data ?? []).map((project) => <option key={project.itemId} value={project.itemId}>{project.name}</option>)}
          </select>
        </label>
        <label className="form-field"><span>Status</span>
          <select onChange={(event) => update({ status: event.target.value })} value={filters.status}>
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="form-field"><span>Severity</span>
          <select onChange={(event) => update({ severity: event.target.value })} value={filters.severity}>
            <option value="">All severities</option>
            {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
          </select>
        </label>
      </div>

      {filters.view === "board" ? (
        <div className="board">
          {STATUSES.map((status) => {
            const cards = rows.filter((row) => (row.status || "New") === status);
            return (
              <div className="board-col" key={status}>
                <div className="panel-title"><h3>{status}</h3><span className="muted">{cards.length}</span></div>
                {cards.map((card) => (
                  <button className="board-card" key={String(card.itemId)} onClick={() => openIssue(card)}>
                    <span className="mono">{card.issueKey}</span>
                    <span>{card.title}</span>
                    <span className="board-card-foot">
                      <IssueSeverityBadge severity={card.severity} />
                      <span className="muted">{card.assigneeName || "Unassigned"}</span>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          action={canCreate ? <button className="primary-button" onClick={() => setCreating(true)}>Report the first issue</button> : undefined}
          description="Issues can be reported by hand or created when an investigation closes."
          title="No issues yet"
        />
      ) : (
        <DataTable columns={columns} onRowOpen={openIssue} rows={pageRows} />
      )}

      {rows.length > 0 ? (
        <div className="pagination">
          <span className="pagination-count">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} issues
          </span>
          <span className="pagination-controls">
            <button className="secondary-button" disabled={page <= 1} onClick={() => update({ page: page - 1 })}><ChevronLeft size={16} /> Previous</button>
            <span>Page {page} of {pageCount}</span>
            <button className="secondary-button" disabled={page >= pageCount} onClick={() => update({ page: page + 1 })}>Next <ChevronRight size={16} /></button>
          </span>
        </div>
      ) : null}

      {creating ? (
        <NewIssueDialog
          access={access.data}
          onClose={() => setCreating(false)}
          onCreated={(itemId) => {
            setCreating(false);
            if (itemId) onNavigate(`/issues/${itemId}`);
          }}
        />
      ) : null}
    </section>
  );
}
