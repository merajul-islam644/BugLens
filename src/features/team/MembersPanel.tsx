import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { Modal } from "../../shared/ui/Modal";
import { ROLE_LABELS, ROLE_ORDER, isRoleSlug } from "../access/permissions";
import type { RoleSlug } from "../access/permissions";
import { failureMessage } from "../../lib/blocks/records";
import { formatDateTime } from "../../shared/domain/format";
import { changeMemberRole, inviteMember, setMemberActive, setRequireMfa } from "./teamApi";
import { INVITATION_DAYS, isExpired, listInvitations, listMembers } from "../workspace/workspaceApi";
import type { InvitationRecord, MemberRecord, WorkspaceRecord } from "../workspace/workspaceApi";
import type { Access } from "../access/useAccess";

function inviteStatus(invitation: InvitationRecord): string {
  if (invitation.status === "Accepted") return "Accepted";
  return isExpired(invitation) ? "Expired" : String(invitation.status ?? "Pending");
}

function InviteDialog({ access, onClose }: { access: Access; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleSlug>("buglens-viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await inviteMember({ access, email, role, workspace: access.workspace });
      await queryClient.invalidateQueries({ queryKey: ["team"] });
      onClose();
    } catch (caught) {
      setError(failureMessage(caught, "The invitation could not be sent."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Invite a member">
      <label className="form-field">
        <span>Email</span>
        <input autoFocus onChange={(event) => setEmail(event.target.value)} placeholder="name@company.example" type="email" value={email} />
      </label>
      <label className="form-field">
        <span>Role</span>
        <select onChange={(event) => setRole(event.target.value as RoleSlug)} value={role}>
          {ROLE_ORDER.map((slug) => <option key={slug} value={slug}>{ROLE_LABELS[slug]}</option>)}
        </select>
      </label>
      <p className="field-hint">The invitation link expires after {INVITATION_DAYS} days. New members arrive only by invitation.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="modal-actions">
        <button className="icon-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" disabled={busy || !email.includes("@")} onClick={() => void submit()}>
          {busy ? "Sending..." : "Send invitation"}
        </button>
      </div>
    </Modal>
  );
}

export function MembersPanel({ access }: { access: Access }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const team = useQuery({
    queryKey: ["team"],
    queryFn: async () => ({ invitations: await listInvitations(), members: await listMembers() })
  });

  async function act(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    } catch (caught) {
      setError(failureMessage(caught, "That change did not go through."));
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <RequireMfaCard access={access} onSaved={() => void queryClient.invalidateQueries({ queryKey: ["access"] })} setError={setError} />
      <div className="toolbar">
        <div className="panel-title"><h3>Members</h3></div>
        <div className="toolbar-actions">
          <button className="primary-button" onClick={() => setInviteOpen(true)}>Invite member</button>
        </div>
      </div>
      {team.isLoading ? <p className="muted">Loading members...</p> : null}
      {team.isError ? <ErrorState message={failureMessage(team.error, "The member list could not be read.")} /> : null}
      {team.data ? (
        <DataTable
          columns={[
            { key: "name", header: "Member", render: (m: MemberRecord) => <strong>{m.displayName || m.email || "—"}</strong> },
            { key: "email", header: "Email", render: (m: MemberRecord) => m.email || "—" },
            {
              key: "role",
              header: "Role",
              render: (m: MemberRecord) =>
                isRoleSlug(m.role) ? (
                  <select
                    aria-label={`Role for ${m.displayName || m.email}`}
                    disabled={m.userId === access.actor.id}
                    onChange={(event) => void act(() => changeMemberRole({ access, member: m, role: event.target.value as RoleSlug }))}
                    value={m.role}
                  >
                    {ROLE_ORDER.map((slug) => <option key={slug} value={slug}>{ROLE_LABELS[slug]}</option>)}
                  </select>
                ) : (
                  ROLE_LABELS[toRoleOrViewer(m.role)]
                )
            },
            { key: "status", header: "Status", render: (m: MemberRecord) => (m.active === false ? <span className="badge badge-danger">Deactivated</span> : <span className="badge badge-good">Active</span>) },
            { key: "last", header: "Last signed in", render: (m: MemberRecord) => formatDateTime(m.lastSignInAt) },
            {
              key: "actions",
              header: "",
              render: (m: MemberRecord) =>
                m.userId === access.actor.id ? null : (
                  <div className="row-actions">
                    {m.active === false ? (
                      <button className="secondary-button" onClick={() => void act(() => setMemberActive({ access, active: true, member: m }))}>Reactivate</button>
                    ) : (
                      <button className="secondary-button danger" onClick={() => void act(() => setMemberActive({ access, active: false, member: m }))}>Deactivate</button>
                    )}
                  </div>
                )
            }
          ]}
          rows={team.data.members}
        />
      ) : null}

      <div className="panel-title" style={{ marginTop: 8 }}><h3>Invitations</h3></div>
      {team.data && team.data.invitations.length === 0 ? (
        <p className="muted">No invitations sent yet.</p>
      ) : null}
      {team.data && team.data.invitations.length > 0 ? (
        <DataTable
          columns={[
            { key: "email", header: "Email", render: (i: InvitationRecord) => <strong>{i.email}</strong> },
            { key: "role", header: "Role", render: (i: InvitationRecord) => ROLE_LABELS[toRoleOrViewer(i.role)] },
            { key: "sent", header: "Sent", render: (i: InvitationRecord) => formatDateTime(i.invitedAt) },
            { key: "expires", header: "Expires", render: (i: InvitationRecord) => formatDateTime(i.expiresAt) },
            {
              key: "status",
              header: "Status",
              render: (i: InvitationRecord) => {
                const status = inviteStatus(i);
                const tone = status === "Accepted" ? "badge-good" : status === "Expired" ? "badge-danger" : "badge-neutral";
                return <span className={`badge ${tone}`}>{status}</span>;
              }
            }
          ]}
          rows={[...team.data.invitations].sort((a, b) => String(b.invitedAt ?? "").localeCompare(String(a.invitedAt ?? "")))}
        />
      ) : null}

      {inviteOpen ? <InviteDialog access={access} onClose={() => setInviteOpen(false)} /> : null}
    </div>
  );
}

function RequireMfaCard({ access, onSaved, setError }: { access: Access; onSaved: () => void; setError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const required = access.workspace.requireMfa === true;

  async function toggle(on: boolean) {
    setBusy(true);
    setError("");
    try {
      await setRequireMfa({ on, workspace: access.workspace as WorkspaceRecord });
      onSaved();
    } catch (caught) {
      setError(failureMessage(caught, "The multi-factor requirement could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Multi-factor authentication</h3></div>
      <p style={{ margin: 0 }}>
        {required
          ? "Required for everyone. Members without it are asked to set it up before BugLens opens."
          : "Optional. Members may turn it on for their own account from their user menu."}
      </p>
      <div className="form-actions">
        <button className="secondary-button" disabled={busy} onClick={() => void toggle(!required)}>
          {busy ? "Saving..." : required ? "No longer required" : "Require for everyone"}
        </button>
      </div>
    </div>
  );
}

function toRoleOrViewer(role: unknown): RoleSlug {
  return isRoleSlug(role) ? role : "buglens-viewer";
}
