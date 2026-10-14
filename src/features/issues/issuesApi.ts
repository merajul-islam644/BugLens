import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";
import { refusal } from "../access/permissions";
import { writeAudit } from "../records/auditApi";
import { isoNow } from "../../shared/domain/format";
import { nextId } from "../records/counterApi";
import type { Access } from "../access/useAccess";

export type IssueRecord = {
  itemId?: string;
  workspaceId?: string;
  issueKey?: string;
  title?: string;
  summary?: string;
  projectId?: string;
  environmentId?: string;
  route?: string;
  errorSignature?: string;
  observedBehaviour?: string;
  expectedBehaviour?: string;
  severity?: string;
  severityReason?: string;
  impact?: string;
  findingType?: string;
  status?: string;
  assigneeId?: string;
  assigneeName?: string;
  source?: string;
  investigationId?: string;
  evidenceIds?: string[];
  reproductionOutcome?: string;
  outcomeCondition?: string;
  outcomeRanBy?: string;
  outcomeRanAt?: string;
  outcomeEvidenceIds?: string[];
  outcomeAttempts?: string;
  preconditions?: string;
  actualResult?: string;
  expectedResult?: string;
  possibleCause?: string;
  suggestedNextStep?: string;
  duplicateOfIssueId?: string;
  markedNotDuplicates?: string[];
  environmentUrl?: string;
  environmentBrowser?: string;
  environmentOs?: string;
  environmentBuild?: string;
  environmentTimestamp?: string;
  requestIds?: string;
  report?: string;
  createdAt?: string;
  resolvedAt?: string;
  lastUpdated?: string;
};

export const ISSUE_FIELDS = [
  "workspaceId", "issueKey", "title", "summary", "projectId", "environmentId", "route", "errorSignature",
  "observedBehaviour", "expectedBehaviour", "severity", "severityReason", "impact", "findingType", "status",
  "assigneeId", "assigneeName", "source", "investigationId", "evidenceIds", "reproductionOutcome",
  "outcomeCondition", "outcomeRanBy", "outcomeRanAt", "outcomeEvidenceIds", "outcomeAttempts", "preconditions", "actualResult",
  "expectedResult", "possibleCause", "suggestedNextStep", "duplicateOfIssueId", "markedNotDuplicates",
  "environmentUrl", "environmentBrowser", "environmentOs", "environmentBuild", "environmentTimestamp",
  "requestIds", "report", "createdAt", "resolvedAt", "lastUpdated"
];

const issues = blocksClient.data.collection<IssueRecord>("Issue", { fields: ISSUE_FIELDS });

export async function listIssues(workspaceId: string): Promise<IssueRecord[]> {
  const response = await issues.list({ pageNo: 1, pageSize: 500 });
  return withIds(unwrapItems<IssueRecord>(response, "Issues").items)
    .filter((item) => item.workspaceId === workspaceId)
    .sort((a, b) => String(b.lastUpdated ?? "").localeCompare(String(a.lastUpdated ?? "")));
}

export async function createIssue(input: {
  access: Access;
  assigneeId?: string;
  assigneeName?: string;
  environmentId?: string;
  evidenceIds?: string[];
  findingType?: string;
  investigationId?: string;
  projectId?: string;
  route?: string;
  severity?: string;
  source?: string;
  summary?: string;
  title: string;
}): Promise<IssueRecord> {
  const denied = refusal(input.access.role, "createIssues");
  if (denied) throw denied;

  const issueKey = await nextId(input.access.workspaceId, "BUG");
  assertGraphqlOk(await issues.create({
    assigneeId: input.assigneeId ?? "",
    assigneeName: input.assigneeName ?? "",
    environmentId: input.environmentId ?? "",
    evidenceIds: input.evidenceIds ?? [],
    findingType: input.findingType ?? "",
    investigationId: input.investigationId ?? "",
    createdAt: isoNow(),
    issueKey,
    lastUpdated: isoNow(),
    projectId: input.projectId ?? "",
    route: input.route ?? "",
    severity: input.severity ?? "Medium",
    source: input.source ?? "Manual",
    status: "New",
    summary: input.summary ?? "",
    title: input.title.trim(),
    workspaceId: input.access.workspaceId
  }), "The issue could not be created.");

  const created = (await listIssues(input.access.workspaceId)).find((item) => item.issueKey === issueKey);
  if (!created) throw new Error("The issue could not be created.");
  return created;
}

export async function updateIssue(access: Access, itemId: string, input: Partial<IssueRecord>): Promise<void> {
  const denied = refusal(access.role, "contribute");
  if (denied) throw denied;
  assertGraphqlOk(
    await issues.update(itemId, { ...input, lastUpdated: isoNow() }),
    "The issue could not be updated."
  );
}

