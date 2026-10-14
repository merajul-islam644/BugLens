import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../../shared/ui/Alert";
import { Modal } from "../../shared/ui/Modal";
import { FINDING_TYPES, SEVERITIES } from "../../shared/domain/constants";
import { listAllEnvironments, listProjects } from "../projects/projectsApi";
import { listMembers } from "../workspace/workspaceApi";
import type { MemberRecord } from "../workspace/workspaceApi";
import { toRoleSlug } from "../access/permissions";
import { createIssue } from "./issuesApi";
import { emailAssignment, notifyUsers } from "../records/notifyApi";
import type { Access } from "../access/useAccess";

export function NewIssueDialog({ access, onClose, onCreated }: {
  access: Access;
  onClose: () => void;
  onCreated: (itemId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [assigneeId, setAssigneeId] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [error, setError] = useState("");
  const [findingType, setFindingType] = useState("");
  const [projectId, setProjectId] = useState("");
  const [route, setRoute] = useState("");
  const [saving, setSaving] = useState(false);
  const [severity, setSeverity] = useState("Medium");
  const [summary, setSummary] = useState("");
  const [title, setTitle] = useState("");

  const projects = useQuery({ queryFn: () => listProjects(access.workspaceId), queryKey: ["projects", access.workspaceId] });
  const environments = useQuery({ queryFn: () => listAllEnvironments(access.workspaceId), queryKey: ["environments-all", access.workspaceId] });
  const members = useQuery({ queryFn: listMembers, queryKey: ["members"] });

  const projectEnvironments = (environments.data ?? []).filter((item) => !projectId || item.projectId === projectId);
  const assignable = (members.data ?? []).filter((member: MemberRecord) => member.active !== false);

  async function save() {
    if (!title.trim()) {
      setError("Give the issue a title.");
      return;
    }
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const assignee = assignable.find((member) => (member.userId ?? "") === assigneeId);
      const created = await createIssue({
        access,
        assigneeId: assignee?.userId,
        assigneeName: assignee?.displayName || assignee?.email,
        environmentId,
        findingType,
        projectId,
        route,
        severity,
        summary,
        title
      });
      await queryClient.invalidateQueries({ queryKey: ["issues", access.workspaceId] });
      if (assignee?.userId && assignee.userId !== access.actor.id) {
        if (assignee.email) emailAssignment({ assignerName: access.actor.name, email: assignee.email, issueKey: created.issueKey ?? "An issue", issueTitle: title });
        notifyUsers([assignee.userId], `${access.actor.name} assigned ${created.issueKey ?? "an issue"} — ${title} — to you.`);
      }
      onCreated(String(created.itemId ?? ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The issue could not be created.");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Report an issue">
      <div className="form-grid">
        <label className="form-field span-all"><span>Title</span>
          <input autoFocus onChange={(event) => setTitle(event.target.value)} placeholder="What breaks, in one line" value={title} />
        </label>
        <label className="form-field span-all"><span>Summary</span>
          <textarea onChange={(event) => setSummary(event.target.value)} placeholder="What happened, where and how often" value={summary} />
        </label>
        <label className="form-field"><span>Project</span>
          <select onChange={(event) => { setProjectId(event.target.value); setEnvironmentId(""); }} value={projectId}>
            <option value="">No project</option>
            {(projects.data ?? []).map((project) => <option key={project.itemId} value={project.itemId}>{project.name}</option>)}
          </select>
        </label>
        <label className="form-field"><span>Environment</span>
          <select onChange={(event) => setEnvironmentId(event.target.value)} value={environmentId}>
            <option value="">No environment</option>
            {projectEnvironments.map((environment) => <option key={environment.itemId} value={environment.itemId}>{environment.name}</option>)}
          </select>
        </label>
        <label className="form-field"><span>Severity</span>
          <select onChange={(event) => setSeverity(event.target.value)} value={severity}>
            {SEVERITIES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="form-field"><span>Finding type</span>
          <select onChange={(event) => setFindingType(event.target.value)} value={findingType}>
            <option value="">Not classified</option>
            {FINDING_TYPES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="form-field"><span>Assign to</span>
          <select onChange={(event) => setAssigneeId(event.target.value)} value={assigneeId}>
            <option value="">Unassigned</option>
            {assignable.map((member) => (
              <option key={String(member.userId ?? member.itemId)} value={String(member.userId ?? "")}>
                {member.displayName || member.email} ({toRoleSlug(member.role) ? String(member.role) : "member"})
              </option>
            ))}
          </select>
        </label>
        <label className="form-field"><span>Route</span>
          <input onChange={(event) => setRoute(event.target.value)} placeholder="/checkout" value={route} />
        </label>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="form-actions">
        <button className="secondary-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" disabled={saving} onClick={() => void save()}>
          {saving ? "Creating…" : "Create issue"}
        </button>
      </div>
    </Modal>
  );
}
