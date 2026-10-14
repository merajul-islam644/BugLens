export type RoleSlug = "buglens-admin" | "buglens-qa" | "buglens-developer" | "buglens-viewer";

export type Capability =
  | "read"
  | "manageProjects"
  | "removeProjects"
  | "createIssues"
  | "runInvestigations"
  | "contribute"
  | "setResolved"
  | "manageWorkspace";

export const ROLE_LABELS: Record<RoleSlug, string> = {
  "buglens-admin": "Admin",
  "buglens-qa": "QA Engineer",
  "buglens-developer": "Developer",
  "buglens-viewer": "Viewer"
};

export const ROLE_ORDER: RoleSlug[] = ["buglens-admin", "buglens-qa", "buglens-developer", "buglens-viewer"];

// The permission table from the requirements, stated once so the interface and
// the data layer refuse the same actions. Every write goes through `can` before
// touching the gateway; a Viewer posting a record directly is refused here.
const MATRIX: Record<Capability, RoleSlug[]> = {
  read: ["buglens-admin", "buglens-qa", "buglens-developer", "buglens-viewer"],
  manageProjects: ["buglens-admin", "buglens-qa"],
  removeProjects: ["buglens-admin"],
  createIssues: ["buglens-admin", "buglens-qa"],
  runInvestigations: ["buglens-admin", "buglens-qa"],
  contribute: ["buglens-admin", "buglens-qa", "buglens-developer"],
  setResolved: ["buglens-admin", "buglens-qa"],
  manageWorkspace: ["buglens-admin"]
};

const CAPABILITY_DENIED: Record<Capability, string> = {
  read: "You do not have access to this.",
  manageProjects: "Only an admin or QA engineer can change projects and environments.",
  removeProjects: "Only an admin can archive or delete a project.",
  createIssues: "Only an admin or QA engineer can create issues, add evidence or run investigations.",
  runInvestigations: "Only an admin or QA engineer can run investigations.",
  contribute: "Only an admin, QA engineer or developer can do this.",
  setResolved: "Only a QA engineer or admin can resolve this issue.",
  manageWorkspace: "Only an admin can change workspace settings."
};

export const PERMISSION_TABLE: { action: string; roles: RoleSlug[] }[] = [
  { action: "View issues, evidence, reports", roles: ROLE_ORDER },
  { action: "Create / edit Project, Environment", roles: MATRIX.manageProjects },
  { action: "Create Issue, upload Evidence, run Investigation", roles: MATRIX.createIssues },
  { action: "Comment, change Status, store commit or pull request link, record Retest run", roles: MATRIX.contribute },
  { action: "Set Resolved", roles: MATRIX.setResolved },
  { action: "Invite members, retention, allowed hosts, audit log", roles: MATRIX.manageWorkspace }
];

const SLUGS = Object.keys(ROLE_LABELS) as RoleSlug[];

export function isRoleSlug(value: unknown): value is RoleSlug {
  return typeof value === "string" && (SLUGS as string[]).includes(value);
}

/** Accepts the stored slug, the bare suffix, or an IAM role name. */
export function toRoleSlug(value: unknown): RoleSlug | undefined {
  if (typeof value !== "string") return undefined;
  const normalised = value.trim().toLowerCase().replace(/^buglens-/, "");
  return SLUGS.find((slug) => slug === `buglens-${normalised}`);
}

export function can(role: RoleSlug | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[capability].includes(role);
}

/** The refusal a member sees when their role may not take the action. */
export function refusal(role: RoleSlug | undefined, capability: Capability): Error | undefined {
  return can(role, capability) ? undefined : new Error(CAPABILITY_DENIED[capability]);
}

export function roleLabel(role: RoleSlug | undefined): string {
  return role ? ROLE_LABELS[role] : "Viewer";
}
