// Assessment enum-like constants + display helpers. Kept as validated strings
// (portable across DBs, matches the Role pattern).

export const ASSESSMENT_TYPES = [
  "Web",
  "Network",
  "Cloud",
  "ActiveDirectory",
  "ISO27001",
  "NISTCSF",
  "Other",
] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_STATUSES = ["Draft", "InProgress", "Review", "Delivered"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

const TYPE_LABELS: Record<AssessmentType, string> = {
  Web: "Web Application",
  Network: "Network",
  Cloud: "Cloud",
  ActiveDirectory: "Active Directory",
  ISO27001: "ISO 27001",
  NISTCSF: "NIST CSF",
  Other: "Other",
};

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  Draft: "Draft",
  InProgress: "In Progress",
  Review: "Review",
  Delivered: "Delivered",
};

export function typeLabel(t: string): string {
  return (TYPE_LABELS as Record<string, string>)[t] ?? t;
}

export function statusLabel(s: string): string {
  return (STATUS_LABELS as Record<string, string>)[s] ?? s;
}

/** CSS class suffix for a status badge (see globals.css .status-*). */
export function statusClass(s: string): string {
  return `status-${String(s).toLowerCase()}`;
}
