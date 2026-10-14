import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { Alert } from "../../shared/ui/Alert";
import { PageHeader } from "../../shared/ui/PageHeader";
import { MfaEnrollPanel } from "./MfaEnrollPanel";
import { readMfaState } from "../access/useAccess";
import { useCurrentUser } from "../profile/useCurrentUser";
import { failureMessage } from "../../lib/blocks/records";

function asRecord(response: unknown): Record<string, unknown> {
  const record = (response ?? {}) as Record<string, unknown>;
  return (record.data ?? record) as Record<string, unknown>;
}

/** AU-03 — the signed-in member's own multi-factor state. */
export function MfaSettingsPage() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [codeList, setCodeList] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mfaOn = readMfaState(me.data?.data as unknown as Record<string, unknown> | undefined);

  const backupCodes = useQuery({
    enabled: mfaOn,
    queryFn: () => blocksClient.mfa.backupCodes.list(),
    queryKey: ["mfa", "backup-codes"]
  });
  const remaining = asRecord(backupCodes.data)?.remaining;

  async function run(action: () => Promise<unknown>, done: () => void) {
    setBusy(true);
    setError("");
    try {
      const response = await action();
      done();
    } catch (caught) {
      setError(failureMessage(caught, "That change did not go through."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader subtitle="The second step BugLens asks for at sign-in." title="Multi-factor authentication" />
      <div className="panel">
        <div className="panel-title"><h3>Status</h3></div>
        {me.isFetching ? (
          <p className="muted">Reading your account security state...</p>
        ) : mfaOn ? (
          <p style={{ margin: 0 }}>
            Multi-factor is on for your account.{" "}
            {typeof remaining === "number" ? `Unused recovery codes: ${remaining}.` : ""}
          </p>
        ) : (
          <p style={{ margin: 0 }}>Multi-factor is not set up yet.</p>
        )}
      </div>

      {mfaOn ? (
        <div className="panel">
          <div className="panel-title"><h3>Recovery codes</h3></div>
          <p className="muted">Codes are shown once, when they are created. Store them somewhere outside BugLens.</p>
          {codeList.length > 0 ? <pre className="mono" style={{ margin: 0 }}>{codeList.join("\n")}</pre> : null}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void run(
                  async () => {
                    const generated = await blocksClient.mfa.backupCodes.generate();
                    const payload = asRecord(generated);
                    const list = payload.backupCodes ?? payload.codes ?? payload.data;
                    if (Array.isArray(list)) setCodeList(list.map(String));
                    return generated;
                  },
                  () => {
                    void queryClient.invalidateQueries({ queryKey: ["mfa", "backup-codes"] });
                  }
                )
              }
            >
              Generate recovery codes
            </button>
          </div>
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {!me.isFetching && !mfaOn ? (
        <div className="panel">
          <div className="panel-title"><h3>Turn on multi-factor</h3></div>
          <MfaEnrollPanel onDone={() => { void queryClient.invalidateQueries({ queryKey: ["iam", "me"] }); void queryClient.invalidateQueries({ queryKey: ["access"] }); }} />
        </div>
      ) : null}

      {mfaOn ? (
        <div className="panel">
          <div className="panel-title"><h3>Turn off multi-factor</h3></div>
          <p className="muted">Only do this if your workspace does not require it — you would sign in with your password alone.</p>
          <div className="form-actions">
            <button
              className="secondary-button danger"
              disabled={busy}
              onClick={() => void run(() => blocksClient.mfa.disable(), () => {
                void queryClient.invalidateQueries({ queryKey: ["iam", "me"] });
              })}
            >
              Turn off
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
