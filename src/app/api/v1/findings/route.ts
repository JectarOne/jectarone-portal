import { prisma } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { SEVERITIES, FINDING_STATUSES, CLOSED_STATUSES } from "@/lib/findings";

/** GET /api/v1/findings — list findings for the caller's org (org-scoped). */
export async function GET(req: Request) {
  const res = await apiSession();
  if ("response" in res) return res.response;
  const { session } = res;
  const url = new URL(req.url);
  const sev = url.searchParams.get("severity");
  const status = url.searchParams.get("status");
  const assignee = url.searchParams.get("assignee");
  const overdue = url.searchParams.get("overdue");

  const where: Record<string, unknown> = { organizationId: session.orgId, archivedAt: null };
  if (sev && (SEVERITIES as readonly string[]).includes(sev)) where.severity = sev;
  if (status && (FINDING_STATUSES as readonly string[]).includes(status)) where.status = status;
  if (assignee) where.assigneeId = assignee;
  if (overdue === "1") { where.dueDate = { lt: new Date() }; where.status = { notIn: [...CLOSED_STATUSES] }; }

  const findings = await prisma.finding.findMany({
    where, orderBy: { createdAt: "desc" }, take: 500,
    select: {
      id: true, title: true, severity: true, status: true, cvssScore: true, dueDate: true,
      assigneeId: true, assessmentId: true, createdAt: true, updatedAt: true,
    },
  });
  return json({ findings });
}
