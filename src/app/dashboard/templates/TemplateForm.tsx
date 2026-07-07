"use client";

import { useActionState } from "react";
import Link from "next/link";
import { SEVERITIES, LIKELIHOODS, IMPACTS, OWASP_CATEGORIES, TEMPLATE_CATEGORIES, label } from "@/lib/findings";
import type { TemplateState } from "@/actions/templates";

type Values = Partial<{
  title: string; category: string; severity: string; likelihood: string; impact: string;
  cvssScore: number | null; cvssVector: string | null; cwe: string | null;
  owaspCategory: string | null; mitreTechnique: string | null;
  description: string | null; businessImpact: string | null; remediation: string | null; references: string | null;
}>;

export function TemplateForm({
  action, values = {}, submitLabel, cancelHref,
}: {
  action: (prev: TemplateState, formData: FormData) => Promise<TemplateState>;
  values?: Values;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as TemplateState);
  const fe = state.fieldErrors ?? {};
  const v = (x: string | number | null | undefined) => (x === null || x === undefined ? "" : String(x));

  return (
    <form action={formAction} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="title">Title *</label>
          <input id="title" name="title" type="text" required defaultValue={v(values.title)} placeholder="e.g. Reflected XSS" />
          {fe.title && <span className="hint">{fe.title}</span>}
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={values.category ?? "Web"}>
            {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="severity">Severity</label>
          <select id="severity" name="severity" defaultValue={values.severity ?? "Medium"}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="likelihood">Likelihood</label>
          <select id="likelihood" name="likelihood" defaultValue={values.likelihood ?? "Medium"}>
            {LIKELIHOODS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="impact">Impact</label>
          <select id="impact" name="impact" defaultValue={values.impact ?? "Medium"}>
            {IMPACTS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cvssScore">CVSS base score (0–10)</label>
          <input id="cvssScore" name="cvssScore" type="number" step="0.1" min="0" max="10" defaultValue={v(values.cvssScore)} placeholder="6.1" />
          {fe.cvssScore && <span className="hint">{fe.cvssScore}</span>}
        </div>
        <div className="field">
          <label htmlFor="cvssVector">CVSS vector</label>
          <input id="cvssVector" name="cvssVector" type="text" defaultValue={v(values.cvssVector)} placeholder="CVSS:3.1/AV:N/…" />
        </div>
        <div className="field">
          <label htmlFor="owaspCategory">OWASP category</label>
          <select id="owaspCategory" name="owaspCategory" defaultValue={values.owaspCategory ?? ""}>
            <option value="">—</option>
            {OWASP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cwe">CWE</label>
          <input id="cwe" name="cwe" type="text" defaultValue={v(values.cwe)} placeholder="CWE-79" />
        </div>
        <div className="field">
          <label htmlFor="mitreTechnique">MITRE ATT&amp;CK</label>
          <input id="mitreTechnique" name="mitreTechnique" type="text" defaultValue={v(values.mitreTechnique)} placeholder="T1059" />
        </div>
      </div>

      <div className="field"><label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={v(values.description)} placeholder="What the issue is" /></div>
      <div className="field"><label htmlFor="businessImpact">Business impact</label>
        <textarea id="businessImpact" name="businessImpact" defaultValue={v(values.businessImpact)} placeholder="Impact in business terms" /></div>
      <div className="field"><label htmlFor="remediation">Remediation</label>
        <textarea id="remediation" name="remediation" defaultValue={v(values.remediation)} placeholder="How to fix it" /></div>
      <div className="field"><label htmlFor="references">References</label>
        <textarea id="references" name="references" defaultValue={v(values.references)} placeholder="Links, CWE/OWASP references" /></div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link className="btn btn-secondary" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
