import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { downloadTarget } from "./evidenceApi";
import type { EvidenceRecord } from "./evidenceApi";
import { EmptyState } from "../../shared/ui/EmptyState";
import { Alert } from "../../shared/ui/Alert";
import { formatBytes } from "../../shared/domain/format";
import { failureMessage } from "../../lib/blocks/records";

function kind(item: EvidenceRecord): "image" | "text" | "video" | "file" {
  const mime = String(item.mimeType ?? "");
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (item.textContent) return "text";
  if (mime.startsWith("text/") || /\.(log|txt|json|har|csv|md)$/i.test(String(item.fileName ?? ""))) return "text";
  return "file";
}

/** Centre panel of the evidence viewer. IS-04: an empty preview says so in words. */
export function EvidencePreview({ item }: { item: EvidenceRecord | undefined }) {
  const [url, setUrl] = useState<string | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setUrl(undefined);
    setError("");
    if (!item || !item.fileId) return;
    void (async () => {
      try {
        const target = await downloadTarget(item);
        if (active) setUrl(target.url);
      } catch (caught) {
        if (active) setError(failureMessage(caught, "This file could not be opened."));
      }
    })();
    return () => {
      active = false;
    };
  }, [item]);

  if (!item) {
    return (
      <EmptyState
        description="Upload a screenshot or log, or paste the text you captured."
        icon={<FileText size={28} />}
        title="Evidence will appear here"
      />
    );
  }

  const kindNow = kind(item);

  return (
    <div className="preview">
      <div className="preview-head">
        <strong>{item.fileName || item.evdId || "Pasted text"}</strong>
        <span className="muted">{item.type} · {formatBytes(item.fileSize)}</span>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {kindNow === "text" ? (
        <pre className="mono log-box">{item.textContent || "No text was recorded on this item."}</pre>
      ) : kindNow === "image" && url ? (
        <img alt={item.fileName || item.evdId || "Evidence image"} className="preview-media" src={url} />
      ) : kindNow === "video" && url ? (
        <video className="preview-media" controls src={url} />
      ) : (
        <div className="preview-file">
          <FileText size={28} />
          <div>
            <strong>{item.fileName || "File"}</strong>
            <p className="muted">{item.mimeType || "Unknown type"} · {formatBytes(item.fileSize)}</p>
          </div>
        </div>
      )}
      {url ? (
        <div>
          <a className="secondary-button" download href={url}>
            <Download size={16} /> Download file
          </a>
        </div>
      ) : null}
    </div>
  );
}
