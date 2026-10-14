import { useMemo, useState } from "react";
import { PageHeader } from "../../shared/ui/PageHeader";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { ErrorState } from "../../shared/ui/ErrorState";
import { can } from "../access/permissions";
import { useAccess } from "../access/useAccess";
import { listEnvironments } from "../projects/projectsApi";
import { checkScope } from "./scope";
import { createInvestigation } from "./investigationsApi";
import { emptyDraft, STEP_NAMES } from "./wizard/draft";
import type { Draft } from "./wizard/draft";
import { TargetStep } from "./wizard/TargetStep";
import { EvidenceStep } from "./wizard/EvidenceStep";
import { ChecksStep } from "./wizard/ChecksStep";
import { ReviewStep } from "./wizard/ReviewStep";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "../projects/projectsApi";

/** IN-01 / IN-02 — four steps: target, evidence, what will be checked, review. */
export function StartInvestigationPage({ initialUrl, onNavigate }: { initialUrl?: string; onNavigate: (path: string) => void }) {
  const access = useAccess();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(initialUrl));
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const projects = useQuery({ enabled: Boolean(access.data), queryFn: () => listProjects(access.data?.workspaceId ?? ""), queryKey: ["projects", access.data?.workspaceId] });
  const environments = useQuery({
    enabled: Boolean(draft.projectId),
    queryFn: () => listEnvironments(draft.projectId),
    queryKey: ["environments", draft.projectId]
  });

  const scope = useMemo(
    () => checkScope({
      allowedHosts: access.data?.workspace.allowedHosts ?? [],
      allowedPaths: access.data?.workspace.allowedPaths ?? [],
      url: draft.url
    }),
    [access.data?.workspace.allowedHosts, access.data?.workspace.allowedPaths, draft.url]
  );

  if (access.isLoading) return <LoadingScreen />;
  if (!access.data) return <ErrorState message="Workspace access could not be read." />;
  if (!can(access.data.role, "runInvestigations")) {
    return (
      <div className="empty-state">
        <h3>Not allowed</h3>
        <p>Only an admin or QA engineer can run investigations.</p>
      </div>
    );
  }

  const environment = (environments.data ?? []).find((item) => (item.itemId ?? "") === draft.environmentId);
  const project = (projects.data ?? []).find((item) => (item.itemId ?? "") === draft.projectId);

  function next() {
    setError("");
    if (step === 0) {
      if (!scope.ok) {
        setError(scope.message);
        return;
      }
      setStep(1);
      return;
    }
    setStep((value) => Math.min(3, value + 1));
  }

  async function confirm() {
    setStarting(true);
    setError("");
    try {
      const created = await createInvestigation({
        access: access.data!,
        checks: draft.checks,
        environmentId: draft.environmentId || undefined,
        evidenceItemIds: draft.evidence.map((item) => String(item.itemId ?? "")).filter(Boolean),
        problem: draft.problem,
        projectId: draft.projectId || undefined,
        title: draft.title,
        url: draft.url
      });
      onNavigate(`/investigations/${created.itemId ?? ""}`);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "The investigation could not be started.");
      setStarting(false);
    }
  }

  return (
    <section style={{ maxWidth: 760 }}>
      <PageHeader subtitle="Only investigate systems you own or are authorized to test." title="Start an investigation" />
      <ol className="steps">
        {STEP_NAMES.map((name, index) => (
          <li className={index === step ? "active" : index < step ? "done" : ""} key={name}>
            <span>{index + 1}</span> {name}
          </li>
        ))}
      </ol>

      {step === 0 ? <TargetStep access={access.data} draft={draft} onDraft={setDraft} /> : null}
      {step === 1 ? <EvidenceStep access={access.data} draft={draft} onDraft={setDraft} /> : null}
      {step === 2 ? <ChecksStep access={access.data} draft={draft} environment={environment} onDraft={setDraft} /> : null}
      {step === 3 ? <ReviewStep access={access.data} draft={draft} environment={environment} onConfirm={() => void confirm()} project={project} /> : null}

      {error ? <p className="field-error" style={{ marginTop: 12 }}>{error}</p> : null}

      {step < 3 ? (
        <div className="form-actions" style={{ marginTop: 16 }}>
          {step > 0 ? <button className="icon-button" onClick={() => setStep((value) => value - 1)}>Back</button> : null}
          <button className="primary-button" disabled={starting || (step === 0 && !scope.ok)} onClick={next}>
            {step === 0 ? "Continue" : "Next"}
          </button>
        </div>
      ) : (
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="icon-button" disabled={starting} onClick={() => setStep(2)}>Back</button>
        </div>
      )}
      {starting ? <p className="muted">Starting...</p> : null}
    </section>
  );
}
