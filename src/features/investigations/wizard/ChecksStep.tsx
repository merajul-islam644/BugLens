import { Alert } from "../../../shared/ui/Alert";
import { PLANNED_CHECKS } from "../../../shared/domain/constants";
import { scopeLine } from "../scope";
import type { Draft } from "./draft";
import type { Access } from "../../../features/access/useAccess";
import type { EnvironmentRecord } from "../../projects/projectsApi";

export function ChecksStep({
  access,
  draft,
  environment,
  onDraft
}: {
  access: Access;
  draft: Draft;
  environment: EnvironmentRecord | undefined;
  onDraft: (next: Draft) => void;
}) {
  void access;
  const hosts = [...(environment?.allowedHosts ?? []), ...(access.workspace.allowedHosts ?? [])];
  const paths = [...(environment?.allowedPaths ?? [])];

  function toggle(check: string) {
    onDraft({
      ...draft,
      checks: draft.checks.includes(check) ? draft.checks.filter((item) => item !== check) : [...draft.checks, check]
    });
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Alert tone="info">
        BugLens does not open or change the target application. Record the checks you will run yourself.
      </Alert>
      <div className="grid" style={{ gap: 8 }}>
        {PLANNED_CHECKS.map((check) => (
          <label className="muted" key={check} style={{ gap: 10 }}>
            <input checked={draft.checks.includes(check)} onChange={() => toggle(check)} type="checkbox" />
            <span style={{ color: "hsl(var(--foreground))" }}>{check}</span>
          </label>
        ))}
      </div>
      <p className="field-hint">{scopeLine(hosts, paths)}</p>
    </div>
  );
}
