import { useMemo, useState } from "react";
import { Archive, ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { EnvironmentsPanel } from "./EnvironmentsPanel";
import { ProjectFormDialog } from "./ProjectFormDialog";
import type { ProjectDraft } from "./ProjectFormDialog";
import { useAccess } from "../access/useAccess";
import { can } from "../access/permissions";
import { addAllowedHost } from "../workspace/workspaceApi";
import { useProjectMutations, useOpenIssueCount, useProjects } from "./useProjects";
import { Alert } from "../../shared/ui/Alert";
import { EmptyState } from "../../shared/ui/EmptyState";
import { Modal } from "../../shared/ui/Modal";
import { failureMessage } from "../../lib/blocks/records";
import { useT } from "../../lib/i18n/LocalizationProvider";

export function ProjectDetailPage({ onNavigate, projectId }: { onNavigate: (path: string) => void; projectId: string }) {
  const access = useAccess();
  const role = access.data?.role;
  const workspaceId = access.data?.workspaceId;
  const projects = useProjects(workspaceId);
  const openIssues = useOpenIssueCount(projectId);
  const mutations = useProjectMutations(workspaceId, role);
  const { t } = useT();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [hostNotice, setHostNotice] = useState("");

  const project = useMemo(
    () => (projects.data ?? []).find((item) => item.itemId === projectId),
    [projects.data, projectId]
  );
  const canManage = can(role, "manageProjects");
  const canRemove = can(role, "removeProjects");
  const openCount = openIssues.data ?? 0;

  if (projects.isLoading || access.isLoading) {
    return <section><Alert tone="info">{t("common.loading")}</Alert></section>;
  }

  if (!project) {
    return (
      <section>
        <EmptyState description={t("project.notFound")} title={t("notFound.title")} />
        <button className="secondary-button" onClick={() => onNavigate("/projects")} type="button">
          <ArrowLeft size={16} /> {t("project.back")}
        </button>
      </section>
    );
  }

  const itemId = project.itemId;

  async function hostJoined(host: string) {
    if (!canManage) return;
    await addAllowedHost(access.data?.workspace ?? {}, host);
    await access.refetch();
    setHostNotice(t("project.environment.hostAdded").replace("{host}", host));
  }

  function removeOrArchive(archive: boolean) {
    if (!canRemove) return;
    if (archive) {
      mutations.update.mutate({ input: { archived: true }, itemId }, { onSuccess: () => setRemoveOpen(false) });
      return;
    }
    mutations.remove.mutate(itemId, {
      onSuccess: () => {
        setRemoveOpen(false);
        onNavigate("/projects");
      }
    });
  }

  return (
    <section>
      <button className="link-button" onClick={() => onNavigate("/projects")} type="button">
        <ArrowLeft size={16} /> {t("project.back")}
      </button>

      <header className="page-header" style={{ marginTop: 12 }}>
        <div>
          <h2>{project.name}</h2>
          <p>
            {project.archived
              ? t("projects.status.archived")
              : `${t("project.openIssues")}: ${openCount}`}
          </p>
        </div>
        <div className="page-actions">
          <span className={project.archived ? "badge badge-neutral" : "badge badge-good"}>
            {project.archived ? t("projects.status.archived") : t("projects.status.active")}
          </span>
          {canManage ? (
            <button className="secondary-button" onClick={() => setEditOpen(true)} type="button">
              <Pencil size={16} /> {t("common.edit")}
            </button>
          ) : null}
          {canRemove ? (
            <button className="icon-button" onClick={() => setRemoveOpen(true)} type="button">
              <Trash2 size={16} /> {t("common.delete")}
            </button>
          ) : null}
        </div>
      </header>

      {hostNotice ? <Alert tone="info">{hostNotice}</Alert> : null}
      {!canManage ? <Alert tone="info">{t("projects.readOnly")}</Alert> : null}

      <div className="panel">
        <div className="panel-title"><h3>{t("project.details")}</h3></div>
        <dl className="meta-list">
          <dt>{t("projects.form.description")}</dt>
          <dd>{project.description?.trim() ? project.description : t("muted.none")}</dd>
          <dt>{t("projects.column.owner")}</dt>
          <dd>{project.owner?.trim() ? project.owner : t("muted.none")}</dd>
          <dt>{t("projects.column.tags")}</dt>
          <dd>
            <span className="chips">
              {(project.tags ?? []).length === 0
                ? t("muted.none")
                : (project.tags ?? []).map((tag) => <span className="chip" key={tag}>{tag}</span>)}
            </span>
          </dd>
          <dt>{t("projects.form.repositoryUrl")}</dt>
          <dd>
            {project.repositoryUrl ? (
              <a className="text-link" href={project.repositoryUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={14} /> {project.repositoryUrl}
              </a>
            ) : t("muted.none")}
          </dd>
        </dl>
      </div>

      <EnvironmentsPanel
        canManage={canManage}
        onHostAdded={(host) => { void hostJoined(host); }}
        projectId={itemId}
        role={role}
        workspaceId={workspaceId ?? ""}
      />

      {editOpen ? (
        <ProjectFormDialog
          error={mutations.update.error ? failureMessage(mutations.update.error, t("common.error")) : undefined}
          existingNames={(projects.data ?? []).map((item) => String(item.name ?? "")).filter((name) => name !== project.name)}
          onCancel={() => { setEditOpen(false); mutations.update.reset(); }}
          onSubmit={(draft: ProjectDraft) => mutations.update.mutate(
            { input: { ...draft }, itemId },
            { onSuccess: () => setEditOpen(false) }
          )}
          pending={mutations.update.isPending}
          project={project}
        />
      ) : null}

      {removeOpen ? (
        <Modal onClose={() => setRemoveOpen(false)} title={t("project.remove.title")}>
          <p>
            {openCount > 0
              ? t("project.remove.archiveInstead").replace("{count}", String(openCount))
              : t("project.remove.confirm")}
          </p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setRemoveOpen(false)} type="button">{t("common.cancel")}</button>
            {openCount > 0 ? (
              <button className="primary-button" onClick={() => removeOrArchive(true)} type="button">
                <Archive size={16} /> {t("common.archive")}
              </button>
            ) : (
              <button className="primary-button danger" onClick={() => removeOrArchive(false)} type="button">
                <Trash2 size={16} /> {t("common.delete")}
              </button>
            )}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
