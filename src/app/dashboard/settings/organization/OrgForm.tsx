"use client";

import { useActionState } from "react";
import { updateOrgAction, type FormState } from "@/actions/settings";

const init: FormState = {};

export function OrgForm({ name, slug, canEdit }: { name: string; slug: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateOrgAction, init);
  return (
    <div className="card" style={{ marginTop: "1rem", maxWidth: 520 }}>
      <h3 className="chart-title">Organization</h3>
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <form action={action}>
        <div className="field"><label htmlFor="name">Organization name</label><input id="name" name="name" defaultValue={name} required disabled={!canEdit} /></div>
        <div className="field"><label htmlFor="slug">Workspace URL</label><input id="slug" value={slug} disabled /></div>
        {canEdit
          ? <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          : <p className="muted" style={{ fontSize: "0.85rem" }}>Only admins can change organization settings.</p>}
      </form>
    </div>
  );
}
