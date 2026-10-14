import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";
import { refusal } from "../access/permissions";
import { roleLabel } from "../access/permissions";
import { writeAudit } from "../records/auditApi";
import { isoNow } from "../../shared/domain/format";
import type { Access } from "../access/useAccess";

export type CommentRecord = {
  itemId?: string;
  workspaceId?: string;
  issueId?: string;
  text?: string;
  authorId?: string;
  authorName?: string;
  authorRole?: string;
  time?: string;
  hidden?: boolean;
  hiddenReason?: string;
};

export type LinkedLinkRecord = {
  itemId?: string;
  workspaceId?: string;
  issueId?: string;
  url?: string;
  kind?: string;
  addedById?: string;
  addedByName?: string;
  time?: string;
};

const comments = blocksClient.data.collection<CommentRecord>("Comment", {
  fields: ["workspaceId", "issueId", "text", "authorId", "authorName", "authorRole", "time", "hidden", "hiddenReason"]
});

const links = blocksClient.data.collection<LinkedLinkRecord>("LinkedLink", {
  fields: ["workspaceId", "issueId", "url", "kind", "addedById", "addedByName", "time"]
});

export async function listComments(issueId: string): Promise<CommentRecord[]> {
  const response = await comments.list({ pageNo: 1, pageSize: 300 });
  return withIds(unwrapItems<CommentRecord>(response, "Comments").items)
    .filter((item) => item.issueId === issueId)
    .sort((a, b) => String(a.time ?? "").localeCompare(String(b.time ?? "")));
}

export async function addComment(input: { access: Access; issueId: string; issueKey?: string; text: string }): Promise<void> {
  const denied = refusal(input.access.role, "contribute");
  if (denied) throw denied;
  assertGraphqlOk(await comments.create({
    authorId: input.access.actor.id,
    authorName: input.access.actor.name,
    authorRole: roleLabel(input.access.role),
    hidden: false,
    hiddenReason: "",
    issueId: input.issueId,
    text: input.text.trim(),
    time: isoNow(),
    workspaceId: input.access.workspaceId
  }), "The comment could not be posted.");
  await writeAudit(input.access.workspaceId, input.access.actor, {
    action: "Comment added",
    newValue: `${roleLabel(input.access.role)} comment`,
    oldValue: "",
    recordId: input.issueId,
    recordLabel: input.issueKey || "Issue",
    recordType: "Issue"
  }).catch(() => undefined);
}

/** Only an admin hides a comment, and always with a reason. */
export async function hideComment(input: { access: Access; comment: CommentRecord; reason: string }): Promise<void> {
  const denied = refusal(input.access.role, "manageWorkspace");
  if (denied) throw denied;
  if (!input.reason.trim()) throw new Error("Give a reason for hiding this comment.");
  assertGraphqlOk(await comments.update(String(input.comment.itemId ?? ""), { hidden: true, hiddenReason: input.reason.trim() }), "The comment could not be hidden.");
}

export async function unhideComment(access: Access, comment: CommentRecord): Promise<void> {
  const denied = refusal(access.role, "manageWorkspace");
  if (denied) throw denied;
  assertGraphqlOk(await comments.update(String(comment.itemId ?? ""), { hidden: false, hiddenReason: "" }), "The comment could not be shown again.");
}

export async function listLinks(issueId: string): Promise<LinkedLinkRecord[]> {
  const response = await links.list({ pageNo: 1, pageSize: 300 });
  return withIds(unwrapItems<LinkedLinkRecord>(response, "LinkedLinks").items)
    .filter((item) => item.issueId === issueId)
    .sort((a, b) => String(b.time ?? "").localeCompare(String(a.time ?? "")));
}

export async function addLink(input: { access: Access; issueId: string; kind: string; url: string }): Promise<void> {
  const denied = refusal(input.access.role, "contribute");
  if (denied) throw denied;
  let parsed: URL;
  try {
    parsed = new URL(input.url.trim());
  } catch {
    throw new Error("Enter a full web address, for example https://git.example.com/commit/8f3c1a9.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Enter a full web address, for example https://git.example.com/commit/8f3c1a9.");
  }
  assertGraphqlOk(await links.create({
    addedById: input.access.actor.id,
    addedByName: input.access.actor.name,
    issueId: input.issueId,
    kind: input.kind,
    time: isoNow(),
    url: input.url.trim(),
    workspaceId: input.access.workspaceId
  }), "The link could not be recorded.");
}
