import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { engagementStatusLabel, engagementStatusClass, ENGAGEMENT_STATUSES } from "@/lib/engagements";

function dateStr(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function EngagementsPage({ searchParams }: { searchParams: Promise<{ status?: string; archived?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { status = "", archived = "" } = await searchParams;
  const canEdit = hasRole(session.role, "MEMBER");

  const where: Record<string, unknown> = { organizationId: session.orgId };
  where.archivedAt = archived === "1" ? { not: null } : null;
  if ((ENGAGEMENT_STATUSES as readonly string[]).includes(status)) where.status = status;

  const engagements = await prisma.engagement.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { _count: { select: { assessments: true } } },
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Engagements</h1>
          <p>Client engagements grouping assessments across the delivery → remediation → retest lifecycle.</p>
        </div>
        {canEdit && <Link className="btn btn-primary" href="/dashboard/engagements/new">New engagement</Link>}
      </div>

      <div className="filters" role="list">
        <Link className={`filter${!status && archived !== "1" ? " active" : ""}`} href="/dashboard/engagements">All active</Link>
        {ENGAGEMENT_STATUSES.map((s) => (
          <Link key={s} className={`filter${status === s ? " active" : ""}`} href={`/dashboard/engagements?status=${s}`}>{engagementStatusLabel(s)}</Link>
        ))}
        <Link className={`filter${archived === "1" ? " active" : ""}`} href="/dashboard/engagements?archived=1">Archived</Link>
      </div>

      {engagements.length === 0 ? (
        <div className="card empty">
          <p>No engagements{status ? ` with status ${engagementStatusLabel(status)}` : ""}.</p>
          {canEdit && <p><Link href="/dashboard/engagements/new">Create the first engagement</Link>.</p>}
        </div>
      ) : (
        <table className="table">
          <thead><tr><th>Engagement</th><th>Client</th><th>Status</th><th>Assessments</th><th>Period</th></tr></thead>
          <tbody>
            {engagements.map((e) => (
              <tr key={e.id} className={e.archivedAt ? "archived-row" : ""}>
                <td><Link href={`/dashboard/engagements/${e.id}`}>{e.name}</Link></td>
                <td>{e.clientName}</td>
                <td><span className={`status-badge ${engagementStatusClass(e.status)}`}>{engagementStatusLabel(e.status)}</span></td>
                <td><span className="count">{e._count.assessments}</span></td>
                <td className="muted">{dateStr(e.startDate)} → {dateStr(e.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
