import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { ErrorState } from "../../shared/ui/ErrorState";
import { Alert } from "../../shared/ui/Alert";
import { Modal } from "../../shared/ui/Modal";
import { ResizableSplit } from "../../shared/ui/ResizableSplit";
import { useAccess } from "../access/useAccess";
import type { Access } from "../access/useAccess";
import { listEvidence } from "../evidence/evidenceApi";
import { EvidencePreview } from "../evidence/EvidencePreview";
import { EvidenceUploader } from "../evidence/EvidenceUploader";
import { formatElapsed } from "../../shared/domain/format";
import { isOpenStatus } from "../../shared/domain/constants";
import { can } from "../access/permissions";
import { createIssue, listIssues, updateIssue } from "../issues/issuesApi";
import { EventFeed } from "./EventFeed";
import { FactsPanel, HypothesesPanel } from "./FindingsPanels";
import {
  addEvent,
  cancelInvestigation,
  closeInvestigationWithIssue,
  listEvents,
  listInvestigations,
  parseStages,
  setStage,
  updateEventText,
  updateInvestigation
} from "./investigationsApi";
import type { InvestigationRecord } from "./investigationsApi";
import { listFacts, listHypotheses } from "./findingsApi";

function statusBadge(status: string | undefined) {
  const tone = status === "In progress" ? "badge-warn" : status === "Cancelled" ? "badge-neutral" : "badge-good";
  return <span className={`badge ${tone}`}>{status || "In progress"}</span>;
}

