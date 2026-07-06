import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isClosed, SEVERITIES, FINDING_STATUSES, label } from "@/lib/findings";
import { isOverdue } from "@/lib/sla";
import { securityScore } from "@/lib/score";
import { BarsH, Donut, AreaLine, Legend, type Segment } from "@/components/charts";
import { EmptyState } from "@/components/findings-ui";

const SEV_COLOR: Record<string, string> = {
  Critical: "var(--c-critical)", High: "var(--c-high)", Medium: "var(--c-medium)",
  Low: "var(--c-low)", Informational: "var(--c-info)",
};
const STATUS_COLOR: Record<string, string> = {
  Open: "var(--c-open)", InProgress: "var(--c-progress)", ReadyForValidation: "var(--accent)",
  Resolved: "var(--c-resolved)", AcceptedRisk: "var(--c-accepted)", FalsePositive: "var(--muted)",
};
const RISK_ORDER = ["Critical", "High", "Medium", "Low", "None"] as const;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function lastMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: monthKey(d), label: d.toLocaleString("en", { month: "short" }) });
  }
  return out;
}
function dateStr(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) return null;
  const org = session.orgId;

  const [assessments, findings, assets] = await Promise.all([
    prisma.assessment.findMany({
      where: { organizationId: org, archivedAt: null },
      select: { id: true, clientName: true, type: true, status: true, startDate: true, endDate: true },
    }),
    prisma.finding.findMany({
      where: { organizationId: org, archivedAt: null },
      select: { id: true, title: true, severity: true, status: true, dueDate: true, createdAt: true, resolvedAt: true, assessmentId: true },
    }),
    prisma.asset.findMany({
      where: { organizationId: org, archivedAt: null },
      select: { id: true, findings: { where: { archivedAt: null }, select: { severity: true, status: true } } },
    }),
  ]);

  const open = findings.filter((f) => !isClosed(f.status));
  const overdue = findings.filter((f) => isOverdue(f.dueDate, f.status));
  const critical = open.filter((f) => f.severity === "Critical");
  const inProgress = assessments.filter((a) => a.status === "InProgress").length;
  const { score, grade, label: scoreLabel } = securityScore(open, overdue.length);

  // Recently resolved (last 5 by resolvedAt).
  const recentlyResolved = findings
    .filter((f) => f.resolvedAt)
    .sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime())
    .slice(0, 5);

  // Upcoming assessments: a start date in the future (scheduled).
  const now = Date.now();
  const upcoming = assessments
    .filter((a) => a.startDate && new Date(a.startDate).getTime() > now)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
    .slice(0, 5);

  // Charts.
  const sevSegments: Segment[] = SEVERITIES.map((s) => ({ label: label(s), value: findings.filter((f) => f.severity === s).length, color: SEV_COLOR[s] }));
  const statusSegments: Segment[] = FINDING_STATUSES.map((s) => ({ label: label(s), value: findings.filter((f) => f.status === s).length, color: STATUS_COLOR[s] ?? "var(--muted)" }));
  const months = lastMonths(6);
  const overTime = months.map((m) => ({ label: m.label, value: findings.filter((f) => monthKey(new Date(f.createdAt)) === m.key).length }));

  // Assets by highest open-finding severity.
  const riskRank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1, Informational: 0 };
  const assetRiskCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, None: 0 };
  for (const a of assets) {
    const openSevs = a.findings.filter((f) => !isClosed(f.status)).map((f) => f.severity);
    if (openSevs.length === 0) { assetRiskCounts.None++; continue; }
    const top = openSevs.reduce((best, s) => (riskRank[s] > riskRank[best] ? s : best), "Informational");
    assetRiskCounts[top === "Informational" ? "Low" : top]++;
  }
  const assetRiskSegments: Segment[] = RISK_ORDER.map((r) => ({
    label: r, value: assetRiskCounts[r], color: r === "None" ? "var(--muted)" : SEV_COLOR[r],
  }));

  return (
    <>
      <div className="topbar">
        <div><h1>Overview</h1><p>{session.organization.name}</p></div>
        <Link className="btn btn-secondary" href="/dashboard/findings">All findings</Link>
      </div>

      {/* Security score hero */}
      <div className="card score-hero" style={{ marginBottom: "1rem" }}>
        <div className="score-ring">
          <Donut
            segments={[{ label: "Score", value: score, color: `var(--c-${grade === "A" || grade === "B" ? "low" : grade === "C" ? "medium" : grade === "D" ? "high" : "critical"})` }]}
            total={100} size={150} thickness={16}
            ariaLabel={`Security score ${score} out of 100, grade ${grade}`}
          />
          <div className="score-num"><strong>{score}</strong><span>/ 100</span></div>
        </div>
        <div>
          <div className={`score-grade score-${grade}`}>Security score: {scoreLabel} ({grade})</div>
          <p className="score-desc">
            {open.length} open finding{open.length === 1 ? "" : "s"} · {critical.length} critical · {overdue.length} overdue.
            {" "}Resolve critical and overdue items to raise your score.
          </p>
          <Link className="btn btn-primary" href="/dashboard/findings?overdue=1" style={{ marginTop: "0.8rem" }}>Review priority findings</Link>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-5">
        <div className="card metric"><span>Open findings</span><strong>{open.length}</strong></div>
        <div className="card metric"><span>Critical (open)</span><strong className="sev-critical-text">{critical.length}</strong></div>
        <div className="card metric"><span>Assessments in progress</span><strong>{inProgress}</strong></div>
        <div className="card metric"><span>Overdue</span><strong className="sev-critical-text">{overdue.length}</strong></div>
        <div className="card metric"><span>Resolved (total)</span><strong className="sev-low-text">{findings.filter((f) => f.resolvedAt).length}</strong></div>
      </div>

      {/* Charts */}
      <div className="chart-cols" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h3 className="chart-title">Findings by severity</h3>
          <Donut segments={sevSegments} centerLabel={String(findings.length)} centerSub="findings" ariaLabel="Findings by severity" />
          <Legend items={sevSegments} />
        </div>
        <div className="card">
          <h3 className="chart-title">Findings by status</h3>
          <BarsH items={statusSegments} />
        </div>
      </div>
      <div className="chart-cols" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h3 className="chart-title">Findings over time (6 months)</h3>
          <AreaLine points={overTime} ariaLabel="Findings created per month" />
          <div className="chart-legend" style={{ gridAutoFlow: "column", justifyContent: "space-between", marginTop: "0.5rem" }}>
            {overTime.map((p) => <span key={p.label} className="muted" style={{ fontSize: "0.72rem" }}>{p.label}</span>)}
          </div>
        </div>
        <div className="card">
          <h3 className="chart-title">Assets by risk</h3>
          <BarsH items={assetRiskSegments} />
        </div>
      </div>

      {/* Lists */}
      <div className="chart-cols" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h3 className="chart-title">Recently resolved</h3>
          {recentlyResolved.length === 0 ? (
            <EmptyState title="Nothing resolved yet" hint="Resolved findings will appear here." />
          ) : (
            <ul className="wlist">
              {recentlyResolved.map((f) => (
                <li key={f.id}>
                  <span className="badge sev-low" style={{ flex: "0 0 auto" }}>✓</span>
                  <Link className="w-title" href={`/dashboard/assessments/${f.assessmentId}/findings/${f.id}`}>{f.title}</Link>
                  <span className="w-meta">{dateStr(f.resolvedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 className="chart-title">Upcoming assessments</h3>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming assessments" hint="Scheduled assessments (future start date) will appear here." />
          ) : (
            <ul className="wlist">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link className="w-title" href={`/dashboard/assessments/${a.id}`}>{a.clientName}</Link>
                  <span className="w-meta">{dateStr(a.startDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
