import { updateIssue } from "./issuesApi";
import { writeAudit } from "../records/auditApi";
import type { IssueRecord } from "./issuesApi";
import type { Access } from "../access/useAccess";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "when", "then", "from", "into", "over", "your", "have", "been",
  "were", "will", "should", "does", "page", "error", "click", "button", "user", "users", "not", "but", "are",
  "was", "has", "its", "our", "you", "all", "can", "get", "got", "out", "about", "after", "before", "while"
]);

function words(title: string | undefined): string[] {
  return String(title ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

export type DuplicateSuggestion = {
  issue: IssueRecord;
  matched: string[];
  sameEnvironment: boolean;
  sameProject: boolean;
  sameRoute: boolean;
  sameSignature: boolean;
};

/**
 * IS-05 — compares route, error signature, project, environment and title wording
 * against open and closed issues, and names what matched. A suggestion only: nothing
 * merges or closes on its own. Dismissed pairings never come back.
 */
export function suggestDuplicates(issue: IssueRecord, all: IssueRecord[]): DuplicateSuggestion[] {
  const mine = words(issue.title);
  const dismissed = new Set(issue.markedNotDuplicates ?? []);
  const suggestions: DuplicateSuggestion[] = [];
  for (const other of all) {
    const otherId = String(other.itemId ?? "");
    if (!otherId || otherId === String(issue.itemId ?? "")) continue;
    if (dismissed.has(otherId)) continue;

    const sameRoute = Boolean(issue.route) && other.route === issue.route;
    const sameSignature = Boolean(issue.errorSignature) && other.errorSignature === issue.errorSignature;
    const sameProject = Boolean(issue.projectId) && other.projectId === issue.projectId;
    const sameEnvironment = Boolean(issue.environmentId) && other.environmentId === issue.environmentId;
    const matched = words(other.title).filter((word) => mine.includes(word));

    const strong = sameRoute || sameSignature;
    if (strong || matched.length >= 2) {
      suggestions.push({ issue: other, matched, sameEnvironment, sameProject, sameRoute, sameSignature });
    }
  }
  return suggestions.sort((a, b) => {
    const score = (item: DuplicateSuggestion) =>
      (item.sameSignature ? 4 : 0) + (item.sameRoute ? 3 : 0) + (item.sameEnvironment ? 1 : 0) + item.matched.length;
    return score(b) - score(a);
  });
}

export async function markDuplicate(access: Access, issue: IssueRecord, duplicateOf: IssueRecord): Promise<void> {
  await updateIssue(access, String(issue.itemId ?? ""), { duplicateOfIssueId: String(duplicateOf.itemId ?? "") });
  await writeAudit(access.workspaceId, access.actor, {
    action: "Issue marked duplicate",
    newValue: String(duplicateOf.issueKey ?? duplicateOf.itemId ?? ""),
    oldValue: "",
    recordId: String(issue.itemId ?? ""),
    recordLabel: issue.issueKey || "Issue",
    recordType: "Issue"
  });
}

export async function dismissAsNotDuplicate(access: Access, issue: IssueRecord, otherItemId: string): Promise<void> {
  const marked = issue.markedNotDuplicates ?? [];
  if (marked.includes(otherItemId)) return;
  await updateIssue(access, String(issue.itemId ?? ""), { markedNotDuplicates: [...marked, otherItemId] });
}
