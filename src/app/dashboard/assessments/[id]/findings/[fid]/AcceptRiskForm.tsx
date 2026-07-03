"use client";

import { useActionState } from "react";

export function AcceptRiskForm({
  action, defaultReason, defaultUntil,
}: {
  action: (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  defaultReason?: string | null;
  defaultUntil?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, {} as { error?: string });
  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="field">
        <label htmlFor="ar-reason">Business justification *</label>
        <textarea id="ar-reason" name="reason" rows={2} required defaultValue={defaultReason ?? ""} placeholder="Why this risk is being accepted" />
      </div>
      <div className="field">
        <label htmlFor="ar-until">Review / expiry date (optional)</label>
        <input id="ar-until" name="until" type="date" defaultValue={defaultUntil ?? ""} />
      </div>
      <button className="btn btn-secondary" type="submit" disabled={pending}>{pending ? "Saving…" : "Accept risk"}</button>
    </form>
  );
}
