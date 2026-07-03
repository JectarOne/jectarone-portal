import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isClosed, SEVERITIES, FINDING_STATUSES, label, severityClass, findingStatusClass } from "@/lib/findings";
import { isOverdue } from "@/lib/sla";

function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) return null;
  const org = session.orgId;

  const [activeAssessments, findings] = await Promise.all([
    prisma.assessment.count({ where: { organizationId: org, archivedAt: null, status: { not: "Delivered" } } }),
    prisma.finding.findMany({
      where: { organizationId: org, archivedAt: null },
      select: { severity: true, status: true, cvssScore: true, dueDate: true, createdAt: true, resolvedAt: true },
    }),
  ]);

  const open = findings.filter((f) => !isClosed(f.status));
  const closed = findings.filter((f) => isClosed(f.status));
  const overdue = findings.filter((f) => isOverdue(f.dueDate, f.status));
  const accepted = findings.filter((f) => f.status === "AcceptedRisk");
  const critical = open.filter((f) => f.severity === "Critical");
  const high = open.filter((f) => f.severity === "High");

  const withCvss = findings.filter((f) => f.cvssScore != null);
  const avgCvss = withCvss.length ? (withCvss.reduce((s, f) => s + (f.cvssScore ?? 0), 0) / withCvss.length).toFixed(1) : "—";

  const resolved = findings.filter((f) => f.resolvedAt);
  const mttrDays = resolved.length
    ? Math.round(resolved.reduce((s, f) => s + (new Date(f.resolvedAt!).getTime() - new Date(f.createdAt).getTime()), 0) / resolved.length / 86_400_000)
    : null;

  const som = startOfMonth();
  const createdThisMonth = findings.filter((f) => new Date(f.createdAt) >= som).length;
  const resolvedThisMonth = resolved.filter((f) => new Date(f.resolvedAt!) >= som).length;

  const sevCounts = SEVERITIES.map((s) => ({ key: s, n: findings.filter((f) => f.severity === s).length }));
  const statusCounts = FINDING_STATUSES.map((s) => ({ key: s, n: findings.filter((f) => f.status === s).length }));
  const sevMax = Math.max(1, ...sevCounts.map((x) => x.n));
  const statusMax = Math.max(1, ...statusCounts.map((x) => x.n));

  return (
    <>
      <div className="topbar">
        <div><h1>Overview</h1><p>{session.organization.name}</p></div>
        <Link className="btn btn-secondary" href="/dashboard/findings">All findings</Link>
      </div>

      <div className="grid grid-5">
        <div className="card metric"><span>Open</span><strong>{open.length}</strong></div>
        <div className="card metric"><span>Closed</span><strong className="sev-low-text">{closed.length}</strong></div>
        <div className="card metric"><span>Overdue</span><strong className="sev-critical-text">{overdue.length}</strong></div>
        <div className="card metric"><span>Accepted risks</span><strong>{accepted.length}</strong></div>
        <div className="card metric"><span>Critical (open)</span><strong className="sev-critical-text">{critical.length}</strong></div>
      </div>
      <div className="grid grid-5" style={{ marginTop: "0.9rem" }}>
        <div className="card metric"><span>High (open)</span><strong className="sev-high-text">{high.length}</strong></div>
        <div className="card metric"><span>Average CVSS</span><strong>{avgCvss}</strong></div>
        <div className="card metric"><span>MTTR</span><strong>{mttrDays == null ? "—" : `${mttrDays}d`}</strong></div>
        <div className="card metric"><span>Created this month</span><strong>{createdThisMonth}</strong></div>
        <div className="card metric"><span>Resolved this month</span><strong>{resolvedThisMonth}</strong></div>
      </div>

      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h3 className="sub">Severity distribution</h3>
          {sevCounts.map(({ key, n }) => (
            <div key={key} className="distrow">
              <span className="distlabel">{label(key)}</span>
              <span className="distbar"><span className={`badge ${severityClass(key)}`} style={{ display: "block", width: `${(n / sevMax) * 100}%`, minWidth: n ? "1.4rem" : 0, height: "16px" }} /></span>
              <span className="distn">{n}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="sub">Status distribution</h3>
          {statusCounts.map(({ key, n }) => (
            <div key={key} className="distrow">
              <span className="distlabel">{label(key)}</span>
              <span className="distbar"><span className={`badge ${findingStatusClass(key)}`} style={{ display: "block", width: `${(n / statusMax) * 100}%`, minWidth: n ? "1.4rem" : 0, height: "16px" }} /></span>
              <span className="distn">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>Assessments</h2>
          <p className="muted" style={{ fontSize: "0.92rem", marginBottom: "1rem" }}>{activeAssessments} active.</p>
          <Link className="btn btn-primary" href="/dashboard/assessments">Go to assessments</Link>
        </div>
        <div className="card">
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>Overdue &amp; at-risk</h2>
          <p className="muted" style={{ fontSize: "0.92rem", marginBottom: "1rem" }}>
            {overdue.length} overdue, {accepted.length} accepted risk{accepted.length === 1 ? "" : "s"}.
          </p>
          <Link className="btn btn-secondary" href="/dashboard/findings?overdue=1">View overdue findings</Link>
        </div>
      </div>
    </>
  );
}
