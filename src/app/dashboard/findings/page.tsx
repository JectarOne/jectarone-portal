import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SEVERITIES, FINDING_STATUSES, severityWeight, label } from "@/lib/findings";
import { SeverityBadge, FindingStatusBadge, RiskBadge } from "@/components/findings-ui";

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; severity?: string; status?: string; sort?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const where: Record<string, unknown> = { organizationId: session.orgId, archivedAt: null };
  if (sp.severity && (SEVERITIES as readonly string[]).includes(sp.severity)) where.severity = sp.severity;
  if (sp.status && (FINDING_STATUSES as readonly string[]).includes(sp.status)) where.status = sp.status;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { affectedAsset: { contains: q, mode: "insensitive" } },
      { cwe: { contains: q, mode: "insensitive" } },
      { owaspCategory: { contains: q, mode: "insensitive" } },
    ];
  }

  let findings = await prisma.finding.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { assessment: { select: { id: true, clientName: true } } },
    take: 500,
  });
  const sort = sp.sort ?? "newest";
  if (sort === "oldest") findings = findings.reverse();
  else if (sort === "severityHigh") findings.sort((x, y) => severityWeight(y.severity) - severityWeight(x.severity));
  else if (sort === "severityLow") findings.sort((x, y) => severityWeight(x.severity) - severityWeight(y.severity));
  else if (sort === "cvssHigh") findings.sort((x, y) => (y.cvssScore ?? -1) - (x.cvssScore ?? -1));

  return (
    <>
      <div className="topbar">
        <div><h1>Findings</h1><p>{session.organization.name}</p></div>
      </div>

      <form className="toolbar" method="get">
        <input type="text" name="q" defaultValue={q} placeholder="Search title, asset, CWE, OWASP…" />
        <select name="severity" defaultValue={sp.severity ?? ""}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          {FINDING_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select name="sort" defaultValue={sort}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="severityHigh">Highest severity</option>
          <option value="severityLow">Lowest severity</option>
          <option value="cvssHigh">Highest CVSS</option>
        </select>
        <button className="btn btn-secondary" type="submit">Apply</button>
      </form>

      <div className="card">
        {findings.length === 0 ? (
          <div className="empty">No findings match.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Title</th><th>Client</th><th>Severity</th><th>Risk</th><th>Status</th><th>CVSS</th></tr></thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/dashboard/assessments/${f.assessmentId}/findings/${f.id}`}><strong>{f.title}</strong></Link>
                    {f.affectedAsset && <div className="muted" style={{ fontSize: "0.78rem" }}>{f.affectedAsset}</div>}
                  </td>
                  <td className="muted">
                    <Link href={`/dashboard/assessments/${f.assessment.id}`}>{f.assessment.clientName}</Link>
                  </td>
                  <td><SeverityBadge severity={f.severity} /></td>
                  <td><RiskBadge likelihood={f.likelihood} impact={f.impact} /></td>
                  <td><FindingStatusBadge status={f.status} /></td>
                  <td className="muted">{f.cvssScore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
