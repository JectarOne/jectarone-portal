import "server-only";
import { prisma } from "./db";

/** Append an audit-trail entry. Never throws into the caller's flow. */
export async function logActivity(input: {
  organizationId: string;
  userId?: string | null;
  action: string;
  detail?: string | null;
  assessmentId?: string | null;
  findingId?: string | null;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        detail: input.detail ?? null,
        assessmentId: input.assessmentId ?? null,
        findingId: input.findingId ?? null,
      },
    });
  } catch {
    // audit logging must not break the primary action
  }
}
