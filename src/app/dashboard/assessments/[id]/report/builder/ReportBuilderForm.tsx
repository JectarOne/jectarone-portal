"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { SECTIONS, type SectionKey, type ReportConfigData } from "@/lib/report-config";
import type { ReportConfigState } from "@/actions/report";

const LABELS = new Map(SECTIONS.map((s) => [s.key, s.label] as const));
const LOCKED = new Set(SECTIONS.filter((s) => s.locked).map((s) => s.key));

export function ReportBuilderForm({
  action, initial, executiveSummary, assessmentId,
}: {
  action: (prev: ReportConfigState, fd: FormData) => Promise<ReportConfigState>;
  initial: ReportConfigData;
  executiveSummary: string;
  assessmentId: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ReportConfigState);
  const [order, setOrder] = useState<SectionKey[]>(initial.order);
  const [disabled, setDisabled] = useState<Set<SectionKey>>(new Set(initial.disabled));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }
  function toggle(k: SectionKey) {
    const next = new Set(disabled);
    if (next.has(k)) next.delete(k); else next.add(k);
    setDisabled(next);
  }

  const configJson = JSON.stringify({
    order,
    disabled: [...disabled].filter((k) => !LOCKED.has(k)),
    customRecommendations: null, // filled server-side from the textarea
    appendix: null,
  });

  return (
    <form action={formAction} className="card">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">Report configuration saved.</div>}
      <input type="hidden" name="config" value={configJson} />

      <h3 className="sub">Sections (reorder &amp; toggle)</h3>
      <ul className="report-sections" role="list">
        {order.map((k, i) => {
          const locked = LOCKED.has(k);
          const off = disabled.has(k);
          return (
            <li key={k} className={`report-section-row${off ? " is-off" : ""}`}>
              <span className="rs-reorder">
                <button type="button" className="linkbtn" aria-label={`Move ${LABELS.get(k)} up`} onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
                <button type="button" className="linkbtn" aria-label={`Move ${LABELS.get(k)} down`} onClick={() => move(i, 1)} disabled={i === order.length - 1}>▼</button>
              </span>
              <span className="rs-label">{LABELS.get(k)}</span>
              {locked ? (
                <span className="muted" style={{ fontSize: "0.78rem" }}>always included</span>
              ) : (
                <label className="rs-toggle">
                  <input type="checkbox" checked={!off} onChange={() => toggle(k)} aria-label={`Include ${LABELS.get(k)}`} />
                  {off ? "Excluded" : "Included"}
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <div className="field" style={{ marginTop: "1rem" }}>
        <label htmlFor="executiveSummary">Executive summary</label>
        <textarea id="executiveSummary" name="executiveSummary" rows={5} defaultValue={executiveSummary} placeholder="Written summary for leadership…" />
      </div>
      <div className="field">
        <label htmlFor="customRecommendations">Custom recommendations</label>
        <textarea id="customRecommendations" name="customRecommendations" rows={4} defaultValue={initial.customRecommendations ?? ""} placeholder="Strategic recommendations beyond the per-finding fixes…" />
      </div>
      <div className="field">
        <label htmlFor="appendix">Appendix</label>
        <textarea id="appendix" name="appendix" rows={4} defaultValue={initial.appendix ?? ""} placeholder="Methodology, tooling, scope caveats, references…" />
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save configuration"}</button>
        <Link className="btn btn-secondary" href={`/dashboard/assessments/${assessmentId}/report`} target="_blank">Download PDF</Link>
        <Link className="btn btn-secondary" href={`/dashboard/assessments/${assessmentId}/report?format=html`} target="_blank">View HTML</Link>
        <Link className="btn btn-secondary" href={`/dashboard/assessments/${assessmentId}/report?format=docx`}>Download DOCX</Link>
      </div>
    </form>
  );
}
