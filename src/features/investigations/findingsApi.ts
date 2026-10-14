import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";
import { isoNow } from "../../shared/domain/format";
import { assertNoCredential } from "../evidence/masking";
import type { Access } from "../access/useAccess";

export type ObservedFactRecord = {
  itemId?: string;
  workspaceId?: string;
  investigationId?: string;
  issueId?: string;
  text?: string;
  evidenceIds?: string[];
  authorId?: string;
  authorName?: string;
  time?: string;
};

export type HypothesisRecord = {
  itemId?: string;
  workspaceId?: string;
  investigationId?: string;
  issueId?: string;
  text?: string;
  evidenceIds?: string[];
  missingEvidence?: string;
  nextStep?: string;
  confidence?: string;
  authorId?: string;
  authorName?: string;
  time?: string;
};

const facts = blocksClient.data.collection<ObservedFactRecord>("ObservedFact", {
  fields: ["workspaceId", "investigationId", "issueId", "text", "evidenceIds", "authorId", "authorName", "time"]
});

const hypotheses = blocksClient.data.collection<HypothesisRecord>("HypothesisItem", {
  fields: ["workspaceId", "investigationId", "issueId", "text", "evidenceIds", "missingEvidence", "nextStep", "confidence", "authorId", "authorName", "time"]
});

function sameOwner(access: Access, record: { authorId?: string }): boolean {
  return access.role === "buglens-admin" || access.role === "buglens-qa" || record.authorId === access.actor.id;
}

function canWrite(access: Access): void {
  if (access.role === "buglens-viewer") throw new Error("Viewers can read findings but not change them.");
}

export async function listFacts(investigationId: string): Promise<ObservedFactRecord[]> {
  const response = await facts.list({ pageNo: 1, pageSize: 300 });
  return withIds(unwrapItems<ObservedFactRecord>(response, "ObservedFacts").items).filter((fact) => fact.investigationId === investigationId);
}

export async function listHypotheses(investigationId: string): Promise<HypothesisRecord[]> {
  const response = await hypotheses.list({ pageNo: 1, pageSize: 300 });
  return withIds(unwrapItems<HypothesisRecord>(response, "HypothesisItems").items).filter((item) => item.investigationId === investigationId);
}

/** FS-01 — a Critical issue needs at least one observed fact tied to it. */
export async function listIssueFacts(issueId: string): Promise<ObservedFactRecord[]> {
  const response = await facts.list({ pageNo: 1, pageSize: 300 });
  return withIds(unwrapItems<ObservedFactRecord>(response, "ObservedFacts").items).filter((fact) => fact.issueId === issueId);
}

/** IS-02 — a fact cannot exist without at least one linked Evidence item. */
export async function saveFact(input: {
  access: Access;
  evidenceIds: string[];
  existing?: ObservedFactRecord;
  investigationId: string;
  issueId?: string;
  text: string;
}): Promise<void> {
  canWrite(input.access);
  assertNoCredential(input.text);
  if (input.evidenceIds.length === 0) {
    throw new Error("Link the evidence this fact comes from.");
  }
  if (input.existing && !sameOwner(input.access, input.existing)) throw new Error("Only its author, a QA engineer or an admin can change this fact.");

  const payload = {
    evidenceIds: input.evidenceIds,
    investigationId: input.investigationId,
    issueId: input.issueId ?? input.existing?.issueId ?? "",
    text: input.text,
    ...(!input.existing
      ? { authorId: input.access.actor.id, authorName: input.access.actor.name, time: isoNow(), workspaceId: input.access.workspaceId }
      : {})
  };
  if (input.existing) {
    assertGraphqlOk(await facts.update(String(input.existing.itemId ?? ""), payload), "The fact could not be saved.");
  } else {
    assertGraphqlOk(await facts.create(payload), "The fact could not be saved.");
  }
}

export async function removeFact(access: Access, fact: ObservedFactRecord): Promise<void> {
  if (!sameOwner(access, fact) || access.role === "buglens-viewer") throw new Error("Only its author, a QA engineer or an admin can remove this fact.");
  assertGraphqlOk(await facts.delete(String(fact.itemId ?? "")), "The fact could not be removed.");
}

/** IS-03 — a hypothesis saves without evidence but always says so. */
export async function saveHypothesis(input: {
  access: Access;
  confidence: string;
  evidenceIds: string[];
  existing?: HypothesisRecord;
  investigationId: string;
  issueId?: string;
  missingEvidence: string;
  nextStep: string;
  text: string;
}): Promise<void> {
  canWrite(input.access);
  assertNoCredential(input.text);
  if (input.existing && !sameOwner(input.access, input.existing)) throw new Error("Only its author, a QA engineer or an admin can change this hypothesis.");

  const payload: HypothesisRecord = {
    confidence: input.confidence,
    evidenceIds: input.evidenceIds,
    investigationId: input.investigationId,
    issueId: input.issueId ?? input.existing?.issueId ?? "",
    missingEvidence: input.missingEvidence || input.existing?.missingEvidence || "",
    nextStep: input.nextStep || input.existing?.nextStep || "",
    text: input.text
  };
  if (input.existing) {
    if (!sameOwner(input.access, input.existing)) throw new Error("Only its author, a QA engineer or an admin can change this hypothesis.");
    assertGraphqlOk(await hypotheses.update(String(input.existing.itemId ?? ""), payload), "The hypothesis could not be saved.");
  } else {
    assertGraphqlOk(
      await hypotheses.create({
        ...payload,
        authorId: input.access.actor.id,
        authorName: input.access.actor.name,
        time: isoNow(),
        workspaceId: input.access.workspaceId
      }),
      "The hypothesis could not be saved."
    );
  }
}

export async function removeHypothesis(access: Access, item: HypothesisRecord): Promise<void> {
  if (!sameOwner(access, item) || access.role === "buglens-viewer") throw new Error("Only its author, a QA engineer or an admin can remove this hypothesis.");
  assertGraphqlOk(await hypotheses.delete(String(item.itemId ?? "")), "The hypothesis could not be removed.");
}
