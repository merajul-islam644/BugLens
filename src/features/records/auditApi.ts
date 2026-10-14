import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";
import { isoNow } from "../../shared/domain/format";

export type AuditRecord = {
  itemId?: string;
  workspaceId?: string;
  time?: string;
  actorId?: string;
  actorName?: string;
  action?: string;
  recordType?: string;
  recordId?: string;
  recordLabel?: string;
  oldValue?: string;
  newValue?: string;
};

export type Actor = { id: string; name: string };

const audits = blocksClient.data.collection<AuditRecord>("AuditEntry", {
  fields: ["workspaceId", "time", "actorId", "actorName", "action", "recordType", "recordId", "recordLabel", "oldValue", "newValue"]
});

export async function writeAudit(
  workspaceId: string,
  actor: Actor,
  entry: { action: string; newValue?: string; oldValue?: string; recordId: string; recordLabel: string; recordType: string }
): Promise<void> {
  assertGraphqlOk(
    await audits.create({ ...entry, actorId: actor.id, actorName: actor.name, time: isoNow(), workspaceId }),
    "The audit entry could not be recorded."
  );
}

export async function listAudit(workspaceId: string): Promise<AuditRecord[]> {
  const response = await audits.list({ pageNo: 1, pageSize: 500 });
  return withIds(unwrapItems<AuditRecord>(response, "AuditEntries").items)
    .filter((entry) => !entry.workspaceId || entry.workspaceId === workspaceId)
    .sort((a, b) => String(b.time ?? "").localeCompare(String(a.time ?? "")));
}
