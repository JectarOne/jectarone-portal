// Pure field-diff for finding edits — no I/O, unit-testable.
// Compares the tracked editable fields and returns the human-relevant changes.

export type FieldChange = { field: string; label: string; from: string | null; to: string | null };

// Editable fields tracked in the change history, with display labels.
export const TRACKED_FIELDS: { key: string; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "technicalDetails", label: "Technical details" },
  { key: "businessImpact", label: "Business impact" },
  { key: "remediation", label: "Remediation" },
  { key: "verificationSteps", label: "Verification steps" },
  { key: "severity", label: "Severity" },
  { key: "likelihood", label: "Likelihood" },
  { key: "impact", label: "Impact" },
  { key: "cvssScore", label: "CVSS score" },
  { key: "cvssVector", label: "CVSS vector" },
  { key: "cwe", label: "CWE" },
  { key: "owaspCategory", label: "OWASP category" },
  { key: "mitreTechnique", label: "MITRE technique" },
  { key: "affectedAsset", label: "Affected asset" },
  { key: "affectedAssetType", label: "Asset type" },
];

/** Normalize a value to a comparable string, or null for empty. */
export function norm(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Return the list of changed tracked fields between two finding-like records. */
export function diffFinding(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const { key, label } of TRACKED_FIELDS) {
    const from = norm(before[key]);
    const to = norm(after[key]);
    if (from !== to) changes.push({ field: key, label, from, to });
  }
  return changes;
}