/** IN-04 / IN-05 / IS-01..IS-04 — the core screen: stages, preview, findings, feed. */
export function InvestigationWorkspacePage({ itemId, onNavigate }: { itemId: string; onNavigate: (path: string) => void }) {
  const access = useAccess();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [selectedEvidence, setSelectedEvidence] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeMode, setCloseMode] = useState<"created" | "linked">("created");
  const [closeTitle, setCloseTitle] = useState("");
  const [linkIssueId, setLinkIssueId] = useState("");
  const [failedDraft, setFailedDraft] = useState<string | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const investigations = useQuery({
    enabled: Boolean(access.data),
    queryFn: () => listInvestigations(access.data?.workspaceId ?? ""),
    queryKey: ["investigations", access.data?.workspaceId]
  });
  const investigation = (investigations.data ?? []).find((item) => (item.itemId ?? "") === itemId);
  const events = useQuery({ enabled: Boolean(investigation), queryFn: () => listEvents(itemId), queryKey: ["inv-events", itemId] });
  const facts = useQuery({ enabled: Boolean(investigation), queryFn: () => listFacts(itemId), queryKey: ["inv-facts", itemId] });
  const hypotheses = useQuery({ enabled: Boolean(investigation), queryFn: () => listHypotheses(itemId), queryKey: ["inv-hypotheses", itemId] });
  const evidence = useQuery({ enabled: Boolean(access.data), queryFn: () => listEvidence(access.data?.workspaceId ?? ""), queryKey: ["evidence"] });
  const issueChoices = useQuery({ enabled: Boolean(access.data) && closeOpen, queryFn: () => listIssues(access.data?.workspaceId ?? ""), queryKey: ["issues", access.data?.workspaceId] });

  if (access.isLoading || investigations.isLoading) return <LoadingScreen />;
  if (!access.data || !investigation) {
    return (
      <div className="empty-state">
        <h3>Not found</h3>
        <p>You do not have access to this investigation.</p>
        <button className="secondary-button" onClick={() => onNavigate("/investigations")}>Back to investigations</button>
      </div>
    );
  }

  const accessData: Access = access.data;
  const locked = investigation.status !== "In progress";
  const mine =
    can(accessData.role, "runInvestigations") &&
    (investigation.startedById === accessData.actor.id || accessData.role === "buglens-admin");
  const linked = (evidence.data ?? []).filter((item) => item.investigationId === itemId);
  const current = linked.find((item) => (item.itemId ?? "") === selectedEvidence) ?? linked[0];

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inv-events", itemId] }),
      queryClient.invalidateQueries({ queryKey: ["inv-facts", itemId] }),
      queryClient.invalidateQueries({ queryKey: ["inv-hypotheses", itemId] }),
      queryClient.invalidateQueries({ queryKey: ["evidence"] }),
      queryClient.invalidateQueries({ queryKey: ["investigations", accessData.workspaceId] })
    ]);
  }

  const toggleStage = async (name: string, done: boolean) => {
    setError("");
    try {
      await setStage({ access: accessData, done, investigation, name });
      await invalidateAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The stage could not be updated.");
    }
  };

  const closeIssue = async (mode: "created" | "linked") => {
    setError("");
    if (mode === "created" && linked.length === 0) {
      setError("Add at least one evidence item before creating an issue.");
      return;
    }
    try {
      const evidenceIds = linked.map((item) => String(item.itemId ?? ""));
      if (mode === "created") {
        const created = await createIssue({
          access: accessData,
          environmentId: investigation.environmentId,
          evidenceIds,
          investigationId: itemId,
          projectId: investigation.projectId,
          source: "Investigation",
          summary: investigation.problem ?? "",
          title: closeTitle.trim() || investigation.title || investigation.targetUrl || "Untitled investigation"
        });
        const issueId = String(created.itemId ?? "");
        await closeInvestigationWithIssue({ access: accessData, investigation, issueId, mode: "created" });
        await invalidateAll();
        onNavigate(`/issues/${issueId}`);
      } else {
        if (!linkIssueId) {
          setError("Pick the issue to link.");
          return;
        }
        const chosen = (issueChoices.data ?? []).find((item) => (item.itemId ?? "") === linkIssueId);
        await updateIssue(accessData, linkIssueId, {
          evidenceIds: Array.from(new Set([...(chosen?.evidenceIds ?? []), ...evidenceIds])),
          investigationId: itemId
        }).catch(() => undefined);
        await closeInvestigationWithIssue({ access: accessData, investigation, issueId: linkIssueId, mode: "linked" });
        await invalidateAll();
        onNavigate(`/issues/${linkIssueId}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The investigation could not be closed.");
    }
  };

  return (
    <section className="workspace">
      <header className="workspace-head">
        <button className="link-button" onClick={() => onNavigate("/investigations")}>
          <ChevronLeft size={16} /> Investigations
        </button>
        <h2>{investigation.title ? `${investigation.title} / ` : ""}{investigation.invId}</h2>
        {statusBadge(investigation.status)}
        <div className="topbar-spacer" />
        {!locked && mine ? (
          <span className="toolbar-actions">
            <button className="primary-button" onClick={() => { setCloseTitle(investigation.title || investigation.problem || ""); setCloseOpen(true); }}>Close…</button>
            <button className="secondary-button danger" onClick={() => setCancelOpen(true)}>Cancel</button>
          </span>
        ) : null}
      </header>

      {error ? <ErrorState message={error} /> : null}

      <ResizableSplit
        first={
          <div className="panel">
            <div className="panel-title"><h3>Stages</h3></div>
            <p className="muted">Marked by hand. A done stage can go back to not started.</p>
            <div className="grid" style={{ gap: 6 }}>
              {parseStages(investigation.stages).map((stage) => (
                <label className="muted" key={stage.name} style={{ gap: 10 }}>
                  <input
                    checked={stage.done}
                    disabled={locked || !mine}
                    onChange={(event) => void toggleStage(stage.name, event.target.checked)}
                    type="checkbox"
                  />
                  <span style={{ color: stage.done ? "hsl(var(--foreground))" : undefined }}>
                    {stage.name} — {stage.done ? "done" : "not started"}
                  </span>
                </label>
              ))}
            </div>
            {!locked && mine ? <button className="secondary-button" onClick={() => setAttachOpen(true)}>Attach evidence</button> : null}
          </div>
        }
        second={
          <div className="workspace-grid">
            <div className="grid" style={{ gap: 12, minWidth: 0 }}>
              <div className="evidence-strip">
                {linked.length === 0 ? (
                  <span className="muted">No evidence yet</span>
                ) : (
                  linked.map((item) => (
                    <button
                      className={current?.itemId === item.itemId ? "chip" : "icon-button"}
                      key={item.itemId}
                      onClick={() => setSelectedEvidence(String(item.itemId ?? ""))}
                    >
                      {item.evdId} {item.type}
                    </button>
                  ))
                )}
              </div>
              <EvidencePreview item={current} />
              <EventFeed
                access={accessData}
                events={events.data ?? []}
                evidence={linked}
                locked={locked || !mine}
                onAdd={async (input) => {
                  await addEvent({
                    access: accessData,
                    action: input.action,
                    evidenceId: input.evidenceId,
                    investigationId: itemId,
                    outcome: input.outcome
                  });
                  await invalidateAll();
                }}
                onOpenEvidence={(id) => onNavigate(`/evidence/${id}`)}
                onUpdate={async (event, action) => {
                  await updateEventText({ access: accessData, action, event });
                  await invalidateAll();
                }}
              />
            </div>
            <div className="grid" style={{ minWidth: 0 }}>
              <FactsPanel
                access={accessData}
                evidence={linked}
                facts={facts.data ?? []}
                investigationId={itemId}
                onChanged={() => void invalidateAll()}
                readOnly={locked || !mine}
              />
              <HypothesesPanel
                access={accessData}
                evidence={linked}
                hypotheses={hypotheses.data ?? []}
                investigationId={itemId}
                onChanged={() => void invalidateAll()}
                readOnly={locked || !mine}
              />
            </div>
          </div>
        }
      />

      <footer className="workspace-foot">
        <span>Evidence {linked.length}</span>
        <span>Events {(events.data ?? []).length}</span>
        <span className="row-actions">
          Failed requests{" "}
          {failedDraft === undefined || locked ? (
            <button className="link-button" disabled={locked || !mine} onClick={() => setFailedDraft(String(investigation.failedRequests ?? 0))}>
              {investigation.failedRequests ?? 0}
            </button>
          ) : (
            <>
              <input
                aria-label="Failed request count"
                onChange={(event) => setFailedDraft(event.target.value)}
                style={{ width: 64 }}
                type="number"
                value={failedDraft}
              />
              <button
                className="link-button"
                onClick={async () => {
                  await updateInvestigation(accessData, itemId, { failedRequests: Number(failedDraft) || 0 });
                  setFailedDraft(undefined);
                  await invalidateAll();
                }}
              >
                Save
              </button>
              <button className="link-button" onClick={() => setFailedDraft(undefined)}>Cancel</button>
            </>
          )}
        </span>
        <span className="mono">
          Elapsed{" "}
          {investigation.status === "In progress"
            ? formatElapsed(investigation.startedAt, now)
            : formatElapsed(investigation.startedAt, new Date(String(investigation.endedAt ?? "")).getTime() || now)}
        </span>
      </footer>

      {attachOpen ? (
        <Modal onClose={() => setAttachOpen(false)} title="Attach evidence">
          <EvidenceUploader
            access={accessData}
            context={{ environmentId: investigation.environmentId, investigationId: itemId, projectId: investigation.projectId }}
            onAdded={(item) => {
              void (async () => {
                await addEvent({
                  access: accessData,
                  action: `Evidence attached: ${item.type} ${item.evdId}`,
                  automatic: true,
                  evidenceId: String(item.itemId ?? ""),
                  investigationId: itemId
                });
                await invalidateAll();
              })();
            }}
            projects={[]}
          />
          <div className="modal-actions"><button className="icon-button" onClick={() => setAttachOpen(false)}>Done</button></div>
        </Modal>
      ) : null}

      {closeOpen ? (
        <Modal onClose={() => setCloseOpen(false)} title="Close investigation">
          <p>Closing ends the investigation and keeps its {linked.length} evidence item{linked.length === 1 ? "" : "s"}. Record what came out of it.</p>
          <div className="tabs">
            <button className={`tab${closeMode === "created" ? " active" : ""}`} onClick={() => setCloseMode("created")}>Create an issue</button>
            <button className={`tab${closeMode === "linked" ? " active" : ""}`} onClick={() => setCloseMode("linked")}>Link to an existing issue</button>
          </div>
          {closeMode === "created" ? (
            <label className="form-field"><span>Issue title</span>
              <input autoFocus onChange={(event) => setCloseTitle(event.target.value)} placeholder="What the issue is about" value={closeTitle} />
            </label>
          ) : (
            <label className="form-field"><span>Existing issue</span>
              <select onChange={(event) => setLinkIssueId(event.target.value)} value={linkIssueId}>
                <option value="">Pick an open issue</option>
                {(issueChoices.data ?? []).filter((item) => isOpenStatus(item.status)).map((item) => (
                  <option key={String(item.itemId)} value={String(item.itemId ?? "")}>{item.issueKey} — {item.title}</option>
                ))}
              </select>
            </label>
          )}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="modal-actions">
            <button className="icon-button" onClick={() => setCloseOpen(false)}>Keep working</button>
            <button
              className="primary-button"
              disabled={closeMode === "linked" && !linkIssueId}
              onClick={() => void closeIssue(closeMode)}
            >
              {closeMode === "created" ? "Create issue and close" : "Link issue and close"}
            </button>
          </div>
        </Modal>
      ) : null}

      {cancelOpen ? (
        <Modal onClose={() => setCancelOpen(false)} title="Cancel investigation">
          <p>Cancelling ends the investigation. Its {linked.length} evidence item{linked.length === 1 ? "" : "s"} and its event feed are kept.</p>
          <div className="modal-actions">
            <button className="icon-button" onClick={() => setCancelOpen(false)}>Keep working</button>
            <button
              className="primary-button danger"
              onClick={async () => {
                setCancelOpen(false);
                await cancelInvestigation({ access: accessData, investigation });
                await invalidateAll();
              }}
            >
              Cancel investigation
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
