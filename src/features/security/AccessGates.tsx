import { Alert } from "../../shared/ui/Alert";
import { BrandMark } from "../../shared/ui/BrandMark";
import { useAuth } from "../../app/providers/AuthProvider";
import { MfaEnrollPanel } from "./MfaEnrollPanel";

function GateCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><BrandMark /> BugLens</div>
        {children}
      </div>
    </div>
  );
}

/** WS-02 AC1 — a deactivated member is refused at the door, in words. */
export function DeactivatedScreen({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { logout } = useAuth();

  return (
    <GateCard>
      <h2>Account deactivated</h2>
      <p>Your account has been deactivated. Contact your workspace administrator.</p>
      <button
        className="primary-button auth-submit"
        onClick={() => {
          void logout();
          onNavigate("/login");
        }}
      >
        Sign out
      </button>
    </GateCard>
  );
}

/** AU-03 AC1 — required multi-factor is set up before BugLens opens. */
export function MfaGate({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { logout } = useAuth();

  return (
    <GateCard>
      <h2>Multi-factor required</h2>
      <p>Your workspace requires multi-factor authentication. Set it up to continue.</p>
      <MfaEnrollPanel onDone={() => window.location.assign("/")} />
      <Alert tone="info">
        If you cannot use an authenticator app, ask your workspace administrator for help.
      </Alert>
      <button
        className="secondary-button auth-submit"
        onClick={() => {
          void logout();
          onNavigate("/login");
        }}
      >
        Sign out
      </button>
    </GateCard>
  );
}
