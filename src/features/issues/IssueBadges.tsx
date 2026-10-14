export function IssueStatusBadge({ status }: { status: string | undefined }) {
  const value = status || "New";
  const tone = value === "Resolved" ? "badge-good" : value === "Ready for Retest" || value === "In Progress" ? "badge-warn" : "badge-neutral";
  return <span className={`badge ${tone}`}>{value}</span>;
}

export function IssueSeverityBadge({ severity }: { severity: string | undefined }) {
  const value = severity || "—";
  const tone = value === "Critical" ? "badge-danger" : value === "High" ? "badge-warn" : "badge-neutral";
  return <span className={`badge ${tone}`}>{value}</span>;
}
