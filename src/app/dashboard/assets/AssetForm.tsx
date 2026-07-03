"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ASSET_TYPES, label } from "@/lib/findings";
import type { AssetState } from "@/actions/assets";

export function AssetForm({
  action, values = {}, submitLabel, cancelHref,
}: {
  action: (prev: AssetState, formData: FormData) => Promise<AssetState>;
  values?: { name?: string; type?: string; identifier?: string | null; notes?: string | null };
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as AssetState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="a-name">Name *</label>
          <input id="a-name" name="name" type="text" required defaultValue={values.name ?? ""} placeholder="e.g. Client web app" />
          {fe.name && <span className="hint">{fe.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="a-type">Type</label>
          <select id="a-type" name="type" defaultValue={values.type ?? "URL"}>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="a-identifier">Identifier</label>
          <input id="a-identifier" name="identifier" type="text" defaultValue={values.identifier ?? ""} placeholder="app.example.com / 10.0.0.5" />
        </div>
        <div className="field span-2">
          <label htmlFor="a-notes">Notes</label>
          <textarea id="a-notes" name="notes" defaultValue={values.notes ?? ""} placeholder="Environment, owner, criticality…" />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link className="btn btn-secondary" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
