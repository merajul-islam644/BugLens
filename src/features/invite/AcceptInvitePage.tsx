import { useEffect, useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { BrandMark } from "../../shared/ui/BrandMark";
import { failureMessage } from "../../lib/blocks/records";
import { acceptInvitation, markInvitationExpired } from "../team/teamApi";
import { isExpired, listInvitations } from "../workspace/workspaceApi";
import type { InvitationRecord } from "../workspace/workspaceApi";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "expired" }
  | { kind: "used" }
  | { kind: "ready"; invitation: InvitationRecord }
  | { kind: "done" };

/** AU-02 — the invited person's own page: set a password, then sign in. */
export function AcceptInvitePage({ token, onNavigate }: { onNavigate: (path: string) => void; token: string | undefined }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const invitations = await listInvitations();
        if (cancelled) return;
        const invitation = invitations.find((item) => item.token && item.token === token);
        if (!invitation) return setState({ kind: "missing" });
        if (invitation.status === "Accepted") return setState({ kind: "used" });
        if (isExpired(invitation)) {
          await markInvitationExpired(invitation).catch(() => undefined);
          return setState({ kind: "expired" });
        }
        setState({ invitation, kind: "ready" });
      } catch {
        if (!cancelled) setState({ kind: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit() {
    if (state.kind !== "ready") return;
    if (password.length < 8) return setError("Use at least 8 characters for the password.");
    if (password !== confirm) return setError("The two passwords do not match.");
    if (!firstName.trim()) return setError("Enter your first name.");

    setBusy(true);
    setError("");
    try {
      await acceptInvitation({ firstName, invitation: state.invitation, lastName, password });
      setState({ kind: "done" });
    } catch (caught) {
      setError(failureMessage(caught, "The account could not be created."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><BrandMark /> BugLens</div>
        {state.kind === "loading" ? <p>You have been invited. Checking the invitation...</p> : null}
        {state.kind === "missing" ? (
          <>
            <h2>Invitation not found</h2>
            <p>This invitation does not exist in this workspace. Ask your workspace administrator to send it again.</p>
          </>
        ) : null}
        {state.kind === "expired" ? (
          <>
            <h2>Invitation expired</h2>
            <p>This invitation has expired. Ask your workspace administrator to send a new one.</p>
          </>
        ) : null}
        {state.kind === "used" ? (
          <>
            <h2>Invitation already used</h2>
            <p>This invitation has already been accepted. Sign in with the account you created.</p>
            <button className="primary-button auth-submit" onClick={() => onNavigate("/login")}>Go to sign in</button>
          </>
        ) : null}
        {state.kind === "done" ? (
          <>
            <h2>Account ready</h2>
            <p>Your account is set up. Sign in to open BugLens.</p>
            <button className="primary-button auth-submit" onClick={() => onNavigate("/login")}>Go to sign in</button>
          </>
        ) : null}
        {state.kind === "ready" ? (
          <>
            <h2>Join {state.invitation.email ? `as ${state.invitation.email}` : "BugLens"}</h2>
            <p>Your administrator invited you to this workspace. Choose a password to finish setting up your account.</p>
            <label className="form-field">
              <span>First name</span>
              <input autoFocus onChange={(event) => setFirstName(event.target.value)} value={firstName} />
            </label>
            <label className="form-field">
              <span>Last name</span>
              <input onChange={(event) => setLastName(event.target.value)} value={lastName} />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </label>
            <label className="form-field">
              <span>Confirm password</span>
              <input onChange={(event) => setConfirm(event.target.value)} type="password" value={confirm} />
            </label>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <button className="primary-button auth-submit" disabled={busy} onClick={() => void submit()}>
              {busy ? "Setting up..." : "Set password and join"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
