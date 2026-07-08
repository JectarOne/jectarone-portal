"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EngagementState } from "@/actions/engagements";

type Values = Partial<{
  name: string; clientName: string; scope: string | null;
  startDate: string; endDate: string; leadConsultant: string | null;
}>;

export function EngagementForm({
  action, values = {}, submitLabel, cancelHref,
}: {
  action: (prev: EngagementState, fd: FormData) => Promise<EngagementState>;
  values?: Values;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as EngagementState);
  const fe = state.fieldErrors ?? {};
  const v = (x: string | null | undefined) => x ?? "";

  return (
    <form action={formAction} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="name">Engagement name *</label>
          <input id="name" name="name" type="text" required defaultValue={v(values.name)} placeholder="Q3 External Penetration Test" />
          {fe.name && <span className="hint">{fe.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="clientName">Client *</label>
          <input id="clientName" name="clientName" type="text" required defaultValue={v(values.clientName)} placeholder="Northwind Corp" />
          {fe.clientName && <span className="hint">{fe.clientName}</span>}
        </div>
        <div className="field">
          <label htmlFor="leadConsultant">Lead consultant</label>
          <input id="leadConsultant" name="leadConsultant" type="text" defaultValue={v(values.leadConsultant)} />
        </div>
        <div className="field">
          <label htmlFor="startDate">Start date</label>
          <input id="startDate" name="startDate" type="date" defaultValue={v(values.startDate)} />
        </div>
        <div className="field">
          <label htmlFor="endDate">End date</label>
          <input id="endDate" name="endDate" type="date" defaultValue={v(values.endDate)} />
          {fe.endDate && <span className="hint">{fe.endDate}</span>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="scope">Scope</label>
        <textarea id="scope" name="scope" defaultValue={v(values.scope)} placeholder="Targets, rules of engagement, constraints…" />
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link className="btn btn-secondary" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
