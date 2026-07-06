// Security score (0–100) derived from the current open findings. Higher = better.
// Pure + unit-testable; the dashboard passes it the already-open findings.

const WEIGHT: Record<string, number> = {
  Critical: 20, High: 10, Medium: 4, Low: 1, Informational: 0,
};

export type Score = { score: number; grade: "A" | "B" | "C" | "D" | "F"; label: string };

export function securityScore(openFindings: { severity: string }[], overdueCount = 0): Score {
  let penalty = overdueCount * 5;
  for (const f of openFindings) penalty += WEIGHT[f.severity] ?? 2;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const label = { A: "Strong", B: "Good", C: "Fair", D: "At risk", F: "Critical" }[grade];
  return { score, grade, label };
}
