import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Alert } from "../../shared/ui/Alert";
import { EVIDENCE_TYPES, MAX_BATCH_FILES, MAX_FILE_BYTES } from "../../shared/domain/constants";
import { formatBytes, formatDateTime } from "../../shared/domain/format";
import { failureMessage } from "../../lib/blocks/records";
import { credentialRefusal, findCredential } from "./masking";
import { pasteEvidence, uploadEvidenceFile } from "./evidenceApi";
import type { EvidenceRecord } from "./evidenceApi";
import type { Access } from "../access/useAccess";

type QueueItem = {
  error?: string;
  file: File;
  id: string;
  progress: number;
  status: "adding" | "done" | "error" | "queued";
};

export type EvidenceContext = {
  environmentId?: string;
  investigationId?: string;
  issueId?: string;
  projectId?: string;
};

/**
 * EV-01 — the batch uploader: per-file progress with a Remove action, oversized
 * files refused while the rest of the batch continues. Also the paste path (EV-02).
 */
export function EvidenceUploader({
  access,
  context,
  onAdded,
  projects
}: {
  access: Access;
  context: EvidenceContext;
  onAdded: (item: EvidenceRecord) => void;
  projects: { id: string; name: string }[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [type, setType] = useState<string>("Screenshot");
  const [source, setSource] = useState<string>("Upload");
  const [error, setError] = useState("");

  const [pasteText, setPasteText] = useState("");
  const [pasteType, setPasteType] = useState<string>("Console log");
  const [pasteSensitive, setPasteSensitive] = useState(false);
  const [pasteError, setPasteError] = useState("");

  function patch(id: string, next: Partial<QueueItem>) {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }

  async function addFiles(files: File[]) {
    setError("");
    const room = MAX_BATCH_FILES - queue.filter((item) => item.status !== "done").length;
    if (room <= 0) {
      setError(`A batch holds up to ${MAX_BATCH_FILES} files.`);
      return;
    }
    for (const file of files.slice(0, room)) {
      const id = `${file.name}-${Math.random().toString(36).slice(2, 8)}`;
      if (file.size > MAX_FILE_BYTES) {
        setQueue((items) => [...items, { error: "This file is larger than 50 MB.", file, id, progress: 0, status: "error" }]);
        continue;
      }
      setQueue((items) => [...items, { file, id, progress: 0, status: "adding" }]);
      try {
        const item = await uploadEvidenceFile({
          access,
          environmentId: context.environmentId,
          file,
          investigationId: context.investigationId,
          issueId: context.issueId,
          onProgress: (fraction) => patch(id, { progress: fraction }),
          projectId: context.projectId,
          source,
          type
        });
        patch(id, { progress: 1, status: "done" });
        onAdded(item);
      } catch (caught) {
        patch(id, { error: failureMessage(caught, "The file could not be uploaded."), progress: 0, status: "error" });
      }
    }
  }

  async function paste() {
    setPasteError("");
    const hit = findCredential(pasteText);
    if (hit && !pasteSensitive) {
      setPasteError(credentialRefusal(hit));
      return;
    }
    try {
      const item = await pasteEvidence({
        access,
        environmentId: context.environmentId,
        investigationId: context.investigationId,
        issueId: context.issueId,
        projectId: context.projectId,
        sensitiveAck: pasteSensitive,
        text: pasteText,
        type: pasteType
      });
      setPasteText("");
      onAdded(item);
    } catch (caught) {
      setPasteError(failureMessage(caught, "The pasted text could not be saved."));
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="filter-grid">
        <label className="form-field">
          <span>Type</span>
          <select onChange={(event) => setType(event.target.value)} value={type}>
            {EVIDENCE_TYPES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Source</span>
          <select onChange={(event) => setSource(event.target.value)} value={source}>
            <option>Upload</option>
            <option>Automated test</option>
          </select>
        </label>
      </div>
      <div>
        <input
          accept="*/*"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) void addFiles(files);
            event.target.value = "";
          }}
          ref={inputRef}
          style={{ display: "none" }}
          type="file"
        />
        <button className="secondary-button" onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> Choose files
        </button>{" "}
        <span className="muted">Up to {MAX_BATCH_FILES} per batch, 50 MB each. Screenshots, recordings, traces, logs, request and response files.</span>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {queue.map((item) => (
        <div className="queue-row" key={item.id}>
          <div className="queue-info">
            <strong>{item.file.name}</strong>
            <span className="muted">
              {item.file.type || "unknown type"} · {formatBytes(item.file.size)}
            </span>
            {item.status === "adding" ? (
              <span className="progress-track"><span className="progress-bar" style={{ width: `${Math.round(item.progress * 100)}%` }} /></span>
            ) : null}
            {item.status === "done" ? <span className="badge badge-good">Attached</span> : null}
            {item.error ? <span className="badge badge-danger">{item.error}</span> : null}
          </div>
          <button className="icon-button" onClick={() => setQueue((items) => items.filter((row) => row.id !== item.id))} aria-label={`Remove ${item.file.name}`}>
            <X size={16} />
          </button>
        </div>
      ))}

      <div className="panel">
        <div className="panel-title"><h3>Paste text</h3></div>
        <label className="form-field">
          <span>Type</span>
          <select onChange={(event) => setPasteType(event.target.value)} value={pasteType}>
            {EVIDENCE_TYPES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Text</span>
          <textarea className="mono" onChange={(event) => setPasteText(event.target.value)} placeholder="Paste the console log, request or stack trace here." value={pasteText} />
        </label>
        <label className="muted" style={{ gap: 8 }}>
          <input checked={pasteSensitive} onChange={(event) => setPasteSensitive(event.target.checked)} type="checkbox" />
          This text contains sensitive values (mark it as such instead of removing them)
        </label>
        {pasteError ? <Alert tone="error">{pasteError}</Alert> : null}
        <div className="form-actions">
          <button className="primary-button" disabled={!pasteText.trim()} onClick={() => void paste()}>Save pasted text</button>
        </div>
      </div>
    </div>
  );
}
