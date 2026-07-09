// Retest lifecycle constants + helpers. A Retest verifies remediation of a
// finding: Requested → Scheduled → InProgress → Verified | Failed.

export const RETEST_STATUSES = ["Requested", "Scheduled", "InProgress", "Verified", "Failed"] as const;
export type RetestStatus = (typeof RETEST_STATUSES)[number];

// Terminal states — no further transitions (a new retest is requested instead).
export const RETEST_TERMINAL = ["Verified", "Failed"] as const;

const LABELS: Record<RetestStatus, string> = {
  Requested: "Requested",
  Scheduled: "Scheduled",
  InProgress: "In Progress",
  Verified: "Verified",
  Failed: "Failed",
};

export function retestStatusLabel(s: string): string {
  return (LABELS as Record<string, string>)[s] ?? s;
}

export function retestStatusClass(s: string): string {
  return `rt-${String(s).toLowerCase()}`;
}

export const RETEST_TRANSITIONS: Record<string, string[]> = {
  Requested: ["Scheduled", "InProgress"],
  Scheduled: ["InProgress", "Requested"],
  InProgress: ["Verified", "Failed", "Scheduled"],
  Verified: [],
  Failed: [],
};

export function canRetestTransition(from: string, to: string): boolean {
  return (RETEST_TRANSITIONS[from] ?? []).includes(to);
}

export function isRetestOpen(status: string): boolean {
  return !(RETEST_TERMINAL as readonly string[]).includes(status);
}
