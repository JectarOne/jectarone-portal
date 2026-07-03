"use client";

import { useActionState } from "react";
import type { EvidenceState } from "@/actions/evidence";

export function EvidenceForm({
  action,
}: {
  action: (prev: EvidenceState, formData: FormData) => Promise<EvidenceState>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as EvidenceState);

  return (
    <form action={formAction} className="evidence-form">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ev-filename">Filename</label>
          <input id="ev-filename" name="filename" type="text" required placeholder="screenshot-login.png" />
        </div>
        <div className="field">
          <label htmlFor="ev-mime">Type</label>
          <select id="ev-mime" name="mimeType" defaultValue="image/png">
            <option value="image/png">Screenshot (PNG)</option>
            <option value="image/jpeg">Screenshot (JPEG)</option>
            <option value="application/pdf">PDF</option>
            <option value="text/plain">TXT</option>
            <option value="application/json">JSON</option>
            <option value="application/vnd.tcpdump.pcap">PCAP</option>
            <option value="application/zip">ZIP</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ev-size">Size (bytes, optional)</label>
          <input id="ev-size" name="sizeBytes" type="number" min="0" placeholder="102400" />
        </div>
        <div className="field span-2">
          <label htmlFor="ev-note">Note (optional)</label>
          <input id="ev-note" name="note" type="text" placeholder="What this shows" />
        </div>
      </div>
      <button className="btn btn-secondary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add evidence"}</button>
      <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.4rem" }}>
        Records evidence metadata. File upload/storage is a planned integration.
      </p>
    </form>
  );
}
