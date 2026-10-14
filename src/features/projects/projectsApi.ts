import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, recordId, unwrapItems } from "../../lib/blocks/records";

export type IssueSummary = {
  itemId?: string;
  projectId?: string;
  status?: string;
  title?: string;
};

export type ProjectRecord = {
  /** Every read carries this; see withId. */
  itemId: string;
  name?: string;
  description?: string;
  owner?: string;
  tags?: string[];
  repositoryUrl?: string;
  workspaceId?: string;
  archived?: boolean;
};

export type EnvironmentRecord = {
  /** Every read carries this; see withId. */
  itemId: string;
  projectId?: string;
  workspaceId?: string;
  name?: string;
  baseUrl?: string;
  type?: string;
  allowedHosts?: string[];
  allowedPaths?: string[];
  browserDefault?: string;
  buildLabel?: string;
};

/** Statuses that count as an open issue when a project is removed. */
const CLOSED_STATUSES = ["Resolved", "Rejected", "Won't Fix"];

const projects = blocksClient.data.collection<ProjectRecord>("Project", {
  fields: ["name", "description", "owner", "tags", "repositoryUrl", "workspaceId", "archived"]
});

const environments = blocksClient.data.collection<EnvironmentRecord>("Environment", {
  fields: [
    "projectId",
    "workspaceId",
    "name",
    "baseUrl",
    "type",
    "allowedHosts",
    "allowedPaths",
    "browserDefault",
    "buildLabel"
  ]
});

const issues = blocksClient.data.collection<IssueSummary>("Issue", {
  fields: ["title", "status", "projectId", "workspaceId"]
});


export async function listProjects(workspaceId: string): Promise<ProjectRecord[]> {
  const response = await projects.list({ pageNo: 1, pageSize: 200 });
  return unwrapItems<ProjectRecord>(response, "Projects")
    .items.filter((project) => project.workspaceId === workspaceId)
    .map((project) => ({ ...project, itemId: recordId(project) }));
}

export async function listEnvironments(projectIdValue: string): Promise<EnvironmentRecord[]> {
  const response = await environments.list({ pageNo: 1, pageSize: 200 });
  return unwrapItems<EnvironmentRecord>(response, "Environments")
    .items.filter((environment) => environment.projectId === projectIdValue)
    .map((environment) => ({ ...environment, itemId: recordId(environment) }));
}

export async function countOpenIssues(projectIdValue: string): Promise<number> {
  const open = await listOpenIssues();
  return open.filter((issue) => String(issue.projectId) === projectIdValue).length;
}

export async function listOpenIssues(): Promise<IssueSummary[]> {
  const response = await issues.list({ pageNo: 1, pageSize: 500 });
  return unwrapItems<IssueSummary>(response, "Issues").items.filter(
    (issue) => !CLOSED_STATUSES.includes(String(issue.status))
  );
}

export async function listAllEnvironments(workspaceId: string): Promise<EnvironmentRecord[]> {
  const response = await environments.list({ pageNo: 1, pageSize: 500 });
  return unwrapItems<EnvironmentRecord>(response, "Environments")
    .items.filter((environment) => environment.workspaceId === workspaceId)
    .map((environment) => ({ ...environment, itemId: recordId(environment) }));
}

export async function createProject(input: {
  archived: boolean;
  description: string;
  name: string;
  owner: string;
  repositoryUrl: string;
  tags: string[];
  workspaceId: string;
}): Promise<void> {
  await write(projects.create(input), "A project with this name already exists in this workspace.");
}

export async function updateProject(itemId: string, input: Partial<ProjectRecord>): Promise<void> {
  await write(projects.update(itemId, input), "A project with this name already exists in this workspace.");
}

export async function removeProject(itemId: string): Promise<void> {
  await write(projects.delete(itemId), "The project could not be removed.");
}

export async function createEnvironment(input: {
  allowedHosts: string[];
  allowedPaths: string[];
  baseUrl: string;
  browserDefault: string;
  buildLabel: string;
  name: string;
  projectId: string;
  type: string;
  workspaceId: string;
}): Promise<void> {
  await write(environments.create(input), "An environment with this name already exists on the project.");
}

export async function updateEnvironment(itemId: string, input: Partial<EnvironmentRecord>): Promise<void> {
  await write(environments.update(itemId, input), "An environment with this name already exists on the project.");
}

/**
 * Writes go through the gateway, which can answer 200 OK with a GraphQL error list,
 * so each one is checked. The gateway reports a name collision in its own words;
 * `collision` is the sentence the member is shown instead.
 */
async function write(call: Promise<unknown>, collision: string): Promise<void> {
  try {
    assertGraphqlOk(await call, "The change could not be saved.");
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : "";
    throw new Error(/already exists|duplicate|E11000/i.test(detail) ? collision : detail || "The change could not be saved.");
  }
}

