import { useState } from "react";
import { createProject, listEnvironments, listProjects } from "../../projects/projectsApi";
import { useProjects } from "../../projects/useProjects";
import { Alert } from "../../../shared/ui/Alert";
import { failureMessage } from "../../../lib/blocks/records";
import { checkScope } from "../scope";
import type { Draft } from "./draft";
import type { Access } from "../../../features/access/useAccess";
import type { EnvironmentRecord } from "../../projects/projectsApi";

const PROBLEM_PLACEHOLDER =
  "After saving the profile form, the success message appears, but the new display name is not shown after refreshing.";

export function TargetStep({
  access,
  draft,
  onDraft
}: {
  access: Access;
  draft: Draft;
  onDraft: (next: Draft) => void;
}) {
  const projects = useProjects(access.workspaceId);
  const [newProject, setNewProject] = useState("");
  const [creating, setCreating] = useState(false);
  const [environments, setEnvironments] = useState<EnvironmentRecord[]>([]);
  const [error, setError] = useState("");

  const scope = checkScope({
    allowedHosts: access.workspace.allowedHosts ?? [],
    allowedPaths: access.workspace.allowedPaths ?? [],
    url: draft.url
  });
  const urlTouched = draft.url.trim().length > 0;

  async function addProject() {
    const name = newProject.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      await createProject({
        archived: false,
        description: "",
        name,
        owner: access.actor.name,
        repositoryUrl: "",
        tags: [],
        workspaceId: access.workspaceId
      });
      await projects.refetch();
      setNewProject("");
      setCreating(false);
    } catch (caught) {
      setCreating(false);
      setError(failureMessage(caught, "The project could not be created."));
    }
  }

  async function pickProject(projectId: string) {
    onDraft({ ...draft, environmentId: "", projectId });
    setEnvironments(projectId ? await listEnvironments(projectId) : []);
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <label className="form-field">
        <span>Application URL</span>
        <input
          autoFocus
          className={urlTouched && !scope.ok ? undefined : undefined}
          onChange={(event) => onDraft({ ...draft, url: event.target.value })}
          placeholder="https://staging.example.com/profile"
          value={draft.url}
        />
      </label>
      {urlTouched && !scope.ok ? <Alert tone="error">{scope.message}</Alert> : null}
      {urlTouched && scope.ok ? <p className="field-hint">Target is on an allowed host.</p> : null}

      <div className="form-grid">
        <div className="grid" style={{ gap: 8 }}>
          <label className="form-field">
            <span>Project</span>
            <select onChange={(event) => void pickProject(event.target.value)} value={draft.projectId}>
              <option value="">Select a project</option>
              {(projects.data ?? []).map((project) => <option key={project.itemId} value={project.itemId}>{project.name}</option>)}
            </select>
          </label>
          {creating || newProject ? (
            <div className="toolbar-actions">
              <input className="form-field" onChange={(event) => setNewProject(event.target.value)} placeholder="New project name" style={{ flex: 1 }} value={newProject} />
              <button className="secondary-button" disabled={creating || !newProject.trim()} onClick={() => void addProject()}>Add project</button>
            </div>
          ) : (
            <button className="link-button" onClick={() => setNewProject(" ")}>Create a project inline</button>
          )}
          {error ? <span className="field-error">{error}</span> : null}
        </div>
        <label className="form-field">
          <span>Environment</span>
          <select onChange={(event) => onDraft({ ...draft, environmentId: event.target.value })} value={draft.environmentId}>
            <option value="">Select an environment</option>
            {environments.map((environment) => <option key={environment.itemId} value={environment.itemId}>{environment.name}</option>)}
          </select>
        </label>
      </div>

      <label className="form-field">
        <span>Problem (optional)</span>
        <textarea onChange={(event) => onDraft({ ...draft, problem: event.target.value })} placeholder={PROBLEM_PLACEHOLDER} value={draft.problem} />
      </label>

      <label className="form-field">
        <span>Short name (optional)</span>
        <input onChange={(event) => onDraft({ ...draft, title: event.target.value })} placeholder="Profile save bug" value={draft.title} />
      </label>
    </div>
  );
}
