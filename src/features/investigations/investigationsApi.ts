import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";
import { refusal } from "../access/permissions";
import { INVESTIGATION_STAGES } from "../../shared/domain/constants";
import { isoNow } from "../../shared/domain/format";
import { nextId } from "../records/counterApi";
import type { Access } from "../access/useAccess";
import { evidence } from "../evidence/evidenceApi";

export type InvestigationRecord = {
  itemId?: string;
  workspaceId?: string;
  invId?: string;
  title?: string;
  targetUrl?: string;
  projectId?: string;
  environmentId?: string;
  problem?: string;
  checks?: string[];
  stages?: string;
  status?: string;
  startedById?: string;
  startedByName?: string;
  startedAt?: string;
  endedAt?: string;
  failedRequests?: number;
  resultingIssueId?: string;
};

export type InvestigationEventRecord = {
  itemId?: string;
  workspaceId?: string;
  investigationId?: string;
  time?: string;
  authorId?: string;
  authorName?: string;
  action?: string;
  outcome?: string;
  evidenceId?: string;
  automatic?: boolean;
};

export type Stage = { done: boolean; name: string };

export function parseStages(raw: string | undefined): Stage[] {
  if (!raw) return INVESTIGATION_STAGES.map((name) => ({ done: false, name }));
  try {
    const parsed = JSON.parse(raw) as Stage[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through to defaults */
  }
  return INVESTIGATION_STAGES.map((name) => ({ done: false, name }));
}

const investigations = blocksClient.data.collection<InvestigationRecord>("Investigation", {
  fields: ["workspaceId", "invId", "title", "targetUrl", "projectId", "environmentId", "problem", "checks", "stages", "status", "startedById", "startedByName", "startedAt", "endedAt", "failedRequests", "resultingIssueId"]
});

const events = blocksClient.data.collection<InvestigationEventRecord>("InvestigationEvent", {
  fields: ["workspaceId", "investigationId", "time", "authorId", "authorName", "action", "outcome", "evidenceId", "automatic"]
});

export async function listInvestigations(workspaceId: string): Promise<InvestigationRecord[]> {
  const response = await investigations.list({ pageNo: 1, pageSize: 500 });
  return withIds(unwrapItems<InvestigationRecord>(response, "Investigations").items)
    .filter((item) => item.workspaceId === workspaceId)
    .sort((a, b) => String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")));
}

export async function getInvestigation(itemId: string, workspaceId: string): Promise<InvestigationRecord | undefined> {
  const all = await listInvestigations(workspaceId);
  return all.find((item) => (item.itemId ?? "") === itemId);
}

export async function addEvent(input: {
  access: Access;
  action: string;
  automatic?: boolean;
  evidenceId?: string;
  investigationId: string;
  outcome?: string;
}): Promise<void> {
  assertGraphqlOk(
    await events.create({
      workspaceId: input.access.workspaceId,
      investigationId: input.investigationId,
      time: isoNow(),
      authorId: input.access.actor.id,
      authorName: input.access.actor.name,
      action: input.action,
      outcome: input.outcome ?? "",
      evidenceId: input.evidenceId ?? "",
      automatic: input.automatic === true
    }),
    "The event could not be recorded."
  );
}

export async function listEvents(investigationId: string): Promise<InvestigationEventRecord[]> {
  const response = await events.list({ pageNo: 1, pageSize: 500 });
  return withIds(unwrapItems<InvestigationEventRecord>(response, "InvestigationEvents").items)
    .filter((event) => event.investigationId === investigationId)
    .sort((a, b) => String(a.time ?? "").localeCompare(String(b.time ?? "")));
}

export async function updateEventText(input: { access: Access; event: InvestigationEventRecord; action: string }): Promise<void> {
  const mine = input.event.authorId === input.access.actor.id;
  if (!mine && input.access.role !== "buglens-admin") throw new Error("Only the author can change their own event line.");
  if (input.event.automatic === true) throw new Error("Automatic lines are kept as recorded.");
  assertGraphqlOk(await events.update(String(input.event.itemId ?? ""), { action: input.action }), "The event could not be updated.");
}

export async function createInvestigation(input: {
  access: Access;
  checks: string[];
  environmentId?: string;
  evidenceItemIds?: string[];
  problem?: string;
  projectId?: string;
  title?: string;
  url: string;
}): Promise<InvestigationRecord> {
  const denied = refusal(input.access.role, "runInvestigations");
  if (denied) throw denied;

  const invId = await nextId(input.access.workspaceId, "INV");
  const startedAt = isoNow();
  assertGraphqlOk(
    await investigations.create({
      workspaceId: input.access.workspaceId,
      invId,
      title: input.title ?? "",
      targetUrl: input.url,
      projectId: input.projectId ?? "",
      environmentId: input.environmentId ?? "",
      problem: input.problem ?? "",
      checks: input.checks,
      stages: JSON.stringify(INVESTIGATION_STAGES.map((name) => ({ done: false, name }))),
      status: "In progress",
      startedById: input.access.actor.id,
      startedByName: input.access.actor.name,
      startedAt,
      failedRequests: 0,
      resultingIssueId: ""
    }),
    "The investigation could not be started."
  );

  const created = (await listInvestigations(input.access.workspaceId)).find((item) => item.invId === invId);
  if (!created) throw new Error("The investigation could not be started.");

  for (const itemId of input.evidenceItemIds ?? []) {
    await evidence.update(itemId, { investigationId: created.itemId ?? "" }).catch(() => undefined);
  }

  await addEvent({
    access: input.access,
    action: `Investigation started on ${new URL(input.url).host}`,
    automatic: true,
    investigationId: String(created.itemId ?? "")
  });

  return created;
}

/** IN-05 — cancelling ends it and keeps the evidence; events lock after that. */
export async function cancelInvestigation(input: { access: Access; investigation: InvestigationRecord }): Promise<void> {
  await updateInvestigation(input.access, String(input.investigation.itemId ?? ""), {
    endedAt: isoNow(),
    status: "Cancelled"
  });
  await addEvent({
    access: input.access,
    action: "Investigation cancelled",
    automatic: true,
    investigationId: String(input.investigation.itemId ?? ""),
    outcome: "Evidence kept"
  });
}

export async function updateInvestigation(access: Access, itemId: string, input: Partial<InvestigationRecord>): Promise<void> {
  const denied = refusal(access.role, "runInvestigations");
  if (denied) throw denied;
  assertGraphqlOk(await investigations.update(itemId, input), "The investigation could not be updated.");
}

export async function setStage(input: {
  access: Access;
  done: boolean;
  investigation: InvestigationRecord;
  name: string;
}): Promise<void> {
  const stages = parseStages(input.investigation.stages).map((stage) =>
    stage.name === input.name ? { ...stage, done: input.done } : stage
  );
  await updateInvestigation(input.access, String(input.investigation.itemId ?? ""), { stages: JSON.stringify(stages) });
  await addEvent({
    access: input.access,
    action: `Stage "${input.name}" marked ${input.done ? "done" : "not started"}`,
    automatic: true,
    investigationId: String(input.investigation.itemId ?? "")
  });
}


/** IN-06 — closing an investigation produces or links an issue; the evidence stays linked. */
export async function closeInvestigationWithIssue(input: {
  access: Access;
  issueId: string;
  investigation: InvestigationRecord;
  mode: "created" | "linked";
}): Promise<void> {
  const investigationId = String(input.investigation.itemId ?? "");
  await updateInvestigation(input.access, investigationId, {
    endedAt: isoNow(),
    resultingIssueId: input.issueId,
    status: input.mode === "created" ? "Closed — issue created" : "Linked to issue"
  });
  await addEvent({
    access: input.access,
    action: input.mode === "created" ? "Investigation closed — issue created" : "Investigation linked to an existing issue",
    automatic: true,
    investigationId
  });
  const linked = withIds(unwrapItems<{ investigationId?: string }>(await evidence.list({ pageNo: 1, pageSize: 500 }), "EvidenceItems").items)
    .filter((item) => item.investigationId === investigationId);
  for (const item of linked) {
    await evidence.update(String(item.itemId ?? ""), { issueId: input.issueId }).catch(() => undefined);
  }
}
