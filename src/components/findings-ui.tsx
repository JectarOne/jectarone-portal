import { label, severityClass, findingStatusClass, risk, LIKELIHOODS, IMPACTS } from "@/lib/findings";

export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`badge ${severityClass(severity)}`}>{label(severity)}</span>;
}

export function FindingStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${findingStatusClass(status)}`}>{label(status)}</span>;
}

export function RiskBadge({ likelihood, impact }: { likelihood: string; impact: string }) {
  const r = risk(likelihood, impact);
  return <span className={`badge ${r.className}`}>Risk {r.score} · {r.level}</span>;
}

/** CVSS band per CVSS v3: 0 None, 0.1–3.9 Low, 4–6.9 Medium, 7–8.9 High, 9+ Critical. */
export function cvssBand(score: number): string {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "none";
}

export function CvssBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="muted">—</span>;
  const band = cvssBand(score);
  return (
    <span className={`cvss-badge cvss-${band}`} title={`CVSS ${score.toFixed(1)} (${band})`}>
      {score.toFixed(1)}
    </span>
  );
}

/** Small labelled metadata pill (CWE, OWASP, MITRE, etc.). Renders nothing when empty. */
export function MetaPill({ label: k, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <span className="pill">
      <span className="pill-k">{k}</span>
      <span className="pill-v">{value}</span>
    </span>
  );
}

/** Consistent empty state: heading, hint, optional action node. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/** Compact 5×5 risk matrix; highlights the cell for the given likelihood × impact. */
export function RiskMatrix({ likelihood, impact }: { likelihood: string; impact: string }) {
  const impactsTopDown = [...IMPACTS].reverse(); // VeryHigh at top
  return (
    <div className="riskmatrix" role="img" aria-label={`Risk matrix: likelihood ${label(likelihood)}, impact ${label(impact)}`}>
      <div className="rm-corner" />
      {LIKELIHOODS.map((l) => (
        <div key={`h-${l}`} className="rm-axis rm-axis-x">{label(l)}</div>
      ))}
      {impactsTopDown.map((im) => (
        <RiskRow key={im} impact={im} selL={likelihood} selI={impact} />
      ))}
    </div>
  );
}

function RiskRow({ impact, selL, selI }: { impact: string; selL: string; selI: string }) {
  return (
    <>
      <div className="rm-axis rm-axis-y">{label(impact)}</div>
      {LIKELIHOODS.map((l) => {
        const r = risk(l, impact);
        const selected = l === selL && impact === selI;
        return (
          <div key={`${impact}-${l}`} className={`rm-cell ${r.className}${selected ? " rm-selected" : ""}`}>
            {selected ? r.score : ""}
          </div>
        );
      })}
    </>
  );
}
