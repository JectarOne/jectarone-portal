"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ASSESSMENT_TYPES, ASSESSMENT_STATUSES, typeLabel, statusLabel } from "@/lib/assessments";
import type { AssessmentState } from "@/actions/assessments";

type Values = {
  clientName?: string;
  type?: string;
  status?: string;
  scope?: string | null;
  startDate?: string | null; // yyyy-mm-dd
  endDate?: string | null;
  leadConsultant?: string | null;
  executiveSummary?: string | null;
  notes?: string | null;
  engagementId?: string | null;
};

export function AssessmentForm({
  action,
  values = {},
  submitLabel,
  cancelHref,
  engagements = [],
}: {
  action: (prev: AssessmentState, formData: FormData) => Promise<AssessmentState>;
  values?: Values;
  submitLabel: string;
  cancelHref: string;
  engagements?: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {} as AssessmentState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="clientName">Client name *</label>
          <input id="clientName" name="clientName" type="text" required defaultValue={values.clientName ?? ""} placeholder="Client organization" />
          {fe.clientName && <span className="hint">{fe.clientName}</span>}
        </div>

        <div className="field">
          <label htmlFor="type">Assessment type *</label>
          <select id="type" name="type" defaultValue={values.type ?? "Web"}>
            {ASSESSMENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={values.status ?? "Draft"}>
            {ASSESSMENT_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="startDate">Start date</label>
          <input id="startDate" name="startDate" type="date" defaultValue={values.startDate ?? ""} />
        </div>

        <div className="field">
          <label htmlFor="endDate">End date</label>
          <input id="endDate" name="endDate" type="date" defaultValue={values.endDate ?? ""} />
          {fe.endDate && <span className="hint">{fe.endDate}</span>}
        </div>

        <div className="field span-2">
          <label htmlFor="engagementId">Engagement</label>
          <select id="engagementId" name="engagementId" defaultValue={values.engagementId ?? ""}>
            <option value="">— none —</option>
            {engagements.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div className="field span-2">
          <label htmlFor="leadConsultant">Lead consultant</label>
          <input id="leadConsultant" name="leadConsultant" type="text" defaultValue={values.leadConsultant ?? ""} placeholder="Name" />
        </div>

        <div className="field span-2">
          <label htmlFor="scope">Scope</label>
          <textarea id="scope" name="scope" defaultValue={values.scope ?? ""} placeholder="Systems, URLs, IP ranges, or applications in scope" />
        </div>

        <div className="field span-2">
          <label htmlFor="executiveSummary">Executive summary</label>
          <textarea id="executiveSummary" name="executiveSummary" defaultValue={values.executiveSummary ?? ""} placeholder="Plain-language overview for leadership" />
        </div>

        <div className="field span-2">
          <label htmlFor="notes">Internal notes</label>
          <textarea id="notes" name="notes" defaultValue={values.notes ?? ""} placeholder="Working notes (not client-facing)" />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link className="btn btn-secondary" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
