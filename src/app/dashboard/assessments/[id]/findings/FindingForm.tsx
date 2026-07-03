"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  SEVERITIES, LIKELIHOODS, IMPACTS, ASSET_TYPES, OWASP_CATEGORIES, label,
} from "@/lib/findings";
import type { FindingState } from "@/actions/findings";

type Values = Partial<{
  title: string; description: string | null; technicalDetails: string | null;
  businessImpact: string | null; remediation: string | null; verificationSteps: string | null;
  severity: string; likelihood: string; impact: string; status: string;
  cvssScore: number | null; cvssVector: string | null; cwe: string | null;
  owaspCategory: string | null; mitreTechnique: string | null;
  affectedAsset: string | null; affectedAssetType: string | null; assetId: string | null;
}>;

export function FindingForm({
  action, values = {}, submitLabel, cancelHref, assets = [],
}: {
  action: (prev: FindingState, formData: FormData) => Promise<FindingState>;
  values?: Values;
  submitLabel: string;
  cancelHref: string;
  assets?: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {} as FindingState);
  const fe = state.fieldErrors ?? {};
  const v = (x: string | number | null | undefined) => (x === null || x === undefined ? "" : String(x));

  return (
    <form action={formAction} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="field">
        <label htmlFor="title">Title *</label>
        <input id="title" name="title" type="text" required defaultValue={v(values.title)} placeholder="e.g. SQL injection in login form" />
        {fe.title && <span className="hint">{fe.title}</span>}
      </div>

      <div className="form-grid">
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
          <input id="cvssScore" name="cvssScore" type="number" step="0.1" min="0" max="10" defaultValue={v(values.cvssScore)} placeholder="9.8" />
          {fe.cvssScore && <span className="hint">{fe.cvssScore}</span>}
        </div>
        <div className="field">
          <label htmlFor="cvssVector">CVSS vector</label>
          <input id="cvssVector" name="cvssVector" type="text" defaultValue={v(values.cvssVector)} placeholder="CVSS:3.1/AV:N/AC:L/…" />
        </div>
        <div className="field">
          <label htmlFor="affectedAsset">Affected asset</label>
          <input id="affectedAsset" name="affectedAsset" type="text" defaultValue={v(values.affectedAsset)} placeholder="app.example.com / 10.0.0.5" />
        </div>
        <div className="field">
          <label htmlFor="affectedAssetType">Asset type</label>
          <select id="affectedAssetType" name="affectedAssetType" defaultValue={values.affectedAssetType ?? ""}>
            <option value="">—</option>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="assetId">Linked asset (optional)</label>
          <select id="assetId" name="assetId" defaultValue={values.assetId ?? ""}>
            <option value="">— none —</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
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
          <input id="cwe" name="cwe" type="text" defaultValue={v(values.cwe)} placeholder="CWE-89" />
        </div>
        <div className="field">
          <label htmlFor="mitreTechnique">MITRE ATT&amp;CK</label>
          <input id="mitreTechnique" name="mitreTechnique" type="text" defaultValue={v(values.mitreTechnique)} placeholder="T1190" />
        </div>
      </div>

      <div className="field"><label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={v(values.description)} placeholder="What the issue is" /></div>
      <div className="field"><label htmlFor="technicalDetails">Technical details</label>
        <textarea id="technicalDetails" name="technicalDetails" defaultValue={v(values.technicalDetails)} placeholder="Reproduction, payloads, requests" /></div>
      <div className="field"><label htmlFor="businessImpact">Business impact</label>
        <textarea id="businessImpact" name="businessImpact" defaultValue={v(values.businessImpact)} placeholder="Impact in business terms" /></div>
      <div className="field"><label htmlFor="remediation">Remediation</label>
        <textarea id="remediation" name="remediation" defaultValue={v(values.remediation)} placeholder="How to fix it" /></div>
      <div className="field"><label htmlFor="verificationSteps">Verification steps</label>
        <textarea id="verificationSteps" name="verificationSteps" defaultValue={v(values.verificationSteps)} placeholder="How to confirm the fix" /></div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        <Link className="btn btn-secondary" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
