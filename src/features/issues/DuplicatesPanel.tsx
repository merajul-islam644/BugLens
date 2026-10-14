import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { can } from "../access/permissions";
import type { Access } from "../access/useAccess";
import { dismissAsNotDuplicate, markDuplicate, suggestDuplicates } from "./duplicatesApi";
import { IssueSeverityBadge } from "./IssueBadges";
import type { IssueRecord } from "./issuesApi";

/** IS-05 style duplicates: suggestions name what matched; dismissal is remembered. */
export function DuplicatesPanel({ access, issue, issues, onChanged, onOpen }: {
  access: Access;
  issue: IssueRecord;
  issues: IssueRecord[];
  onChanged: () => void;
  onOpen: (itemId: string) => void;
}) {
  const [error, setError] = useState("");
  const canEdit = can(access.role, "contribute");
  const duplicateOf = (issues ?? []).find((item) => (item.itemId ?? "") === issue.duplicateOfIssueId);
  const suggestions = suggestDuplicates(issue, issues ?? []);

  async function act(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The duplicate could not be recorded.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Duplicates</h3></div>

      {duplicateOf ? (
        <Alert tone="info">
          Marked as a duplicate of{" "}
          <button className="link-button" onClick={() => onOpen(String(duplicateOf.itemId ?? ""))}>
            {duplicateOf.issueKey} {duplicateOf.title}
          </button>
        </Alert>
      ) : null}

      {duplicateOf || suggestions.length === 0 ? (
        <p className="muted">{duplicateOf ? "Marking a duplicate stops further suggestions." : "No duplicate suggestions right now."}</p>
      ) : (
        <ul className="feed">
          {suggestions.map((suggestion) => (
            <li key={String(suggestion.issue.itemId)}>
              <span className="mono">Possible duplicate of {suggestion.issue.issueKey}</span>
              <span>
                {suggestion.issue.title}{" "}
                <span className="field-hint">
                  {suggestion.sameRoute ? `Shared route: ${suggestion.issue.route}` : ""}
                  {suggestion.sameSignature ? `${suggestion.sameRoute ? " · " : ""}Shared error signature: ${suggestion.issue.errorSignature}` : ""}
                  {!suggestion.sameRoute && !suggestion.sameSignature && suggestion.matched.length > 0
                    ? `Matches on ${suggestion.matched.map((word) => `“${word}”`).join(", ")}`
                    : ""}
                  {` · Status: ${suggestion.issue.status ?? "New"}`}
                  {suggestion.sameProject ? " · Same project" : ""}
                  {suggestion.sameEnvironment ? " · Same environment" : ""}
                </span>
              </span>
              <IssueSeverityBadge severity={suggestion.issue.severity} />
              {canEdit ? (
                <span className="row-actions">
                  <button className="link-button" onClick={() => onOpen(String(suggestion.issue.itemId ?? ""))}>Open it</button>
                  <button className="link-button" onClick={() => void act(() => markDuplicate(access, issue, suggestion.issue))}>Mark as duplicate</button>
                  <button className="link-button" onClick={() => void act(() => dismissAsNotDuplicate(access, issue, String(suggestion.issue.itemId ?? "")))}>Mark as not a duplicate</button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
