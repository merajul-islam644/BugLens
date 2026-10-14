import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { PageHeader } from "../../shared/ui/PageHeader";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { ResizableSplit } from "../../shared/ui/ResizableSplit";
import { EvidencePreview } from "./EvidencePreview";
import { EditDialog, RetireDialog } from "./EvidenceDialogs";
import { EvidenceUploader } from "./EvidenceUploader";
import { listEvidence, restoreEvidenceItem } from "./evidenceApi";
import type { EvidenceRecord } from "./evidenceApi";
import { can } from "../access/permissions";
import { useAccess } from "../access/useAccess";
import { listAllEnvironments, listProjects } from "../projects/projectsApi";
import { EVIDENCE_SOURCES, EVIDENCE_TYPES, MASKING_STATUSES } from "../../shared/domain/constants";
import { formatDateTime } from "../../shared/domain/format";
import { failureMessage } from "../../lib/blocks/records";

function MaskingBadge({ value }: { value?: string }) {
  const tone = value === "Contains sensitive values" ? "badge-danger" : value === "Checked — safe to share" ? "badge-good" : "badge-neutral";
  return <span className={`badge ${tone}`}>{value || "Not checked"}</span>;
}

export function EvidencePage({ initialEvidenceId, onNavigate }: { initialEvidenceId?: string; onNavigate: (path: string) => void }) {
  const access = useAccess();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>(initialEvidenceId ?? "");
  const [dialog, setDialog] = useState<"edit" | "retire" | "add" | undefined>();
  const [showRetired, setShowRetired] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [projectId, setProjectId] = useState("");
  const [masking, setMasking] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const items = useQuery({
    enabled: Boolean(access.data),
    queryFn: () => listEvidence(access.data?.workspaceId ?? "", { includeRetired: true }),
    queryKey: ["evidence"]
  });
  const projects = useQuery({ enabled: Boolean(access.data), queryFn: () => listProjects(access.data?.workspaceId ?? ""), queryKey: ["projects", access.data?.workspaceId] });
  const environments = useQuery({ enabled: Boolean(access.data), queryFn: () => listAllEnvironments(access.data?.workspaceId ?? ""), queryKey: ["environments-all", access.data?.workspaceId] });

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (items.data ?? [])
      .filter((item) => (showRetired ? true : item.retired !== true))
      .filter((item) => (type ? item.type === type : true))
      .filter((item) => (source ? item.source === source : true))
      .filter((item) => (projectId ? item.projectId === projectId : true))
      .filter((item) => (masking ? item.maskingStatus === masking : true))
      .filter((item) => (from ? String(item.captureTime ?? "") >= from : true))
      .filter((item) => (to ? String(item.captureTime ?? "").slice(0, 10) <= to : true))
      .filter((item) =>
        !text
          ? true
          : [item.fileName, item.notes, item.textContent, item.evdId]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(text))
      );
  }, [from, items.data, masking, projectId, search, showRetired, source, to, type]);

  if (access.isLoading || items.isLoading) return <LoadingScreen />;
  if (!access.data) return <ErrorState message="Workspace access could not be read." />;

  const current = filtered.find((item) => (item.itemId ?? "") === selected);
  const mayEdit = current
    ? current.uploaderId === access.data.actor.id || can(access.data.role, "createIssues")
    : false;
  const mayRetire = can(access.data.role, "manageWorkspace");
  const projectName = (id: string | undefined) => (projects.data ?? []).find((p) => p.itemId === id)?.name;

  return (
    <section>
      <PageHeader
        actions={can(access.data.role, "createIssues") ? (
          <button className="primary-button" onClick={() => setDialog("add")}>Add evidence</button>
        ) : undefined}
        subtitle="Everything uploaded or pasted by your team, with the metadata it came with."
        title="Evidence"
      />

      <div className="filter-grid">
        <label className="form-field"><span>Search</span><input onChange={(e) => setSearch(e.target.value)} placeholder="File name, notes or pasted text" value={search} /></label>
        <label className="form-field">
          <span>Type</span>
          <select onChange={(e) => setType(e.target.value)} value={type}>
            <option value="">All types</option>
            {EVIDENCE_TYPES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Source</span>
          <select onChange={(e) => setSource(e.target.value)} value={source}>
            <option value="">All sources</option>
            {EVIDENCE_SOURCES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Project</span>
          <select onChange={(e) => setProjectId(e.target.value)} value={projectId}>
            <option value="">All projects</option>
            {(projects.data ?? []).map((p) => <option key={p.itemId} value={p.itemId}>{p.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Masking</span>
          <select onChange={(e) => setMasking(e.target.value)} value={masking}>
            <option value="">Any masking status</option>
            {MASKING_STATUSES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="form-field"><span>Captured from</span><input onChange={(e) => setFrom(e.target.value)} type="date" value={from} /></label>
        <label className="form-field"><span>Captured to</span><input onChange={(e) => setTo(e.target.value)} type="date" value={to} /></label>
      </div>
      <label className="muted" style={{ gap: 8, marginBottom: 12 }}>
        <input checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} type="checkbox" />
        Show retired evidence
      </label>

      {items.isError ? <ErrorState message={failureMessage(items.error, "The evidence list could not be read.")} /> : null}

      <ResizableSplit
        first={
          <div className="evidence-list">
            {filtered.length === 0 ? (
              <p className="muted">Evidence will appear here — upload a screenshot or log, or paste the text you captured.</p>
            ) : (
              filtered.map((item) => (
                <button
                  className={`evidence-row ${selected === (item.itemId ?? "") ? "active" : ""}`}
                  key={item.itemId}
                  onClick={() => setSelected(String(item.itemId ?? ""))}
                >
                  <strong>{item.evdId}</strong>
                  <span>{item.fileName || `${item.type} (pasted)`}</span>
                  <span className="muted">{formatDateTime(item.captureTime)}{item.retired ? " · Retired" : ""}</span>
                </button>
              ))
            )}
          </div>
        }
        second={
          <div className="evidence-detail">
            <EvidencePreview item={current} />
            {current ? (
              <aside className="evidence-meta panel">
                <div className="panel-title"><h3>Details</h3></div>
                <dl className="meta-list">
                  <dt>Evidence ID</dt><dd>{current.evdId}</dd>
                  <dt>Capture time</dt><dd>{formatDateTime(current.captureTime)}</dd>
                  <dt>Type</dt><dd>{current.type}</dd>
                  <dt>Source</dt><dd>{current.source}</dd>
                  <dt>Project</dt><dd>{projectName(current.projectId) || "Not linked"}</dd>
                  <dt>Environment</dt><dd>{current.environmentId ? (environments.data ?? []).find((e) => e.itemId === current.environmentId)?.name || "Recorded" : "Not linked"}</dd>
                  <dt>File</dt><dd>{current.fileName ? `${current.fileName} (${current.mimeType || "type unknown"})` : "Pasted text"}</dd>
                  <dt>Size</dt><dd>{typeof current.fileSize === "number" ? `${Math.round(current.fileSize / 1024)} KB` : "—"}</dd>
                  <dt>Retire by</dt><dd>{formatDateTime(current.retireBy)}</dd>
                  <dt>Masking</dt><dd><MaskingBadge value={current.maskingStatus} /></dd>
                  <dt>Uploaded by</dt><dd>{current.uploaderName || "—"}</dd>
                  <dt>Investigation</dt><dd>{current.investigationId ? <LinkButton label="Open investigation" onClick={() => onNavigate(`/investigations/${current.investigationId}`)} /> : "—"}</dd>
                  <dt>Issue</dt><dd>{current.issueId ? <LinkButton label="Open issue" onClick={() => onNavigate(`/issues/${current.issueId}`)} /> : "—"}</dd>
                  <dt>Notes</dt><dd>{current.notes || "No notes."}</dd>
                </dl>
                {current.retired ? (
                  <div className="form-actions">
                    <span className="badge badge-danger">Retired{current.retireReason ? `: ${current.retireReason}` : ""}</span>
                    {mayRetire ? <button className="secondary-button" onClick={() => void restoreEvidenceItem({ access: access.data!, item: current }).then(() => queryClient.invalidateQueries({ queryKey: ["evidence"] }))}>Restore</button> : null}
                  </div>
                ) : null}
                <div className="form-actions">
                  {mayEdit && !current.retired ? <button className="secondary-button" onClick={() => setDialog("edit")}>Edit details</button> : null}
                  {mayRetire && !current.retired ? <button className="secondary-button danger" onClick={() => setDialog("retire")}>Retire now</button> : null}
                </div>
              </aside>
            ) : null}
          </div>
        }
      />

      {current && dialog === "edit" ? <EditDialog access={access.data} item={current} onClose={() => setDialog(undefined)} /> : null}
      {current && dialog === "retire" ? <RetireDialog access={access.data} item={current} onClose={() => setDialog(undefined)} /> : null}
      {dialog === "add" ? (
        <AddEvidenceDialog access={access.data} onClose={() => setDialog(undefined)} projects={(projects.data ?? []).map((p) => ({ id: String(p.itemId), name: String(p.name) }))} />
      ) : null}
    </section>
  );
}

function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="link-button" onClick={onClick}><Link2 size={14} /> {label}</button>;
}

function AddEvidenceDialog({ access, onClose, projects }: { access: NonNullable<ReturnType<typeof useAccess>["data"]>; onClose: () => void; projects: { id: string; name: string }[] }) {
  const queryClient = useQueryClient();
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div aria-modal="true" className="modal" role="dialog" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Add evidence</h3></div>
        <EvidenceUploader
          access={access}
          context={{}}
          onAdded={() => void queryClient.invalidateQueries({ queryKey: ["evidence"] })}
          projects={projects}
        />
        <div className="modal-actions"><button className="icon-button" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
