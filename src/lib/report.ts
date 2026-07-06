// Pure aggregation helpers for the executive PDF report. No React/PDF imports so
// they stay unit-testable.

export type ReportFinding = {
  severity: string; likelihood: string; impact: string; status: string;
  cvssScore: number | null; cwe: string | null; owaspCategory: string | null;
  mitreTechnique: string | null; title: string; remediation: string | null;
};

export const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Informational"] as const;
const SEV_RANK: Record<string, number> = { Critical: 5, High: 4, Medium: 3, Low: 2, Informational: 1 };

/** CVSS v3 band for a numeric score. */
export function cvssBand(score: number | null): "Critical" | "High" | "Medium" | "Low" | "None" {
  if (score == null) return "None";
  if (score >= 9) return "Critical";
  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  if (score > 0) return "Low";
  return "None";
}

export function cvssBandCounts(findings: ReportFinding[]): Record<string, number> {
  const c: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, None: 0 };
  for (const f of findings) c[cvssBand(f.cvssScore)]++;
  return c;
}

export function averageCvss(findings: ReportFinding[]): number | null {
  const scored = findings.filter((f) => f.cvssScore != null);
  if (scored.length === 0) return null;
  return Math.round((scored.reduce((s, f) => s + (f.cvssScore ?? 0), 0) / scored.length) * 10) / 10;
}

/** Count findings per category value; returns sorted [value, count] descending. */
export function countBy(findings: ReportFinding[], key: "owaspCategory" | "cwe" | "mitreTechnique"): [string, number][] {
  const map = new Map<string, number>();
  for (const f of findings) {
    const v = f[key];
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** 5×5 likelihood × impact counts. Rows = impact (high→low), cols = likelihood (low→high). */
export const SCALE = ["VeryLow", "Low", "Medium", "High", "VeryHigh"] as const;
export function riskMatrix(findings: ReportFinding[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const f of findings) {
    const k = `${f.impact}|${f.likelihood}`;
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

/** Prioritized recommendations: findings with remediation, most severe first. */
export function prioritizedRecommendations(findings: ReportFinding[], max = 12): { title: string; severity: string; remediation: string }[] {
  return findings
    .filter((f) => f.remediation && f.remediation.trim())
    .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) || (b.cvssScore ?? 0) - (a.cvssScore ?? 0))
    .slice(0, max)
    .map((f) => ({ title: f.title, severity: f.severity, remediation: f.remediation as string }));
}

export function severityCounts(findings: ReportFinding[]): Record<string, number> {
  const c: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 };
  for (const f of findings) if (c[f.severity] != null) c[f.severity]++;
  return c;
}
