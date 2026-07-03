// Sprint 5 — SLA remediation deadlines per severity.
import { isClosed } from "./findings";

export const SLA_DAYS: Record<string, number | null> = {
  Critical: 7,
  High: 30,
  Medium: 60,
  Low: 90,
  Informational: null, // no SLA
};

/** Default due date from severity + a base date (usually createdAt). Null if no SLA. */
export function computeDueDate(severity: string, from: Date = new Date()): Date | null {
  const days = SLA_DAYS[severity];
  if (days == null) return null;
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** A finding is overdue if it has a due date in the past and is not closed. */
export function isOverdue(dueDate: Date | null, status: string, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  if (isClosed(status)) return false;
  return new Date(dueDate).getTime() < now.getTime();
}

/** Whole days until due (negative = overdue). Null if no due date. */
export function daysUntilDue(dueDate: Date | null, now: Date = new Date()): number | null {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate).getTime() - now.getTime()) / 86_400_000);
}
