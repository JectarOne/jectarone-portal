import "server-only";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";

/**
 * Auto-reopen findings whose risk acceptance has expired (AcceptedRisk with a
 * past `acceptedRiskUntil`). Idempotent; safe to call on list/detail load.
 * Not a server action — callers pass their own already-authorized org id, so it
 * cannot be invoked as an RPC against another tenant. Returns the count reopened.
 */
export async function reopenExpiredRiskAcceptances(orgId: string, userId: string): Promise<number> {
  const now = new Date();
  const expired = await prisma.finding.findMany({
    where: { organizationId: orgId, status: "AcceptedRisk", acceptedRiskUntil: { lt: now }, archivedAt: null },
    select: { id: true, assessmentId: true, acceptedRiskUntil: true },
  });
  for (const f of expired) {
    await prisma.finding.update({
      where: { id: f.id },
      data: {
        status: "Open", resolvedAt: null, validatedAt: null,
        acceptedRiskReason: null, acceptedRiskById: null, acceptedRiskAt: null, acceptedRiskUntil: null,
      },
    });
    await logActivity({
      organizationId: orgId, userId, action: "finding.risk_expired",
      detail: `Risk acceptance expired ${f.acceptedRiskUntil?.toISOString().slice(0, 10)} — reopened`,
      assessmentId: f.assessmentId, findingId: f.id,
    });
  }
  return expired.length;
}
