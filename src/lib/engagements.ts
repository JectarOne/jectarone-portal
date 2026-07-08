// Engagement lifecycle constants + helpers. An Engagement is the top-level
// container for a client engagement — it groups one or more Assessments across
// scoping → delivery → remediation → retest → close.

export const ENGAGEMENT_STATUSES = ["Scoping", "Active", "Reporting", "Remediation", "Retest", "Closed"] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

const STATUS_LABELS: Record<EngagementStatus, string> = {
  Scoping: "Scoping",
  Active: "Active",
  Reporting: "Reporting",
  Remediation: "Remediation",
  Retest: "Retest",
  Closed: "Closed",
};

export function engagementStatusLabel(s: string): string {
  return (STATUS_LABELS as Record<string, string>)[s] ?? s;
}

/** CSS class suffix for the status badge (see globals.css .estatus-*). */
export function engagementStatusClass(s: string): string {
  return `estatus-${String(s).toLowerCase()}`;
}

/** Allowed forward transitions (plus reopen paths). Closed can reopen to Active. */
export const ENGAGEMENT_TRANSITIONS: Record<string, string[]> = {
  Scoping: ["Active"],
  Active: ["Reporting", "Scoping"],
  Reporting: ["Remediation", "Active"],
  Remediation: ["Retest", "Reporting"],
  Retest: ["Closed", "Remediation"],
  Closed: ["Active"], // reopen
};

export function canTransition(from: string, to: string): boolean {
  return (ENGAGEMENT_TRANSITIONS[from] ?? []).includes(to);
}
