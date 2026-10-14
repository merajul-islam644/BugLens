import { useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { can } from "../access/permissions";
import { formatDateTime } from "../../shared/domain/format";
import type { Access } from "../access/useAccess";
import { addComment, addLink, hideComment, unhideComment } from "./discussionApi";
import type { CommentRecord } from "./discussionApi";

export function DiscussionPanel({ access, comments, issueId, issueKey, onChanged }: {
  access: Access;
  comments: CommentRecord[];
  issueId: string;
  issueKey?: string;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [hiding, setHiding] = useState<string | undefined>();
  const [reason, setReason] = useState("");
  const canComment = can(access.role, "contribute");
  const isAdmin = can(access.role, "manageWorkspace");

  async function act(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The comment could not be saved.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Discussion</h3></div>
      {comments.length === 0 ? <p className="muted">No comments yet.</p> : (
        <ul className="feed">
          {comments.map((comment) => (
            <li key={String(comment.itemId)}>
              <span>
                <strong>{comment.authorName}</strong>{" "}
                <span className="muted">({comment.authorRole}) — {formatDateTime(comment.time)}</span>
              </span>
              {!comment.hidden ? <span>{comment.text}</span> : <span className="field-hint">Hidden by an admin — {comment.hiddenReason}</span>}
              {!comment.hidden && isAdmin ? (
                <span className="row-actions">
                  <button className="link-button" onClick={() => { setHiding(hiding === String(comment.itemId) ? undefined : String(comment.itemId)); setReason(""); }}>Hide</button>
                </span>
              ) : null}
              {comment.hidden && isAdmin ? (
                <span className="row-actions">
                  <button className="link-button" onClick={() => void act(() => unhideComment(access, comment))}>Show again</button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {hiding ? (
        <div className="form-grid">
          <label className="form-field span-all"><span>Reason for hiding</span>
            <input autoFocus onChange={(event) => setReason(event.target.value)} placeholder="Off-topic, credential shared, …" value={reason} />
          </label>
          <div className="form-actions span-all">
            <button className="secondary-button" onClick={() => setHiding(undefined)}>Cancel</button>
            <button
              className="primary-button danger"
              disabled={!reason.trim()}
              onClick={() => {
                const target = comments.find((item) => String(item.itemId) === hiding);
                if (!target) return;
                const comment = target;
                void act(async () => {
                  await hideComment({ access, comment, reason });
                  setHiding(undefined);
                });
              }}
            >
              Hide comment
            </button>
          </div>
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {canComment ? (
        <div className="form-actions">
          <label className="form-field" style={{ flexGrow: 1 }}><span>Add a comment</span>
            <input onChange={(event) => setDraft(event.target.value)} placeholder="What do you see, or what should happen next?" value={draft} />
          </label>
          <button
            className="primary-button"
            disabled={!draft.trim()}
            onClick={() => {
              const text = draft;
              void act(async () => {
                await addComment({ access, issueId, issueKey, text });
                setDraft("");
              });
            }}
          >
            Comment
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LinksPanel({ access, issueId, links, onChanged }: {
  access: Access;
  issueId: string;
  links: { addedByName?: string; itemId?: string; kind?: string; time?: string; url?: string }[];
  onChanged: () => void;
}) {
  const [kind, setKind] = useState("Commit");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const canContribute = can(access.role, "contribute");

  async function add() {
    setError("");
    try {
      await addLink({ access, issueId, kind, url });
      setUrl("");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The link could not be recorded.");
    }
  }

  return (
    <div className="panel">
      <div className="panel-title"><h3>Commit and pull request links</h3></div>
      {links.length === 0 ? <p className="muted">No links recorded yet.</p> : (
        <ul className="feed">
          {links.map((link) => (
            <li key={String(link.itemId)}>
              <span className="badge badge-neutral">{link.kind}</span>
              <a className="text-link" href={link.url} rel="noreferrer" target="_blank">{link.url}</a>
              <span className="muted">by {link.addedByName} — {formatDateTime(link.time)}</span>
            </li>
          ))}
        </ul>
      )}
      {canContribute ? (
        <div className="form-grid">
          <label className="form-field"><span>Kind</span>
            <select onChange={(event) => setKind(event.target.value)} value={kind}>
              <option>Commit</option>
              <option>Pull request</option>
            </select>
          </label>
          <label className="form-field"><span>Address</span>
            <input onChange={(event) => setUrl(event.target.value)} placeholder="https://git.example.com/commit/8f3c1a9" value={url} />
          </label>
          {error ? <div className="span-all"><Alert tone="error">{error}</Alert></div> : null}
          <div className="form-actions span-all">
            <button className="primary-button" disabled={!url.trim()} onClick={() => void add()}>Add link</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
