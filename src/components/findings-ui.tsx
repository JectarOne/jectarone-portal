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
