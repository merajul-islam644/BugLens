import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, recordId, unwrapItems, withId, withIds } from "../../lib/blocks/records";

export type WorkspaceRecord = {
  itemId?: string;
  name?: string;
  allowedHosts?: string[];
  allowedPaths?: string[];
  retentionMonths?: number;
  requireMfa?: boolean;
  maskingRules?: string[];
};

export type MemberRecord = {
  itemId?: string;
  workspaceId?: string;
  userId?: string;
  email?: string;
  displayName?: string;
  role?: string;
  active?: boolean;
  lastSignInAt?: string;
};

export type InvitationRecord = {
  itemId?: string;
  workspaceId?: string;
  email?: string;
  role?: string;
  invitedBy?: string;
  invitedByName?: string;
  invitedAt?: string;
  expiresAt?: string;
  status?: string;
  token?: string;
};

export const DEFAULT_WORKSPACE_NAME = "BugLens workspace";
export const INVITATION_DAYS = 14;

const workspaces = blocksClient.data.collection<WorkspaceRecord>("Workspace", {
  fields: ["name", "allowedHosts", "allowedPaths", "retentionMonths", "requireMfa", "maskingRules"]
});

const members = blocksClient.data.collection<MemberRecord>("Member", {
  fields: ["workspaceId", "userId", "email", "displayName", "role", "active", "lastSignInAt"]
});

const invitations = blocksClient.data.collection<InvitationRecord>("Invitation", {
  fields: ["workspaceId", "email", "role", "invitedBy", "invitedByName", "invitedAt", "expiresAt", "status", "token"]
});

export async function getWorkspace(): Promise<WorkspaceRecord | undefined> {
  const response = await workspaces.list({ pageNo: 1, pageSize: 50 });
  const first = unwrapItems<WorkspaceRecord>(response, "Workspaces").items[0];
  return first ? withId(first) : undefined;
}

export async function createWorkspace(name: string): Promise<WorkspaceRecord> {
  assertGraphqlOk(
    await workspaces.create({ name, allowedHosts: [], allowedPaths: [], retentionMonths: 12, requireMfa: false, maskingRules: [] }),
    "The workspace could not be created."
  );

  const response = await workspaces.list({ pageNo: 1, pageSize: 50 });
  const created = unwrapItems<WorkspaceRecord>(response, "Workspaces").items.find((item) => item.name === name);
  if (created) return withId(created);

  throw new Error("The workspace could not be created.");
}

export async function updateWorkspace(itemId: string, input: Partial<WorkspaceRecord>): Promise<void> {
  assertGraphqlOk(await workspaces.update(itemId, input), "The workspace settings could not be saved.");
}

/** PR-02 AC1 — an environment's host joins the workspace's allowed hosts list. */
export async function addAllowedHost(workspace: WorkspaceRecord, host: string): Promise<void> {
  const itemId = recordId(workspace);
  if (!itemId || (workspace.allowedHosts ?? []).includes(host)) return;

  await updateWorkspace(itemId, { allowedHosts: [...(workspace.allowedHosts ?? []), host] });
}

export async function listMembers(): Promise<MemberRecord[]> {
  const response = await members.list({ pageNo: 1, pageSize: 200 });
  return withIds(unwrapItems<MemberRecord>(response, "Members").items);
}

export async function upsertMember(input: {
  displayName: string;
  email: string;
  role: string;
  userId: string;
  workspaceId: string;
}): Promise<MemberRecord> {
  const existing = (await listMembers()).find((member) => member.userId === input.userId);
  if (existing) return existing;

  assertGraphqlOk(await members.create({ ...input, active: true }), "Your membership could not be recorded.");
  const created = (await listMembers()).find((member) => member.userId === input.userId);
  if (created) return created;

  throw new Error("Your membership could not be recorded.");
}

export async function updateMember(itemId: string, input: Partial<MemberRecord>): Promise<void> {
  assertGraphqlOk(await members.update(itemId, input), "The member could not be updated.");
}

export async function listInvitations(): Promise<InvitationRecord[]> {
  const response = await invitations.list({ pageNo: 1, pageSize: 200 });
  return withIds(unwrapItems<InvitationRecord>(response, "Invitations").items);
}

export async function createInvitation(input: {
  email: string;
  expiresAt: string;
  invitedBy: string;
  invitedByName: string;
  invitedAt: string;
  role: string;
  token: string;
  workspaceId: string;
}): Promise<void> {
  assertGraphqlOk(await invitations.create({ ...input, status: "Pending" }), "The invitation could not be created.");
}

export async function updateInvitation(itemId: string, input: Partial<InvitationRecord>): Promise<void> {
  assertGraphqlOk(await invitations.update(itemId, input), "The invitation could not be updated.");
}

/** Pending invitations that have passed their 14-day expiry, flagged for the admin. */
export function isExpired(invitation: InvitationRecord): boolean {
  if (invitation.status !== "Pending") return false;
  const expiresAt = invitation.expiresAt ? new Date(invitation.expiresAt).getTime() : 0;
  return expiresAt > 0 && expiresAt < Date.now();
}