// Status moves follow one documented path; anything else is refused in the interface.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "New": ["Confirmed", "In Progress", "Rejected", "Won't Fix"],
  "Confirmed": ["In Progress", "Rejected", "Won't Fix"],
  "In Progress": ["Ready for Retest", "Rejected", "Won't Fix"],
  "Ready for Retest": ["In Progress", "Resolved"],
  "Resolved": ["In Progress"],
  "Rejected": ["In Progress"],
  "Won't Fix": ["In Progress"]
};

export function nextStatuses(status: string | undefined): string[] {
  return ALLOWED_TRANSITIONS[status || "New"] ?? [];
}

/** Changing status follows the documented path; Resolved is QA and Admin only. */
export async function updateStatus(input: { access: Access; latestResult?: string; issue: IssueRecord; status: string }): Promise<void> {
  if (input.status === "Resolved") {
    const denied = refusal(input.access.role, "setResolved");
    if (denied) throw denied;
    if (input.latestResult === "Inconclusive") throw new Error("An inconclusive run cannot resolve an issue.");
    if (input.latestResult !== "Passed") throw new Error("Resolve needs a retest that Passed.");
  }
  const current = input.issue.status || "New";
  if (current !== input.status && !(ALLOWED_TRANSITIONS[current] ?? []).includes(input.status)) {
    throw new Error(`You cannot move an issue from ${current} to ${input.status}.`);
  }
  await updateIssue(input.access, String(input.issue.itemId ?? ""), {
    resolvedAt: input.status === "Resolved" ? isoNow() : (input.status === "In Progress" ? "" : input.issue.resolvedAt ?? ""),
    status: input.status
  });
  await writeAudit(input.access.workspaceId, input.access.actor, {
    action: "Issue status changed",
    newValue: input.status,
    oldValue: current,
    recordId: String(input.issue.itemId ?? ""),
    recordLabel: input.issue.issueKey || "Issue",
    recordType: "Issue"
  }).catch(() => undefined);
}

/** FS-03 — one reproduction attempt: outcome, condition, who ran it, when, evidence. */
export type OutcomeAttempt = {
  outcome: string;
  condition: string;
  ranBy: string;
  ranAt: string;
  evidenceIds: string[];
};

export function parseAttempts(value: string | undefined): OutcomeAttempt[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as OutcomeAttempt[]) : [];
  } catch {
    return [];
  }
}

/**
 * FS-03 — records one attempt. "Reproduced" needs the condition seen and the
 * evidence showing it. Two attempts that disagree offer Intermittent, and every
 * attempt's evidence stays listed.
 */
export async function recordOutcome(input: {
  access: Access;
  attempt: OutcomeAttempt;
  issue: IssueRecord;
}): Promise<{ outcome: string; requested: string }> {
  const denied = refusal(input.access.role, "contribute");
  if (denied) throw denied;

  const requested = input.attempt.outcome;
  const attempts = [...parseAttempts(input.issue.outcomeAttempts), input.attempt];
  const differing = attempts.length >= 2 && new Set(attempts.map((item) => item.outcome)).size > 1;
  const effective = differing ? "Intermittent" : requested;

  if (effective === "Reproduced" && (!input.attempt.condition.trim() || input.attempt.evidenceIds.length === 0)) {
    throw new Error("Reproduced needs the condition you saw and the evidence showing it.");
  }

  await updateIssue(input.access, String(input.issue.itemId ?? ""), {
    outcomeAttempts: JSON.stringify(attempts),
    outcomeCondition: input.attempt.condition,
    outcomeEvidenceIds: attempts.flatMap((item) => item.evidenceIds),
    outcomeRanAt: input.attempt.ranAt,
    outcomeRanBy: input.attempt.ranBy,
    reproductionOutcome: effective
  });
  return { outcome: effective, requested };
}

/** FS-01 / IG-02 — Critical is never free: impact text, an observed fact and linked evidence. */
export async function updateSeverity(input: { access: Access; hasFact?: boolean; impact?: string; issue: IssueRecord; reason?: string; severity: string }): Promise<void> {
  const reason = (input.reason ?? input.issue.severityReason ?? "").trim();
  const impact = (input.impact ?? input.issue.impact ?? "").trim();
  if (input.severity === "Critical") {
    const hasEvidence = (input.issue.evidenceIds ?? []).length > 0;
    if (!impact || input.hasFact !== true || !hasEvidence) {
      throw new Error("Critical needs the impact, an observed fact and the evidence showing it.");
    }
  }
  await updateIssue(input.access, String(input.issue.itemId ?? ""), {
    impact: impact,
    severity: input.severity,
    severityReason: reason
  });
  await writeAudit(input.access.workspaceId, input.access.actor, {
    action: "Issue severity changed",
    newValue: input.severity,
    oldValue: input.issue.severity || "",
    recordId: String(input.issue.itemId ?? ""),
    recordLabel: input.issue.issueKey || "Issue",
    recordType: "Issue"
  });
}
