"use client";

import { useActionState } from "react";
import { updateEmailPrefsAction, type FormState } from "@/actions/settings";

const init: FormState = {};

const OPTS: [string, string, string][] = [
  ["findingAssigned", "Finding assigned to me", "When a finding is assigned to you."],
  ["weeklySummary", "Weekly summary", "A weekly digest of your organization's activity."],
  ["productUpdates", "Product updates", "Occasional news about new features."],
];

export function EmailPrefsForm({ prefs }: { prefs: Record<string, boolean> }) {
  const [state, action, pending] = useActionState(updateEmailPrefsAction, init);
  return (
    <div className="card" style={{ marginTop: "1rem", maxWidth: 560 }}>
      <h3 className="chart-title">Email preferences</h3>
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <form action={action}>
        {OPTS.map(([key, label, desc]) => (
          <label key={key} className="pref-row">
            <input type="checkbox" name={key} defaultChecked={!!prefs[key]} />
            <span><strong>{label}</strong><span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>{desc}</span></span>
          </label>
        ))}
        <button className="btn btn-primary" type="submit" disabled={pending} style={{ marginTop: "0.6rem" }}>{pending ? "Saving…" : "Save preferences"}</button>
      </form>
    </div>
  );
}
