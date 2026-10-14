import { blocksClient } from "../../lib/blocks/client";
import type { RoleSlug } from "../access/permissions";
import { ROLE_LABELS, toRoleSlug } from "../access/permissions";
import { writeAudit } from "../records/auditApi";
import type { Actor } from "../records/auditApi";
import { isoNow } from "../../shared/domain/format";
import {
  INVITATION_DAYS,
  createInvitation,
  listInvitations,
  listMembers,
  updateInvitation,
  updateMember,
  updateWorkspace,
  upsertMember
} from "../workspace/workspaceApi";
import type { InvitationRecord, MemberRecord, WorkspaceRecord } from "../workspace/workspaceApi";

function firstError(response: unknown, fallback: string): string | undefined {
  const record = response as Record<string, unknown> | undefined;
  const errors = record?.errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const values = Object.values(errors as Record<string, unknown>);
    const message = values.map((value) => (Array.isArray(value) ? String(value[0]) : String(value))).join(" ");
    if (message && !/^\s*$/i.test(message) && message.toLowerCase() !== "true") return `${fallback} ${message}`;
  }
  return undefined;
}

async function ensureIamUser(email: string, role: RoleSlug): Promise<{ userId: string; created: boolean }> {
  const exists = await blocksClient.iam.users.exists(email).catch(() => undefined);
  const existing = exists as Record<string, unknown> | undefined;
  const found = existing?.isExists ?? existing?.isExist ?? existing?.exists;
  const itemId = typeof existing?.itemId === "string" ? existing.itemId : undefined;

  if (found === true || (found === undefined && typeof itemId === "string" && itemId)) {
    return { userId: String(itemId ?? ""), created: false };
  }

  const created = await blocksClient.iam.users.create({ email, roles: [role] });
  const failure = firstError(created, "The member could not be invited.");
  if (failure) throw new Error(failure);

  const createdRecord = (created as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  return { userId: String(createdRecord?.itemId ?? ""), created: true };
}

/** WS-02 / AU-02 — an Admin invites a member; they start with the invited role (default Viewer). */
export async function inviteMember(input: {
  access: { actor: Actor; workspaceId: string };
  email: string;
  role: RoleSlug;
  workspace: WorkspaceRecord;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");

  const availability = await blocksClient.iam.users.emailAvailable({ email }).catch(() => undefined);
  const taken = availability?.isAvailable === false || availability?.IsAvailable === false;
  if (taken) throw new Error("A member with this email already exists in the workspace.");

  const members = await listMembers();
  if (members.some((member: MemberRecord) => String(member.email).toLowerCase() === email)) {
    throw new Error("A member with this email already exists in the workspace.");
  }

  const pending = (await listInvitations()).find(
    (invitation: InvitationRecord) => String(invitation.email).toLowerCase() === email && invitation.status === "Pending"
  );
  if (pending) throw new Error("An invitation for this email is already pending.");

  const invitedAt = isoNow();
  const expires = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60_000).toISOString();
  const token = crypto.randomUUID();

  await createInvitation({
    email,
    expiresAt: expires,
    invitedBy: input.access.actor.id,
    invitedByName: input.access.actor.name,
    invitedAt,
    role: input.role,
    token,
    workspaceId: input.access.workspaceId
  });

  await writeAudit(input.access.workspaceId, input.access.actor, {
    action: "Invitation sent",
    newValue: ROLE_LABELS[input.role],
    recordId: token,
    recordLabel: email,
    recordType: "Invitation"
  });

  // Email is best-effort: the invitation stands even when mail delivery fails.
  await blocksClient.mail
    .send({
      to: [email],
      purpose: "buglens-invite",
      language: "en",
      subjectDataContext: { workspace: input.workspace.name ?? "BugLens" },
      bodyDataContext: {
        email,
        inviteLink: `${window.location.origin}/invite?token=${token}`,
        role: ROLE_LABELS[input.role],
        workspace: input.workspace.name ?? "BugLens"
      }
    })
    .catch(() => undefined);
}

export async function acceptInvitation(input: {
  firstName: string;
  invitation: InvitationRecord;
  lastName: string;
  password: string;
}): Promise<void> {
  const invitation = input.invitation;
  const role = toRoleSlug(invitation.role) ?? "buglens-viewer";

  const created = await blocksClient.iam.users.create({
    email: invitation.email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    password: input.password,
    roles: [role]
  });
  const failure = firstError(created, "The account could not be created.");
  if (failure) {
    throw new Error(/exist/i.test(failure) ? "An account with this email already exists. Sign in instead." : failure);
  }

  const createdRecord = (created as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const userId = String(createdRecord?.itemId ?? "");

  if (invitation.workspaceId) {
    await upsertMember({
      displayName: [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || String(invitation.email ?? ""),
      email: String(invitation.email ?? ""),
      role,
      userId,
      workspaceId: String(invitation.workspaceId)
    }).catch(() => undefined);
  }

  await updateInvitation(String(invitation.itemId ?? ""), { status: "Accepted" }).catch(() => undefined);
}

/** WS-02 — Admin changes a member's role in the workspace and on their account. */
export async function changeMemberRole(input: {
  access: { actor: Actor; workspaceId: string };
  member: MemberRecord;
  role: RoleSlug;
}): Promise<void> {
  const previous = toRoleSlug(input.member.role);
  if (input.member.userId) {
    const response = await blocksClient.iam.users.updateAccess({ userId: input.member.userId, roles: [input.role] });
    const failure = firstError(response, "The member's role could not be changed.");
    if (failure) throw new Error(failure);
  }
  await updateMember(String(input.member.itemId ?? ""), { role: input.role });
  await writeAudit(input.access.workspaceId, input.access.actor, {
    action: "Role changed",
    newValue: ROLE_LABELS[input.role],
    oldValue: previous ? ROLE_LABELS[previous] : "none",
    recordId: String(input.member.itemId ?? ""),
    recordLabel: input.member.displayName ?? input.member.email ?? "member",
    recordType: "Member"
  });
}

/** WS-02 AC1 — deactivating removes access; the member sees the refusal at next sign-in. */
export async function setMemberActive(input: {
  access: { actor: Actor; workspaceId: string };
  active: boolean;
  member: MemberRecord;
}): Promise<void> {
  if (input.member.userId) {
    const response = input.active
      ? await blocksClient.iam.users.activate({ reason: "Reactivated by workspace admin", userId: input.member.userId })
      : await blocksClient.iam.users.deactivate({ userId: input.member.userId });
    const failure = firstError(response, "The member's access could not be changed.");
    if (failure) throw new Error(failure);
  }
  await updateMember(String(input.member.itemId ?? ""), { active: input.active });
  await writeAudit(input.access.workspaceId, input.access.actor, {
    action: input.active ? "Member reactivated" : "Member deactivated",
    newValue: input.active ? "Active" : "Deactivated",
    oldValue: input.active ? "Deactivated" : "Active",
    recordId: String(input.member.itemId ?? ""),
    recordLabel: input.member.displayName ?? input.member.email ?? "member",
    recordType: "Member"
  });
}

export async function markInvitationExpired(invitation: InvitationRecord): Promise<void> {
  await updateInvitation(String(invitation.itemId ?? ""), { status: "Expired" });
}

/**
 * AU-03 — an Admin requires multi-factor for everyone. The workspace flag is what
 * gates the app; the tenant-wide IAM policy is asked for best-effort, because not
 * every deployment lets an app token change it.
 */
export async function setRequireMfa(input: { on: boolean; workspace: WorkspaceRecord }): Promise<void> {
  const itemId = String(input.workspace.itemId ?? "");
  if (!itemId) throw new Error("The workspace could not be read.");
  await updateWorkspace(itemId, { requireMfa: input.on });
  await blocksClient.mfa
    .saveConfig(
      input.on
        ? { enableMfa: true, requireMfaForAllUsers: true, userMfaType: [1], allowBackupCodes: true }
        : { enableMfa: false, requireMfaForAllUsers: false }
    )
    .catch(() => undefined);
}
