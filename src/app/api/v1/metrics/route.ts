import { prisma } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { isClosed } from "@/lib/findings";
import { isOverdue } from "@/lib/sla";

/** GET /api/v1/metrics — dashboard metrics for the caller's org. */
export async function GET() {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;

  const findings = await prisma.finding.findMany({
    where: { organizationId: session.orgId, archivedAt: null },
    select: { severity: true, status: true, cvssScore: true, dueDate: true, createdAt: true, resolvedAt: true },
  });

  const open = findings.filter((f) => !isClosed(f.status)).length;
  const closed = findings.filter((f) => isClosed(f.status)).length;
  const overdue = findings.filter((f) => isOverdue(f.dueDate, f.status)).length;
  const acceptedRisks = findings.filter((f) => f.status === "AcceptedRisk").length;
  const critical = findings.filter((f) => f.severity === "Critical" && !isClosed(f.status)).length;
  const high = findings.filter((f) => f.severity === "High" && !isClosed(f.status)).length;
  const withCvss = findings.filter((f) => f.cvssScore != null);
  const averageCvss = withCvss.length ? +(withCvss.reduce((s, f) => s + (f.cvssScore ?? 0), 0) / withCvss.length).toFixed(1) : null;
  const resolved = findings.filter((f) => f.resolvedAt);
  const mttrDays = resolved.length
    ? Math.round(resolved.reduce((s, f) => s + (new Date(f.resolvedAt!).getTime() - new Date(f.createdAt).getTime()), 0) / resolved.length / 86_400_000)
    : null;

  return json({ metrics: { open, closed, overdue, acceptedRisks, critical, high, averageCvss, mttrDays, total: findings.length } });
}
