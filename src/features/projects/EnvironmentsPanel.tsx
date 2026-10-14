import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { EnvironmentFormDialog } from "./EnvironmentFormDialog";
import { hostOf } from "./environmentTypes";
import type { EnvironmentDraft } from "./useProjects";
import { useEnvironments, useEnvironmentMutations } from "./useProjects";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { useT } from "../../lib/i18n/LocalizationProvider";
import type { RoleSlug } from "../access/permissions";
import type { EnvironmentRecord } from "./projectsApi";

/**
 * A project's environments. Saving a new one reports its host upward, so the
 * workspace can add it to the allowed hosts list.
 */
export function EnvironmentsPanel({
  canManage,
  onHostAdded,
  projectId,
  role,
  workspaceId
}: {
  canManage: boolean;
  onHostAdded: (host: string) => void;
  projectId: string;
  role?: RoleSlug;
  workspaceId: string;
}) {
  const { t } = useT();
  const environments = useEnvironments(projectId);
  const mutations = useEnvironmentMutations(projectId, role);
  const [draft, setDraft] = useState<{ record?: EnvironmentRecord } | undefined>();
  const rows = environments.data ?? [];

  async function save(next: EnvironmentDraft) {
    if (!canManage) return;
    const isNew = !next.itemId;
    await mutations.save.mutateAsync(next);
    if (isNew) {
      const host = hostOf(next.baseUrl);
      if (host) onHostAdded(host);
    }
    setDraft(undefined);
  }

  return (
    <>
      <div className="toolbar">
        <div className="panel-title"><h3>{t("project.environments")}</h3></div>
        {canManage ? (
          <div className="toolbar-actions">
            <button className="primary-button" onClick={() => setDraft({})} type="button">
              <Plus size={16} /> {t("project.environment.add")}
            </button>
          </div>
        ) : null}
      </div>

      {rows.some((row) => row.type === "Production") ? (
        <Alert tone="warn">{t("project.environment.productionWarning")}</Alert>
      ) : null}

      {environments.isError ? (
        <ErrorState message={t("projects.loadError")} onRetry={() => environments.refetch()} />
      ) : environments.isLoading ? (
        <Alert tone="info">{t("common.loading")}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState description={t("project.environmentsEmpty.hint")} title={t("project.environmentsEmpty.title")} />
      ) : (
        <DataTable<EnvironmentRecord>
          columns={[
            { header: t("project.environment.column.name"), key: "name", render: (row) => <strong>{row.name}</strong> },
            {
              header: t("project.environment.column.type"),
              key: "type",
              render: (row) => (
                <span className={row.type === "Production" ? "badge badge-warn" : "badge badge-neutral"}>{row.type}</span>
              )
            },
            {
              header: t("project.environment.column.baseUrl"),
              key: "baseUrl",
              render: (row) => (row.baseUrl ? <span className="mono">{row.baseUrl}</span> : t("muted.none"))
            },
            { header: t("project.environment.column.browser"), key: "browser", render: (row) => row.browserDefault || t("muted.none") },
            { header: t("project.environment.column.build"), key: "build", render: (row) => row.buildLabel || t("muted.none") },
            {
              header: "",
              key: "edit",
              render: (row) => (canManage ? (
                <div className="row-actions">
                  <button className="icon-button" onClick={() => setDraft({ record: row })} type="button">
                    <Pencil size={16} />
                  </button>
                </div>
              ) : null)
            }
          ]}
          rows={rows}
        />
      )}

      {draft ? (
        <EnvironmentFormDialog
          onCancel={() => setDraft(undefined)}
          onSubmit={(next) => { void save(next); }}
          pending={mutations.save.isPending}
          projectId={projectId}
          record={draft.record}
          workspaceId={workspaceId}
        />
      ) : null}
    </>
  );
}
