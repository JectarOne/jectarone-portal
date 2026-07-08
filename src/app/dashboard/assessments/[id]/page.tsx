import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { statusLabel, statusClass, typeLabel } from "@/lib/assessments";
import { SEVERITIES, FINDING_STATUSES, severityWeight, label } from "@/lib/findings";
import { SeverityBadge, FindingStatusBadge, RiskBadge } from "@/components/findings-ui";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { setArchivedAction, deleteAssessmentAction } from "@/actions/assessments";

function fmt(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function AssessmentOverviewPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; severity?: string; status?: string; sort?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const sp = await searchParams;

  const a = await prisma.assessment.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
  if (!a || a.organizationId !== session.orgId) notFound();

  // Findings (org + assessment scoped) with filters
  const q = (sp.q ?? "").trim();
  const where: Record<string, unknown> = { organizationId: session.orgId, assessmentId: id };
  // CLIENT (read-only) only sees published findings.
  if (!hasRole(session.role, "MEMBER")) where.reviewState = "Published";
  if (sp.severity && (SEVERITIES as readonly string[]).includes(sp.severity)) where.severity = sp.severity;
  if (sp.status && (FINDING_STATUSES as readonly string[]).includes(sp.status)) where.status = sp.status;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { affectedAsset: { contains: q, mode: "insensitive" } },
      { cwe: { contains: q, mode: "insensitive" } },
    ];
  }

  let findings = await prisma.finding.findMany({ where, orderBy: { createdAt: "desc" } });
  const sort = sp.sort ?? "newest";
  if (sort === "oldest") findings = findings.reverse();
  else if (sort === "severityHigh") findings.sort((x, y) => severityWeight(y.severity) - severityWeight(x.severity));
  else if (sort === "severityLow") findings.sort((x, y) => severityWeight(x.severity) - severityWeight(y.severity));
  else if (sort === "cvssHigh") findings.sort((x, y) => (y.cvssScore ?? -1) - (x.cvssScore ?? -1));

  const activities = await prisma.activityLog.findMany({
    where: { organizationId: session.orgId, assessmentId: id },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { user: { select: { name: true } } },
  });

  const reports = await prisma.report.findMany({
    where: { organizationId: session.orgId, assessmentId: id },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { generatedBy: { select: { name: true } } },
  });

  const canDelete = hasRole(session.role, "ADMIN");

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> / {a.clientName}
          </p>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {a.clientName}
            <span className={`status-badge ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
            {a.archivedAt && <span className="status-badge status-draft">Archived</span>}
          </h1>
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            {typeLabel(a.type)} · created by {a.createdBy?.name ?? "—"} · updated {fmt(a.updatedAt)}
          </p>
        </div>
        <div className="form-actions" style={{ marginTop: 0 }}>
          <Link className="btn btn-secondary" href={`/dashboard/assessments/${a.id}/edit`}>Edit</Link>
          <form action={setArchivedAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="archive" value={a.archivedAt ? "0" : "1"} />
            <button className="btn btn-secondary" type="submit">{a.archivedAt ? "Unarchive" : "Archive"}</button>
          </form>
          {canDelete && (
            <form action={deleteAssessmentAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className="btn btn-danger" type="submit">Delete</button>
            </form>
          )}
        </div>
      </div>

      {/* Overview */}
      <div className="card">
        <dl className="kv">
          <dt>Type</dt><dd>{typeLabel(a.type)}</dd>
          <dt>Dates</dt><dd>{fmt(a.startDate)} → {fmt(a.endDate)}</dd>
          <dt>Lead consultant</dt><dd>{a.leadConsultant ?? "—"}</dd>
          <dt>Scope</dt><dd>{a.scope ?? "—"}</dd>
        </dl>
        {a.executiveSummary && (<><h3 className="sub">Executive summary</h3><p className="muted">{a.executiveSummary}</p></>)}
        {a.notes && (<><h3 className="sub">Notes</h3><p className="muted">{a.notes}</p></>)}
      </div>

      {/* Findings */}
      <div className="section-head">
        <h2>Findings <span className="count">{findings.length}</span></h2>
        <Link className="btn btn-primary" href={`/dashboard/assessments/${a.id}/findings/new`}>Add finding</Link>
      </div>

      <form className="toolbar" method="get">
        <input type="text" name="q" defaultValue={q} placeholder="Search title, asset, CWE…" />
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
          <div className="empty">No findings yet. <Link href={`/dashboard/assessments/${a.id}/findings/new`}>Add the first finding</Link>.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Title</th><th>Severity</th><th>Risk</th><th>Status</th><th>CVSS</th><th></th></tr></thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className={f.archivedAt ? "archived-row" : ""}>
                  <td><strong>{f.title}</strong>{f.affectedAsset && <div className="muted" style={{ fontSize: "0.78rem" }}>{f.affectedAsset}</div>}</td>
                  <td><SeverityBadge severity={f.severity} /></td>
                  <td><RiskBadge likelihood={f.likelihood} impact={f.impact} /></td>
                  <td><FindingStatusBadge status={f.status} /></td>
                  <td className="muted">{f.cvssScore ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn btn-secondary" href={`/dashboard/assessments/${a.id}/findings/${f.id}`} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem" }}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reports */}
      <div className="section-head">
        <h2>Reports <span className="count">{reports.length}</span></h2>
        <a className="btn btn-primary" href={`/dashboard/assessments/${a.id}/report`}>Download PDF report</a>
      </div>
      <div className="card">
        {reports.length === 0 ? (
          <div className="empty">No reports generated yet — the PDF is built live from the current findings.</div>
        ) : (
          <ul className="activity">
            {reports.map((r) => (
              <li key={r.id}>
                <span className="act-detail">{r.title}</span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>{r.findingCount} finding(s)</span>
                <span className="act-meta">{r.generatedBy?.name ?? "—"} · {new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Activity timeline */}
      <div className="section-head"><h2>Timeline</h2></div>
      <div className="card">
        <Timeline
          items={activities.map((ev): TimelineItem => ({
            action: ev.action,
            detail: ev.detail,
            user: ev.user?.name ?? null,
            when: new Date(ev.createdAt).toISOString().slice(0, 16).replace("T", " "),
          }))}
        />
      </div>
    </>
  );
}
