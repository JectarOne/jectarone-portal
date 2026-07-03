"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { presignEvidenceUploadAction, registerEvidenceAction } from "@/actions/evidence";

const ALLOWED = ["image/png", "image/jpeg", "application/pdf", "text/plain", "application/zip"];
const MAX = 25 * 1024 * 1024;

export function EvidenceUploader({ findingId }: { findingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const noteInput = form.elements.namedItem("note") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) { setError("Choose a file."); return; }
    if (!ALLOWED.includes(file.type)) { setError("Unsupported type. Allowed: PNG, JPG, PDF, TXT, ZIP."); return; }
    if (file.size > MAX) { setError("File exceeds the 25 MB limit."); return; }

    setBusy(true);
    try {
      const pre = await presignEvidenceUploadAction(findingId, { filename: file.name, contentType: file.type, size: file.size });
      if ("error" in pre) { setError(pre.error); return; }

      const put = await fetch(pre.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) { setError("Upload failed. Check storage CORS/config."); return; }

      const reg = await registerEvidenceAction(findingId, {
        filename: file.name, mimeType: file.type, sizeBytes: file.size,
        storageKey: pre.key, note: noteInput.value || undefined,
      });
      if (reg.error) { setError(reg.error); return; }

      form.reset();
      router.refresh();
    } catch {
      setError("Something went wrong during upload.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="evidence-form">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="ev-file">File (PNG, JPG, PDF, TXT, ZIP · max 25 MB)</label>
          <input id="ev-file" name="file" type="file" accept=".png,.jpg,.jpeg,.pdf,.txt,.zip,image/png,image/jpeg,application/pdf,text/plain,application/zip" required />
        </div>
        <div className="field span-2">
          <label htmlFor="ev-upnote">Note (optional)</label>
          <input id="ev-upnote" name="note" type="text" placeholder="What this shows" />
        </div>
      </div>
      <button className="btn btn-secondary" type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload evidence"}</button>
    </form>
  );
}
