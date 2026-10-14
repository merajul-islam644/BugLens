import { useProjects } from "../../projects/useProjects";
import { EvidenceUploader } from "../../evidence/EvidenceUploader";
import type { Draft } from "./draft";
import type { Access } from "../../../features/access/useAccess";

export function EvidenceStep({
  access,
  draft,
  onDraft
}: {
  access: Access;
  draft: Draft;
  onDraft: (next: Draft) => void;
}) {
  const projects = useProjects(access.workspaceId);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <p className="muted">
        Attach what you captured: screenshots, recordings, traces, console logs, request and response files — or paste the text.
        Nothing is fetched from the target application.
      </p>
      <EvidenceUploader
        access={access}
        context={{ environmentId: draft.environmentId || undefined, projectId: draft.projectId || undefined }}
        onAdded={(item) => onDraft({ ...draft, evidence: [...draft.evidence, item] })}
        projects={(projects.data ?? []).map((project) => ({ id: String(project.itemId), name: String(project.name) }))}
      />
      {draft.evidence.length > 0 ? (
        <p className="field-hint">{draft.evidence.map((item) => item.evdId).join(", ")} attached. They link to this investigation when it starts.</p>
      ) : (
        <p className="muted">No evidence attached yet. You can add it later too — the investigation starts on the target URL alone.</p>
      )}
    </div>
  );
}
