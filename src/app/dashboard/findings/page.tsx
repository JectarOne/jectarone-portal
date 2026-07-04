import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SEVERITIES, FINDING_STATUSES, CLOSED_STATUSES, severityWeight, label } from "@/lib/findings";
import { isOverdue } from "@/lib/sla";
import { SeverityBadge, FindingStatusBadge, CvssBadge, EmptyState } from "@/components/findings-ui";

function dateStr(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; severity?: string; status?: string; assignee?: string; overdue?: string; sort?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const where: Record<string, unknown> = { organizationId: session.orgId, archivedAt: null };
  if (sp.severity && (SEVERITIES as readonly string[]).includes(sp.severity)) where.severity = sp.severity;
  if (sp.status && (FINDING_STATUSES as readonly string[]).includes(sp.status)) where.status = sp.status;
  if (sp.assignee) where.assigneeId = sp.assignee;
  if (sp.overdue === "1") {
    where.dueDate = { lt: new Date() };
    where.status = { notIn: [...CLOSED_STATUSES] };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { affectedAsset: { contains: q, mode: "insensitive" } },
      { cwe: { contains: q, mode: "insensitive" } },
      { owaspCategory: { contains: q, mode: "insensitive" } },
      { cvssVector: { contains: q, mode: "insensitive" } },
      { comments: { some: { deletedAt: null, body: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [members, list] = await Promise.all([
    prisma.membership.findMany({ where: { organizationId: session.orgId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.finding.findMany({
      where, orderBy: { createdAt: "desc" }, take: 500,
      include: { assessment: { select: { id: true, clientName: true } }, assignee: { select: { name: true } } },
    }),
  ]);

  let findings = list;
  const sort = sp.sort ?? "newest";
  if (sort === "oldest") findings = [...findings].reverse();
  else if (sort === "severityHigh") findings = [...findings].sort((x, y) => severityWeight(y.severity) - severityWeight(x.severity));
  else if (sort === "severityLow") findings = [...findings].sort((x, y) => severityWeight(x.severity) - severityWeight(y.severity));
  else if (sort === "cvssHigh") findings = [...findings].sort((x, y) => (y.cvssScore ?? -1) - (x.cvssScore ?? -1));
  else if (sort === "dueSoon") findings = [...findings].sort((x, y) => (x.dueDate ? new Date(x.dueDate).getTime() : Infinity) - (y.dueDate ? new Date(y.dueDate).getTime() : Infinity));

  return (
    <>
      <div className="topbar">
        <div><h1>Findings</h1><p>{session.organization.name}</p></div>
      </div>

      <form className="toolbar" method="get">
        <input type="text" name="q" defaultValue={q} placeholder="Search title, description, asset, CWE, comments…" />
        <select name="severity" defaultValue={sp.severity ?? ""}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          {FINDING_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select name="assignee" defaultValue={sp.assignee ?? ""}>
          <option value="">Any assignee</option>
          {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
        </select>
        <select name="overdue" defaultValue={sp.overdue ?? ""}>
          <option value="">All</option>
          <option value="1">Overdue only</option>
        </select>
        <select name="sort" defaultValue={sort}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="severityHigh">Highest severity</option>
          <option value="severityLow">Lowest severity</option>
          <option value="cvssHigh">Highest CVSS</option>
          <option value="dueSoon">Due soonest</option>
        </select>
        <button className="btn btn-secondary" type="submit">Apply</button>
      </form>

      <div className="card">
        {findings.length === 0 ? (
          <EmptyState
            title="No findings match"
            hint={q || sp.severity || sp.status || sp.assignee || sp.overdue ? "Try clearing the filters above." : "Findings you add to assessments will appear here."}
          />
        ) : (
          <table className="table">
            <thead><tr><th>Title</th><th>Client</th><th>Severity</th><th>Status</th><th>Assignee</th><th>Due</th><th>CVSS</th></tr></thead>
            <tbody>
              {findings.map((f) => {
                const od = isOverdue(f.dueDate, f.status);
                return (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/dashboard/assessments/${f.assessmentId}/findings/${f.id}`}><strong>{f.title}</strong></Link>
                      {f.affectedAsset && <div className="muted" style={{ fontSize: "0.78rem" }}>{f.affectedAsset}</div>}
                    </td>
                    <td className="muted"><Link href={`/dashboard/assessments/${f.assessment.id}`}>{f.assessment.clientName}</Link></td>
                    <td><SeverityBadge severity={f.severity} /></td>
                    <td><FindingStatusBadge status={f.status} /></td>
                    <td className="muted">{f.assignee?.name ?? "—"}</td>
                    <td className={od ? "sev-critical-text" : "muted"}>{dateStr(f.dueDate)}{od ? " ⚠" : ""}</td>
                    <td><CvssBadge score={f.cvssScore} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
