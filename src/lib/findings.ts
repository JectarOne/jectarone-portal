// Finding enum-like constants, labels, and risk-matrix logic. Validated strings (portable).

export const SEVERITIES = ["Critical", "High", "Medium", "Low", "Informational"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_STATUSES = ["Open", "InProgress", "Fixed", "Verified", "AcceptedRisk", "FalsePositive"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const LIKELIHOODS = ["VeryLow", "Low", "Medium", "High", "VeryHigh"] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

export const IMPACTS = ["VeryLow", "Low", "Medium", "High", "VeryHigh"] as const;
export type Impact = (typeof IMPACTS)[number];

export const ASSET_TYPES = ["Domain", "URL", "IP", "Server", "ActiveDirectory", "Azure", "AWS", "API", "MobileApp"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const OWASP_CATEGORIES = [
  "A01 Broken Access Control",
  "A02 Cryptographic Failures",
  "A03 Injection",
  "A04 Insecure Design",
  "A05 Security Misconfiguration",
  "A06 Vulnerable Components",
  "A07 Authentication Failures",
  "A08 Software Integrity Failures",
  "A09 Logging Failures",
  "A10 SSRF",
] as const;

const LABELS: Record<string, string> = {
  InProgress: "In Progress",
  AcceptedRisk: "Accepted Risk",
  FalsePositive: "False Positive",
  VeryLow: "Very Low",
  VeryHigh: "Very High",
  ActiveDirectory: "Active Directory",
  MobileApp: "Mobile App",
  Informational: "Informational",
};
export function label(v: string): string {
  return LABELS[v] ?? v;
}

export function severityClass(s: string): string {
  return `sev-${String(s).toLowerCase()}`;
}
export function findingStatusClass(s: string): string {
  return `fstatus-${String(s).toLowerCase()}`;
}

const SCALE: Record<string, number> = { VeryLow: 1, Low: 2, Medium: 3, High: 4, VeryHigh: 5 };

export type RiskLevel = "VeryLow" | "Low" | "Medium" | "High" | "Critical";

/** Risk = Likelihood × Impact on a 5×5 matrix → score 1..25 + banded level. */
export function risk(likelihood: string, impact: string): { score: number; level: RiskLevel; className: string } {
  const l = SCALE[likelihood] ?? 3;
  const i = SCALE[impact] ?? 3;
  const score = l * i;
  let level: RiskLevel;
  if (score >= 20) level = "Critical";
  else if (score >= 12) level = "High";
  else if (score >= 6) level = "Medium";
  else if (score >= 3) level = "Low";
  else level = "VeryLow";
  return { score, level, className: `risk-${level.toLowerCase()}` };
}

/** Numeric weight of a severity, for "average risk"/sorting. */
export function severityWeight(s: string): number {
  return { Critical: 5, High: 4, Medium: 3, Low: 2, Informational: 1 }[s] ?? 0;
}
