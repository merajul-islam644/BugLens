import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, recordId, unwrapItems, withIds } from "../../lib/blocks/records";
import { refusal } from "../access/permissions";
import { nextId } from "../records/counterApi";
import { writeAudit } from "../records/auditApi";
import type { Actor } from "../records/auditApi";
import { MAX_FILE_BYTES, MAX_BATCH_FILES } from "../../shared/domain/constants";
import { isoNow } from "../../shared/domain/format";
import type { Access } from "../access/useAccess";

export type EvidenceRecord = {
  itemId?: string;
  workspaceId?: string;
  evdId?: string;
  captureTime?: string;
  projectId?: string;
  environmentId?: string;
  type?: string;
  source?: string;
  fileName?: string;
  fileId?: string;
  textContent?: string;
  fileSize?: number;
  mimeType?: string;
  notes?: string;
  maskingStatus?: string;
  retireBy?: string;
  uploaderId?: string;
  uploaderName?: string;
  investigationId?: string;
  issueId?: string;
  retired?: boolean;
  retireReason?: string;
  retiredAt?: string;
};

const STORAGE_CONFIGURATION = "Default";

export const evidence = blocksClient.data.collection<EvidenceRecord>("EvidenceItem", {
  fields: [
    "workspaceId", "evdId", "captureTime", "projectId", "environmentId", "type", "source",
    "fileName", "fileId", "textContent", "fileSize", "mimeType", "notes", "maskingStatus",
    "retireBy", "uploaderId", "uploaderName", "investigationId", "issueId", "retired", "retireReason", "retiredAt"
  ]
});

function retireByDate(months: number | undefined): string {
  const date = new Date();
  date.setMonth(date.getMonth() + (months ?? 12));
  return date.toISOString();
}

export async function listEvidence(workspaceId: string, options?: { includeRetired?: boolean }): Promise<EvidenceRecord[]> {
  const response = await evidence.list({ pageNo: 1, pageSize: 500 });
  return withIds(unwrapItems<EvidenceRecord>(response, "EvidenceItems").items)
    .filter((item) => item.workspaceId === workspaceId)
    .filter((item) => options?.includeRetired ? true : item.retired !== true)
    .sort((a, b) => String(b.captureTime ?? "").localeCompare(String(a.captureTime ?? "")));
}

export async function getEvidence(itemId: string): Promise<EvidenceRecord | undefined> {
  const response = await evidence.get(itemId);
  const items = unwrapItems<EvidenceRecord>(response, "EvidenceItems").items;
  return items[0] ? withIds(items)[0] : undefined;
}

type NewEvidence = Partial<EvidenceRecord> & { projectId?: string; environmentId?: string };

async function createRecord(access: Access, input: NewEvidence): Promise<EvidenceRecord> {
  const denied = refusal(access.role, "createIssues");
  if (denied) throw denied;

  const evdId = await nextId(access.workspaceId, "EVD");
  const payload: EvidenceRecord = {
    workspaceId: access.workspaceId,
    evdId,
    captureTime: isoNow(),
    maskingStatus: "Not checked",
    retireBy: retireByDate(access.workspace.retentionMonths),
    uploaderId: access.actor.id,
    uploaderName: access.actor.name,
    ...input
  };
  assertGraphqlOk(await evidence.create(payload), "The evidence could not be recorded.");
  const created = (await listEvidence(access.workspaceId, { includeRetired: true })).find((item) => item.evdId === evdId);
  return created ?? { ...payload, itemId: "" };
}

/** Pasted text becomes Evidence with Source = Pasted by hand, Masking = Not checked. */
export async function pasteEvidence(input: {
  access: Access;
  environmentId?: string;
  investigationId?: string;
  issueId?: string;
  notes?: string;
  projectId?: string;
  sensitiveAck?: boolean;
  text: string;
  type: string;
}): Promise<EvidenceRecord> {
  return createRecord(input.access, {
    environmentId: input.environmentId,
    investigationId: input.investigationId,
    issueId: input.issueId,
    maskingStatus: input.sensitiveAck ? "Contains sensitive values" : "Not checked",
    mimeType: "text/plain",
    notes: input.notes,
    projectId: input.projectId,
    source: "Pasted by hand",
    textContent: input.text,
    type: input.type
  });
}

/**
 * EV-01 — the bytes go to storage through a pre-signed URL, tracked per file.
 * The PUT uses XHR because the SDK's helper cannot report upload progress.
 */
