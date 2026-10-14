import { useQuery } from "@tanstack/react-query";
import { toRoleSlug } from "./permissions";
import type { RoleSlug } from "./permissions";
import { useAuth } from "../../app/providers/AuthProvider";
import { useCurrentUser, userDisplayName } from "../profile/useCurrentUser";
import {
  DEFAULT_WORKSPACE_NAME,
  createWorkspace,
  getWorkspace,
  listMembers,
  updateMember,
  upsertMember
} from "../workspace/workspaceApi";
import type { MemberRecord, WorkspaceRecord } from "../workspace/workspaceApi";

export type Access = {
  actor: { id: string; name: string };
  active: boolean;
  mfaOn: boolean;
  role: RoleSlug;
  workspace: WorkspaceRecord;
  workspaceId: string;
};

/** Reads the IAM user record's MFA state, whose field naming varies. */
export function readMfaState(profile: Record<string, unknown> | undefined): boolean {
  if (!profile) return false;
  const flag = profile.mfaEnabled ?? profile.isMfaEnable ?? profile.isMfaEnabled;
  if (typeof flag === "boolean") return flag;
  const method = profile.userMfaType ?? profile.mfaType;
  return typeof method === "number" && method > 0;
}

/**
 * Resolves the signed-in member's role in this workspace. The workspace itself is
 * created on first sign-in, and a person with no membership record yet starts as
 * Viewer — the same starting point an invitation grants.
 */
export function useAccess() {
  const { status } = useAuth();
  const me = useCurrentUser();
  const profile = me.data?.data;

  return useQuery<Access>({
    enabled: status === "authenticated" && Boolean(profile?.itemId),
    queryKey: ["access", profile?.itemId],
    queryFn: async () => {
      const workspace = (await getWorkspace()) ?? (await createWorkspace(DEFAULT_WORKSPACE_NAME));
      const workspaceId = String(workspace.itemId ?? "");
      const userId = String(profile?.itemId ?? profile?.email ?? "");
      const displayName = userDisplayName(profile) || String(profile?.email ?? "");
      const members = await listMembers();
      const existing = members.find((member: MemberRecord) => member.userId === userId);
      const fromIam = (profile?.roles ?? []).map(toRoleSlug).find(Boolean);
      // Nobody has been added yet, so the first member to sign in is the
      // workspace's admin; everyone after them starts as a Viewer.
      const role = toRoleSlug(existing?.role) ?? fromIam ?? (members.length === 0 ? "buglens-admin" : "buglens-viewer");

      if (!existing) {
        await upsertMember({ displayName, email: String(profile?.email ?? ""), role, userId, workspaceId });
      } else {
        const last = existing.lastSignInAt ? new Date(existing.lastSignInAt).getTime() : 0;
        if (Date.now() - last > 60 * 60_000) {
          await updateMember(existing.itemId ?? "", { lastSignInAt: new Date().toISOString() }).catch(() => undefined);
        }
      }

      return {
        actor: { id: userId, name: displayName },
        active: existing?.active !== false,
        mfaOn: readMfaState(profile as unknown as Record<string, unknown>),
        role,
        workspace,
        workspaceId
      };
    },
    staleTime: 60_000
  });
}
