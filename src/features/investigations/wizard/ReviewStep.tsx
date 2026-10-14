import { useState } from "react";
import { Alert } from "../../../shared/ui/Alert";
import { Modal } from "../../../shared/ui/Modal";
import { formatDateTime } from "../../../shared/domain/format";
import { scopeLine } from "../scope";
import type { Draft } from "./draft";
import type { Access } from "../../../features/access/useAccess";
import type { EnvironmentRecord } from "../../projects/projectsApi";
import type { ProjectRecord } from "../../projects/projectsApi";

export function ReviewStep({
  access,
  draft,
  environment,
  onConfirm,
  project
}: {
  access: Access;
  draft: Draft;
  environment: EnvironmentRecord | undefined;
  onConfirm: () => void;
  project: ProjectRecord | undefined;
}) {
  const [productionOpen, setProductionOpen] = useState(false);
  const hosts = [...(environment?.allowedHosts ?? []), ...(access.workspace.allowedHosts ?? [])];
  const isProduction = environment?.type === "Production";

  function start() {
    if (isProduction) setProductionOpen(true);
    else onConfirm();
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <dl className="meta-list">
        <dt>Target</dt><dd className="mono">{draft.url}</dd>
        <dt>Problem</dt><dd>{draft.problem.trim() || "Not given."}</dd>
        <dt>Evidence</dt><dd>{draft.evidence.length === 0 ? "No evidence attached yet — the investigation can still start." : `${draft.evidence.length} item${draft.evidence.length === 1 ? "" : "s"}: ${draft.evidence.map((item) => item.evdId).join(", ")}`}</dd>
        <dt>Environment</dt><dd>{environment ? `${environment.name} (${environment.type})` : "Not chosen"}</dd>
        <dt>Project</dt><dd>{project?.name || "Not chosen"}</dd>
        <dt>Checks planned</dt><dd>{draft.checks.length === 0 ? "None ticked yet." : draft.checks.join(" · ")}</dd>
      </dl>
      <p className="field-hint">{scopeLine(hosts, environment?.allowedPaths ?? [])}</p>
      {isProduction ? (
        <Alert tone="warn">This environment is Production. A confirmation step follows before the investigation starts.</Alert>
      ) : null}
      <div className="form-actions">
        <button className="primary-button" onClick={start}>Start Investigation</button>
      </div>

      {productionOpen ? (
        <Modal onClose={() => setProductionOpen(false)} title="Production system">
          <p>You are investigating a production system. Only continue if you are authorized to test it.</p>
          <div className="modal-actions">
            <button className="icon-button" onClick={() => setProductionOpen(false)}>Cancel</button>
            <button
              className="primary-button"
              onClick={() => {
                setProductionOpen(false);
                onConfirm();
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      ) : null}
      <p className="muted">Started {formatDateTime(new Date().toISOString())} by {access.actor.name}.</p>
    </div>
  );
}