export async function uploadEvidenceFile(input: {
  access: Access;
  environmentId?: string;
  file: File;
  investigationId?: string;
  issueId?: string;
  notes?: string;
  onProgress?: (fraction: number) => void;
  projectId?: string;
  source?: string;
  type: string;
}): Promise<EvidenceRecord> {
  const denied = refusal(input.access.role, "createIssues");
  if (denied) throw denied;
  if (input.file.size > MAX_FILE_BYTES) throw new Error("This file is larger than 50 MB.");

  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${input.file.name}`;
  const presign = (await blocksClient.data.files.presignedUploadUrl({
    configurationName: STORAGE_CONFIGURATION,
    contentType: input.file.type || "application/octet-stream",
    accessModifier: "Private",
    moduleName: 8,
    name: uniqueName
  })) as Record<string, unknown> | undefined;

  const uploadUrl = typeof presign?.uploadUrl === "string" ? presign.uploadUrl : undefined;
  const fileId = String(presign?.fileId ?? "");
  if (!presign || presign.isSuccess === false || !uploadUrl || !fileId) {
    throw new Error("The upload could not be prepared. Try again.");
  }
  if (presign.uploadCompletionRequired === true) {
    throw new Error("This storage setup requires an extra completion step BugLens cannot perform from the browser.");
  }

  const headers = (presign.requiredHeaders ?? {}) as Record<string, string>;
  await putWithProgress(uploadUrl, input.file, input.file.type || "application/octet-stream", headers, input.onProgress);

  return createRecord(input.access, {
    environmentId: input.environmentId,
    fileId,
    fileName: input.file.name,
    fileSize: input.file.size,
    investigationId: input.investigationId,
    issueId: input.issueId,
    mimeType: input.file.type || "application/octet-stream",
    notes: input.notes,
    projectId: input.projectId,
    source: input.source ?? "Upload",
    type: input.type
  });
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    for (const [key, value] of Object.entries(headers)) request.setRequestHeader(key, String(value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(1, event.loaded / event.total));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("The file could not be uploaded. Try again."));
    };
    request.onerror = () => reject(new Error("The file could not be uploaded. Try again."));
    request.send(file);
  });
}

export type DownloadTarget = { url: string; name: string };

export async function downloadTarget(item: EvidenceRecord): Promise<DownloadTarget> {
  if (!item.fileId) {
    const blob = new Blob([item.textContent ?? ""], { type: item.mimeType || "text/plain" });
    return { name: item.evdId ? `${item.evdId}.txt` : "evidence.txt", url: URL.createObjectURL(blob) };
  }
  const response = (await blocksClient.data.files.get(item.fileId, { configurationName: STORAGE_CONFIGURATION })) as Record<string, unknown> | undefined;
  const data = (response?.data ?? response) as Record<string, unknown> | undefined;
  for (const key of ["downloadUrl", "url", "fileUrl", "presignedUrl"]) {
    const value = data?.[key] ?? response?.[key];
    if (typeof value === "string" && value.startsWith("http")) return { name: item.fileName ?? item.evdId ?? "evidence", url: String(value) };
  }
  throw new Error("This file has no readable download address yet.");
}

/** EV-04 — metadata changes: uploader, QA Engineer or Admin only. */
export async function updateEvidence(input: {
  access: Access;
  input: Partial<EvidenceRecord>;
  item: EvidenceRecord;
}): Promise<void> {
  const isUploader = Boolean(input.item.uploaderId) && input.item.uploaderId === input.access.actor.id;
  const mayEdit = isUploader || input.access.role === "buglens-admin" || input.access.role === "buglens-qa";
  if (!mayEdit) throw new Error("Only the person who added this evidence, a QA engineer or an admin can change it.");
  assertGraphqlOk(await evidence.update(String(input.item.itemId ?? ""), input.input), "The evidence details could not be saved.");
}

/** EV-05 — Admin retires a file now: it moves to trash, metadata kept, restorable. */
export async function deleteEvidenceItem(input: { access: Access; item: EvidenceRecord; reason: string }): Promise<void> {
  const denied = refusal(input.access.role, "manageWorkspace");
  if (denied) throw new Error("Only an admin can delete evidence.");
  assertGraphqlOk(
    await evidence.update(String(input.item.itemId ?? ""), { retired: true, retireReason: input.reason, retiredAt: isoNow() }),
    "The evidence could not be retired."
  );
  if (input.item.fileId) {
    await blocksClient.data.files.delete({ configurationName: STORAGE_CONFIGURATION, fileId: input.item.fileId, permanent: false }).catch(() => undefined);
  }
  await writeAudit(input.access.workspaceId, input.access.actor, {
    action: "Evidence retired",
    newValue: input.reason,
    recordId: String(input.item.itemId ?? ""),
    recordLabel: input.item.evdId ?? "Evidence",
    recordType: "Evidence"
  });
}

export async function restoreEvidenceItem(input: { access: Access; item: EvidenceRecord }): Promise<void> {
  const denied = refusal(input.access.role, "manageWorkspace");
  if (denied) throw new Error("Only an admin can restore retired evidence.");
  assertGraphqlOk(await evidence.update(String(input.item.itemId ?? ""), { retired: false, retireReason: "", retiredAt: "" }), "The evidence could not be restored.");
}

void recordId;
void MAX_BATCH_FILES;
