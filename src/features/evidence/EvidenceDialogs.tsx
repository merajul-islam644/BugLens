import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../shared/ui/PageHeader";
import { DataTable } from "../../shared/ui/DataTable";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { Modal } from "../../shared/ui/Modal";
import { Alert } from "../../shared/ui/Alert";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ResizableSplit } from "../../shared/ui/ResizableSplit";
import { can } from "../access/permissions";
import { useAccess } from "../access/useAccess";
import { listAllEnvironments, listProjects } from "../projects/projectsApi";
import { EVIDENCE_SOURCES, EVIDENCE_TYPES, MASKING_STATUSES } from "../../shared/domain/constants";
import { formatBytes, formatDateTime } from "../../shared/domain/format";
import { failureMessage } from "../../lib/blocks/records";
import { EvidencePreview } from "./EvidencePreview";
import { EvidenceUploader } from "./EvidenceUploader";
import { assertNoCredential } from "./masking";
import { deleteEvidenceItem, listEvidence, updateEvidence } from "./evidenceApi";
import type { EvidenceRecord } from "./evidenceApi";

export function EditDialog({ access, item, onClose }: { access: NonNullable<ReturnType<typeof useAccess>["data"]>; item: EvidenceRecord; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [masking, setMasking] = useState(String(item.maskingStatus ?? "Not checked"));
  const [notes, setNotes] = useState(String(item.notes ?? ""));
  const [capture, setCapture] = useState(String(item.captureTime ?? ""));
  const [error, setError] = useState("");

  async function save() {
    setError("");
    try {
      assertNoCredential(notes);
      await updateEvidence({ access, input: { captureTime: capture || undefined, maskingStatus: masking, notes }, item });
      await queryClient.invalidateQueries({ queryKey: ["evidence"] });
      onClose();
    } catch (caught) {
      setError(failureMessage(caught, "The evidence details could not be saved."));
    }
  }

  return (
    <Modal onClose={onClose} title={`Edit ${item.evdId ?? "evidence"}`}>
      <label className="form-field">
        <span>Capture time</span>
        <input onChange={(event) => setCapture(event.target.value)} type="datetime-local" value={capture ? capture.slice(0, 16) : ""} />
      </label>
      <label className="form-field">
        <span>Masking status</span>
        <select onChange={(event) => setMasking(event.target.value)} value={masking}>
          {MASKING_STATUSES.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="form-field">
        <span>Notes</span>
        <textarea onChange={(event) => setNotes(event.target.value)} value={notes} />
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="modal-actions">
        <button className="icon-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" onClick={() => void save()}>Save</button>
      </div>
    </Modal>
  );
}

export function RetireDialog({ access, item, onClose }: { access: NonNullable<ReturnType<typeof useAccess>["data"]>; item: EvidenceRecord; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function retire() {
    setError("");
    try {
      await deleteEvidenceItem({ access, item, reason: reason.trim() || "Retired by admin" });
      await queryClient.invalidateQueries({ queryKey: ["evidence"] });
      onClose();
    } catch (caught) {
      setError(failureMessage(caught, "The evidence could not be retired."));
    }
  }

  return (
    <Modal onClose={onClose} title={`Retire ${item.evdId ?? "evidence"}`}>
      <p>Moving it to trash keeps its metadata, and it can be restored for 30 days. The reason is recorded in the audit log.</p>
      <label className="form-field">
        <span>Reason</span>
        <input autoFocus onChange={(event) => setReason(event.target.value)} placeholder="Why is this retired now?" />
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="modal-actions">
        <button className="icon-button" onClick={onClose}>Cancel</button>
        <button className="primary-button danger" onClick={() => void retire()}>Retire</button>
      </div>
    </Modal>
  );
}
