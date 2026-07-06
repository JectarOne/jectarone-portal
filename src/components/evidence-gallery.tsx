import { EmptyState } from "./findings-ui";

function fileKind(mime: string): { tag: string; cls: string } {
  if (mime.startsWith("image/")) return { tag: "IMG", cls: "fi-img" };
  if (mime.includes("pdf")) return { tag: "PDF", cls: "fi-pdf" };
  if (mime.includes("zip")) return { tag: "ZIP", cls: "fi-zip" };
  if (mime.includes("text")) return { tag: "TXT", cls: "fi-txt" };
  return { tag: "FILE", cls: "fi-file" };
}
function fmtBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export type EvidenceItem = {
  id: string; filename: string; mimeType: string; sizeBytes: number | null;
  note: string | null; uploadedByName: string | null; storageKey: string | null;
};

export function EvidenceGallery({
  items, previews, downloads, canWrite, deleteAction,
}: {
  items: EvidenceItem[];
  previews: Record<string, string>;
  downloads: Record<string, number>;
  canWrite: boolean;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  if (items.length === 0) {
    return <EmptyState title="No evidence yet" hint={canWrite ? "Upload screenshots, PDFs or logs below." : "Evidence added by the team will appear here."} />;
  }
  return (
    <div className="evidence-gallery">
      {items.map((ev) => {
        const kind = fileKind(ev.mimeType);
        const dl = downloads[ev.id] ?? 0;
        const preview = previews[ev.id];
        return (
          <div key={ev.id} className="ev-card">
            <div className="ev-thumb">
              {preview
                // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned S3 URL
                ? <img className="ev-thumb-img" src={preview} alt={ev.filename} />
                : <span className={`file-icon ${kind.cls}`} aria-hidden="true">{kind.tag}</span>}
            </div>
            <div className="ev-info">
              <strong className="ev-name" title={ev.filename}>{ev.filename}</strong>
              {ev.note && <div className="ev-note">{ev.note}</div>}
              <div className="ev-meta">
                <span>{fmtBytes(ev.sizeBytes)}</span>
                <span>·</span>
                <span>{ev.uploadedByName ?? "—"}</span>
                <span className="ev-dl" title={`${dl} download${dl === 1 ? "" : "s"}`}>⬇ {dl}</span>
              </div>
            </div>
            <div className="ev-actions">
              {ev.storageKey && (
                <a className="btn btn-secondary btn-sm" href={`/api/v1/evidence/${ev.id}`} target="_blank" rel="noopener noreferrer">Download</a>
              )}
              {canWrite && (
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={ev.id} />
                  <button className="btn btn-danger btn-sm" type="submit">Remove</button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
