import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";
import { refusal } from "../access/permissions";
import { isoNow } from "../../shared/domain/format";
import type { Access } from "../access/useAccess";

export type RetestRunRecord = {
  itemId?: string;
  workspaceId?: string;
  issueId?: string;
  runNo?: number;
  environmentId?: string;
  environmentName?: string;
  target?: string;
  authorised?: boolean;
  howRun?: string;
  result?: string;
  comparison?: string;
  responseStatus?: string;
  consoleErrors?: string;
  evidenceIds?: string[];
  ranById?: string;
  ranByName?: string;
  ranAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
};

const retests = blocksClient.data.collection<RetestRunRecord>("RetestRun", {
  fields: [
    "workspaceId", "issueId", "runNo", "environmentId", "environmentName", "target", "authorised", "howRun",
    "result", "comparison", "responseStatus", "consoleErrors", "evidenceIds", "ranById", "ranByName", "ranAt",
    "confirmedBy", "confirmedAt"
  ]
});

export async function listRetestRuns(issueId: string): Promise<RetestRunRecord[]> {
  const response = await retests.list({ pageNo: 1, pageSize: 200 });
  return withIds(unwrapItems<RetestRunRecord>(response, "RetestRuns").items)
    .filter((item) => item.issueId === issueId)
    .sort((a, b) => Number(b.runNo ?? 0) - Number(a.runNo ?? 0));
}

/** A retest run is only worth the name with its own evidence attached. */
export async function addRetestRun(input: {
  access: Access;
  authorised: boolean;
  comparison?: string;
  consoleErrors?: string;
  environmentId?: string;
  environmentName?: string;
  evidenceIds: string[];
  howRun: string;
  issueId: string;
  responseStatus?: string;
  result: string;
  target?: string;
}): Promise<number> {
  const denied = refusal(input.access.role, "contribute");
  if (denied) throw denied;
  if (!input.authorised) throw new Error("You are not authorised to test this environment.");
  if (input.evidenceIds.length === 0) throw new Error("Attach the evidence from this run — a screenshot or a log.");
  if (input.howRun === "Not run" && input.result !== "Blocked") {
    throw new Error("A run that was not attempted can only be recorded as Blocked.");
  }
  const existing = await listRetestRuns(input.issueId);
  const runNo = existing.reduce((max, run) => Math.max(max, Number(run.runNo ?? 0)), 0) + 1;
  assertGraphqlOk(await retests.create({
    authorised: true,
    comparison: input.comparison ?? "",
    consoleErrors: input.consoleErrors ?? "",
    environmentId: input.environmentId ?? "",
    environmentName: input.environmentName ?? "",
    evidenceIds: input.evidenceIds,
    howRun: input.howRun,
    issueId: input.issueId,
    responseStatus: input.responseStatus ?? "",
    result: input.result,
    runNo,
    target: input.target ?? "",
    ranAt: isoNow(),
    ranById: input.access.actor.id,
    ranByName: input.access.actor.name,
    workspaceId: input.access.workspaceId
  }), "The retest run could not be recorded.");
  return runNo;
}

/** Resolving is only honest after the last run passed. */
export async function hasPassedRun(issueId: string): Promise<boolean> {
  const runs = await listRetestRuns(issueId);
  const latest = runs[0];
  return latest ? latest.result === "Passed" : false;
}

export async function listAllRetestRuns(workspaceId: string): Promise<RetestRunRecord[]> {
  const response = await retests.list({ pageNo: 1, pageSize: 500 });
  return withIds(unwrapItems<RetestRunRecord>(response, "RetestRuns").items)
    .filter((item) => !item.workspaceId || item.workspaceId === workspaceId)
    .sort((a, b) => String(b.ranAt ?? "").localeCompare(String(a.ranAt ?? "")));
}
