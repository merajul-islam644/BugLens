import { blocksClient } from "../../lib/blocks/client";

/** Push an inbox notification; a failing notifier never breaks the action behind it. */
export function notifyUsers(userIds: string[], text: string): void {
  const targets = userIds.filter(Boolean);
  if (targets.length === 0) return;
  blocksClient.notifier.notify({ denormalizedPayload: text, userIds: targets }).catch(() => undefined);
}

/** Mail is best-effort everywhere: delivery problems never break the action. */
export function sendMailBestEffort(request: {
  bodyDataContext?: Record<string, string>;
  purpose: string;
  subjectDataContext?: Record<string, string>;
  to: string[];
}): void {
  if (request.to.length === 0) return;
  blocksClient.mail
    .send({ language: "en", ...request })
    .catch(() => undefined);
}

export function emailAssignment(input: { assignerName: string; email: string; issueKey: string; issueTitle: string }): void {
  sendMailBestEffort({
    bodyDataContext: { assignerName: input.assignerName, issueKey: input.issueKey, issueTitle: input.issueTitle },
    purpose: "buglens-assignment",
    subjectDataContext: { issueKey: input.issueKey },
    to: [input.email]
  });
}

export function emailRetest(input: { email: string; environmentName: string; issueKey: string; ranBy: string; result: string; runNo: number }): void {
  sendMailBestEffort({
    bodyDataContext: {
      environmentName: input.environmentName,
      issueKey: input.issueKey,
      ranBy: input.ranBy,
      result: input.result,
      runNo: String(input.runNo)
    },
    purpose: "buglens-retest",
    subjectDataContext: { issueKey: input.issueKey, result: input.result },
    to: [input.email]
  });
}
