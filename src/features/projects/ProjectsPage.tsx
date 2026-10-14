import { useMemo, useState } from "react";
import { Folder, Plus, Search } from "lucide-react";
import { ProjectFormDialog } from "./ProjectFormDialog";
import type { ProjectDraft } from "./ProjectFormDialog";
import { useAccess } from "../access/useAccess";
import { can } from "../access/permissions";
import { useProjectMutations, useProjectRollup, useProjects } from "./useProjects";
import { failureMessage } from "../../lib/blocks/records";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useT } from "../../lib/i18n/LocalizationProvider";
import type { ProjectRecord } from "./projectsApi";

export function ProjectsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const access = useAccess();
  const role = access.data?.role;
  const workspaceId = access.data?.workspaceId;
  const projects = useProjects(workspaceId);
  const rollup = useProjectRollup(workspaceId);
  const mutations = useProjectMutations(workspaceId, role);
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ project?: ProjectRecord } | undefined>();
  const canManage = can(role, "manageProjects");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (projects.data ?? []).filter((project) => {
      if (!showArchived && project.archived) return false;
      if (!term) return true;
      const haystack = [project.name, project.owner, ...(project.tags ?? [])].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [projects.data, search, showArchived]);

  const takenNames = (projects.data ?? []).map((project) => String(project.name ?? ""));

  function create(draft: ProjectDraft) {
    if (!canManage) return;
    mutations.create.mutate(
      { ...draft, archived: false, workspaceId: workspaceId ?? "" },
      { onSuccess: () => setDialog(undefined) }
    );
  }

  return (
    <section>
      <PageHeader
        actions={canManage ? (
          <button className="primary-button" onClick={() => setDialog({})} type="button">
            <Plus size={18} /> {t("projects.new")}
          </button>
        ) : null}
        subtitle={t("projects.subtitle")}
        title={t("projects.title")}
      />

      {!canManage ? <Alert tone="info">{t("projects.readOnly")}</Alert> : null}
      {access.isError ? <ErrorState message={t("projects.loadError")} onRetry={() => access.refetch()} /> : null}
      {projects.isError ? <ErrorState message={t("projects.loadError")} onRetry={() => projects.refetch()} /> : null}

      <div className="toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label={t("projects.search")}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("projects.search")}
            value={search}
          />
        </label>
        <label className="muted">
          <input checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} type="checkbox" />
          {t("projects.filter.archived")}
        </label>
      </div>

      {projects.isLoading ? (
        <div className="panel"><Skeleton className="skeleton-line" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          description={projects.data?.length ? t("projects.empty.filteredHint") : t("projects.empty.hint")}
          icon={<Folder size={26} />}
          title={projects.data?.length ? t("projects.empty.filtered") : t("projects.empty.title")}
        />
      ) : (
        <DataTable<ProjectRecord>
          columns={[
            {
              header: t("projects.column.name"),
              key: "name",
              render: (row) => <strong>{row.name}</strong>
            },
            {
              header: t("projects.column.owner"),
              key: "owner",
              render: (row) => row.owner || t("muted.none")
            },
            {
              header: t("projects.column.environments"),
              key: "environments",
              render: (row) => rollup.data?.environmentCount.get(String(row.itemId)) ?? 0
            },
            {
              header: t("projects.column.openIssues"),
              key: "openIssues",
              render: (row) => rollup.data?.openIssueCount.get(String(row.itemId)) ?? 0
            },
            {
              header: t("projects.column.tags"),
              key: "tags",
              render: (row) => (
                <span className="chips">
                  {(row.tags ?? []).map((tag) => <span className="chip" key={tag}>{tag}</span>)}
                </span>
              )
            },
            {
              header: t("projects.column.status"),
              key: "status",
              render: (row) => (
                <span className={row.archived ? "badge badge-neutral" : "badge badge-good"}>
                  {row.archived ? t("projects.status.archived") : t("projects.status.active")}
                </span>
              )
            }
          ]}
          onRowOpen={(row) => onNavigate(`/projects/${row.itemId}`)}
          rows={rows}
        />
      )}

      {dialog ? (
        <ProjectFormDialog
          error={mutations.create.error ? failureMessage(mutations.create.error, t("common.error")) : undefined}
          existingNames={takenNames}
          onCancel={() => { setDialog(undefined); mutations.create.reset(); }}
          onSubmit={create}
          pending={mutations.create.isPending}
        />
      ) : null}
    </section>
  );
}
