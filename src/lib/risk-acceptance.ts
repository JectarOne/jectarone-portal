// Risk-acceptance expiry logic — pure + testable.

/** True when a finding's risk acceptance has lapsed (AcceptedRisk with a past `until`). */
export function isAcceptanceExpired(status: string, until: Date | null, now: Date = new Date()): boolean {
  if (status !== "AcceptedRisk" || !until) return false;
  return until.getTime() < now.getTime();
}

/** Days until the acceptance expires (negative = already expired); null when no expiry set. */
export function daysUntilExpiry(until: Date | null, now: Date = new Date()): number | null {
  if (!until) return null;
  return Math.ceil((until.getTime() - now.getTime()) / 86_400_000);
}
