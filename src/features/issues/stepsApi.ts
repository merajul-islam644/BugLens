import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";
import { refusal } from "../access/permissions";
import type { Access } from "../access/useAccess";

export type ReproductionStepRecord = {
  itemId?: string;
  workspaceId?: string;
  issueId?: string;
  stepOrder?: number;
  text?: string;
  evidenceIds?: string[];
  ranBy?: string;
  ranAt?: string;
  seen?: string;
};

const steps = blocksClient.data.collection<ReproductionStepRecord>("ReproductionStep", {
  fields: ["workspaceId", "issueId", "stepOrder", "text", "evidenceIds", "ranBy", "ranAt", "seen"]
});

export async function listSteps(issueId: string): Promise<ReproductionStepRecord[]> {
  const response = await steps.list({ pageNo: 1, pageSize: 200 });
  return withIds(unwrapItems<ReproductionStepRecord>(response, "ReproductionSteps").items)
    .filter((item) => item.issueId === issueId)
    .sort((a, b) => Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0));
}

export async function addStep(input: {
  access: Access;
  evidenceIds?: string[];
  issueId: string;
  seen?: string;
  text: string;
}): Promise<void> {
  const denied = refusal(input.access.role, "contribute");
  if (denied) throw denied;
  const existing = await listSteps(input.issueId);
  assertGraphqlOk(await steps.create({
    evidenceIds: input.evidenceIds ?? [],
    issueId: input.issueId,
    ranAt: input.seen ? new Date().toISOString() : "",
    ranBy: input.seen ? input.access.actor.name : "",
    seen: input.seen ?? "",
    stepOrder: existing.reduce((max, step) => Math.max(max, Number(step.stepOrder ?? 0)), 0) + 1,
    text: input.text.trim(),
    workspaceId: input.access.workspaceId
  }), "The step could not be added.");
}

export async function updateStep(access: Access, itemId: string, input: Partial<ReproductionStepRecord>): Promise<void> {
  const denied = refusal(access.role, "contribute");
  if (denied) throw denied;
  assertGraphqlOk(await steps.update(itemId, input), "The step could not be updated.");
}

export async function removeStep(access: Access, itemId: string): Promise<void> {
  const denied = refusal(access.role, "contribute");
  if (denied) throw denied;
  assertGraphqlOk(await steps.delete(itemId), "The step could not be removed.");
}
