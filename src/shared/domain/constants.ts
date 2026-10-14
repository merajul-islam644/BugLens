export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_FILES = 20;

export const EVIDENCE_TYPES = [
  "Screenshot",
  "Screen recording",
  "Playwright trace",
  "Console log",
  "Network request",
  "API response",
  "Stack trace",
  "Reproduction note",
  "Timeline event",
  "Other file"
] as const;

export const EVIDENCE_SOURCES = ["Upload", "Pasted by hand", "Automated test"] as const;

export const MASKING_STATUSES = ["Not checked", "Checked — safe to share", "Contains sensitive values"] as const;

export const ENVIRONMENT_TYPES = ["Development", "Test", "Staging", "Production", "Custom"] as const;

export const SEVERITIES = ["Critical", "High", "Medium", "Low", "Informational"] as const;

export const STATUSES = ["New", "Confirmed", "In Progress", "Ready for Retest", "Resolved", "Rejected", "Won't Fix"] as const;

export const FINDING_TYPES = [
  "Functional defect",
  "UI or rendering issue",
  "Navigation failure",
  "API or network failure",
  "Form validation",
  "Accessibility concern",
  "Performance observation",
  "Security or data exposure",
  "Intermittent failure"
] as const;

export const REPRODUCTION_OUTCOMES = [
  "Reproduced",
  "Not reproduced",
  "Intermittent",
  "Blocked",
  "Needs manual verification"
] as const;

export const RETEST_RESULTS = ["Passed", "Failed", "Inconclusive", "Blocked"] as const;

export const RETEST_METHODS = ["Ran by hand", "Automated test run", "Not run"] as const;

export const CONFIDENCES = ["Possible", "Likely", "Unverified"] as const;

export const INVESTIGATION_STAGES = [
  "Target and permissions checked",
  "Evidence gathered",
  "Observations recorded",
  "Reproduction attempted",
  "Duplicates checked",
  "Report drafted",
  "Ready for human review"
] as const;

export const PLANNED_CHECKS = [
  "Review supplied evidence",
  "Compare expected and actual behaviour",
  "Write reproduction steps",
  "Search for similar issues",
  "Plan a safe manual re-run"
] as const;

export const CLOSED_STATUSES = ["Resolved", "Rejected", "Won't Fix"] as const;

export function isOpenStatus(status: string | undefined): boolean {
  return !CLOSED_STATUSES.includes(String(status) as (typeof CLOSED_STATUSES)[number]);
}
