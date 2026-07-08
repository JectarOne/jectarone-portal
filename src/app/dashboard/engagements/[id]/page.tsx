import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { engagementStatusLabel, engagementStatusClass, ENGAGEMENT_TRANSITIONS } from "@/lib/engagements";
import { statusLabel, statusClass, typeLabel } from "@/lib/assessments";
import { setEngagementStatusAction, setEngagementArchivedAction, deleteEngagementAction } from "@/actions/engagements";

function fmt(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function EngagementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const e = await prisma.engagement.findUnique({
    where: { id },
    include: {
      assessments: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { findings: true } } },
      },
    },
  });
  if (!e || e.organizationId !== session.orgId) notFound();

  const canWrite = hasRole(session.role, "MEMBER");
  const canDelete = hasRole(session.role, "ADMIN");
  const nextStatuses = ENGAGEMENT_TRANSITIONS[e.status] ?? [];
  const boundStatus = setEngagementStatusAction.bind(null, id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/engagements">Engagements</Link> / {e.name}
          </p>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            {e.name}
            <span className={`status-badge ${engagementStatusClass(e.status)}`}>{engagementStatusLabel(e.status)}</span>
            {e.archivedAt && <span className="badge fstatus-archived">Archived</span>}
          </h1>
          <p className="muted" style={{ fontSize: "0.82rem" }}>Client: {e.clientName}</p>
        </div>
        {canWrite && (
          <span style={{ display: "inline-flex", gap: "0.5rem" }}>
            <Link className="btn btn-secondary" href={`/dashboard/engagements/${id}/edit`}>Edit</Link>
            <form action={setEngagementArchivedAction} className="inline-form">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="archive" value={e.archivedAt ? "0" : "1"} />
              <button className="btn btn-secondary" type="submit">{e.archivedAt ? "Restore" : "Archive"}</button>
            </form>
            {canDelete && (
              <form action={deleteEngagementAction} className="inline-form">
                <input type="hidden" name="id" value={id} />
                <button className="btn btn-danger" type="submit">Delete</button>
              </form>
            )}
          </span>
        )}
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3 className="sub">Lifecycle</h3>
          {canWrite && nextStatuses.length > 0 ? (
            <form action={boundStatus} className="inline-form">
              <span className={`status-badge ${engagementStatusClass(e.status)}`}>{engagementStatusLabel(e.status)}</span>
              <select name="status" defaultValue={nextStatuses[0]} aria-label="Next status">
                {nextStatuses.map((s) => <option key={s} value={s}>{engagementStatusLabel(s)}</option>)}
              </select>
              <button className="btn btn-secondary" type="submit">Advance</button>
            </form>
          ) : <span className={`status-badge ${engagementStatusClass(e.status)}`}>{engagementStatusLabel(e.status)}</span>}
        </div>
        <div className="card">
          <h3 className="sub">Period</h3>
          <p>{fmt(e.startDate)} → {fmt(e.endDate)}</p>
        </div>
        <div className="card">
          <h3 className="sub">Lead</h3>
          <p>{e.leadConsultant ?? "—"}</p>
        </div>
      </div>

      {e.scope && (
        <>
          <div className="section-head"><h2>Scope</h2></div>
          <div className="card"><p style={{ whiteSpace: "pre-wrap" }}>{e.scope}</p></div>
        </>
      )}

      <div className="section-head">
        <h2>Assessments <span className="count">{e.assessments.length}</span></h2>
        {canWrite && <Link className="btn btn-primary" href={`/dashboard/assessments/new?engagement=${id}`}>Add assessment</Link>}
      </div>
      <div className="card">
        {e.assessments.length === 0 ? (
          <div className="empty">No assessments linked yet.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Client / Type</th><th>Status</th><th>Findings</th></tr></thead>
            <tbody>
              {e.assessments.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/dashboard/assessments/${a.id}`}>{a.clientName} — {typeLabel(a.type)}</Link></td>
                  <td><span className={`status-badge ${statusClass(a.status)}`}>{statusLabel(a.status)}</span></td>
                  <td><span className="count">{a._count.findings}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
