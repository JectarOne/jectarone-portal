import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { risk } from "@/lib/findings";

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) return null;
  const org = session.orgId;

  const [activeAssessments, activeFindings] = await Promise.all([
    prisma.assessment.count({ where: { organizationId: org, archivedAt: null, status: { not: "Delivered" } } }),
    prisma.finding.findMany({
      where: { organizationId: org, archivedAt: null },
      select: { severity: true, status: true, likelihood: true, impact: true },
    }),
  ]);

  const open = activeFindings.filter((f) => f.status === "Open").length;
  const critical = activeFindings.filter((f) => f.severity === "Critical").length;
  const high = activeFindings.filter((f) => f.severity === "High").length;
  const resolved = activeFindings.filter((f) => f.status === "Fixed" || f.status === "Verified").length;
  const avgRisk = activeFindings.length
    ? (activeFindings.reduce((s, f) => s + risk(f.likelihood, f.impact).score, 0) / activeFindings.length).toFixed(1)
    : "—";

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Overview</h1>
          <p>{session.organization.name}</p>
        </div>
        <span className="badge">Portal</span>
      </div>

      <div className="grid grid-5">
        <div className="card metric"><span>Open findings</span><strong>{open}</strong></div>
        <div className="card metric"><span>Critical</span><strong className="sev-critical-text">{critical}</strong></div>
        <div className="card metric"><span>High</span><strong className="sev-high-text">{high}</strong></div>
        <div className="card metric"><span>Resolved</span><strong className="sev-low-text">{resolved}</strong></div>
        <div className="card metric"><span>Average risk</span><strong>{avgRisk}</strong></div>
      </div>

      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>Assessments</h2>
          <p className="muted" style={{ fontSize: "0.92rem", marginBottom: "1rem" }}>
            {activeAssessments} active. Create and track client assessments — scope, status, dates,
            executive summaries, and findings.
          </p>
          <Link className="btn btn-primary" href="/dashboard/assessments">Go to assessments</Link>
        </div>
        <div className="card">
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>Findings</h2>
          <p className="muted" style={{ fontSize: "0.92rem", marginBottom: "1rem" }}>
            Document vulnerabilities with severity, CVSS, OWASP/CWE/MITRE mapping, evidence, and
            a 5×5 risk matrix. Search and filter across all assessments.
          </p>
          <Link className="btn btn-secondary" href="/dashboard/findings">Browse findings</Link>
        </div>
      </div>
    </>
  );
}
