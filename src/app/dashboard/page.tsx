import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) return null;

  const memberCount = await prisma.membership.count({
    where: { organizationId: session.orgId },
  });

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
        <div className="card metric"><span>Assessments</span><strong className="muted">—</strong></div>
        <div className="card metric"><span>Open findings</span><strong className="muted">—</strong></div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>Welcome to your portal</h2>
        <p className="muted" style={{ fontSize: "0.92rem" }}>
          This is the foundation (authentication, your organization, and team management).
          Assessments, findings, and downloadable reports arrive in the next sprints —
          they will build on the JectarOne Report Builder.
        </p>
      </div>
    </>
  );
}
