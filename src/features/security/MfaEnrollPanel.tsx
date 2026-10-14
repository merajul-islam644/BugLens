import { useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { Alert } from "../../shared/ui/Alert";
import { failureMessage } from "../../lib/blocks/records";

function pickSecret(payload: Record<string, unknown> | undefined): string {
  const data = (payload?.data ?? payload) as Record<string, unknown> | undefined;
  for (const key of ["sharedKey", "secret", "otpAuthUrl", "url", "qrCodeUrl", "qrCode"]) {
    const value = data?.[key] ?? payload?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

/**
 * AU-03 — a member enrolls their own authenticator app. The key IAM returns is
 * shown as text to type into the app; there is no camera step in BugLens.
 */
export function MfaEnrollPanel({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const setup = await blocksClient.mfa.totp.setup();
      setSecret(pickSecret(setup as unknown as Record<string, unknown>));
    } catch (caught) {
      setError(failureMessage(caught, "Enrolment could not be started. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      await blocksClient.mfa.totp.verifySetup({ code: code.trim() });
      onDone();
    } catch (caught) {
      setError(failureMessage(caught, "That code was not accepted. Check your authenticator app and try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {!secret ? (
        <>
          <p className="muted">BugLens uses an authenticator app. Start here to get a key, then enter the six-digit code it produces.</p>
          <div>
            <button className="primary-button" disabled={busy} onClick={() => void start()}>
              {busy ? "Starting..." : "Start enrolment"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="form-field">
            <span>Key for your authenticator app</span>
            <input className="mono" readOnly value={secret} onFocus={(event) => event.currentTarget.select()} />
          </div>
          <label className="form-field">
            <span>Six-digit code</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={busy || code.trim().length < 6} onClick={() => void verify()}>
              {busy ? "Verifying..." : "Verify and turn on"}
            </button>
          </div>
        </>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
