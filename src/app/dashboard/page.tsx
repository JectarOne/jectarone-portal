import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) return null;

  const [memberCount, activeCount, deliveredCount] = await Promise.all([
    prisma.membership.count({ where: { organizationId: session.orgId } }),
    prisma.assessment.count({ where: { organizationId: session.orgId, archivedAt: null, status: { not: "Delivered" } } }),
    prisma.assessment.count({ where: { organizationId: session.orgId, status: "Delivered" } }),
  ]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Overview</h1>
          <p>{session.organization.name}</p>
        </div>
        <span className="badge">Portal · Sprint 1</span>
      </div>

      <div className="grid grid-3">
        <div className="card metric"><span>Team members</span><strong>{memberCount}</strong></div>
        <div className="card metric"><span>Active assessments</span><strong>{activeCount}</strong></div>
        <div className="card metric"><span>Delivered</span><strong>{deliveredCount}</strong></div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>Manage your assessments</h2>
        <p className="muted" style={{ fontSize: "0.92rem", marginBottom: "1rem" }}>
          Create and track security assessments for your clients — scope, status, dates, and
          executive summaries, all persisted and scoped to your organization. Findings,
          evidence, and downloadable PDF reports build on this in the next sprints.
        </p>
        <Link className="btn btn-primary" href="/dashboard/assessments">Go to assessments</Link>
      </div>
    </>
  );
}
