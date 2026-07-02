import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { typeLabel, statusLabel, statusClass, ASSESSMENT_STATUSES } from "@/lib/assessments";

function fmt(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { status } = await searchParams;

  const where: { organizationId: string; archivedAt?: null | { not: null }; status?: string } = {
    organizationId: session.orgId,
  };
  if (status === "Archived") where.archivedAt = { not: null };
  else {
    where.archivedAt = null;
    if (status && (ASSESSMENT_STATUSES as readonly string[]).includes(status)) where.status = status;
  }

  const assessments = await prisma.assessment.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  const filters = ["All", ...ASSESSMENT_STATUSES, "Archived"];
  const current = status ?? "All";

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Assessments</h1>
          <p>{session.organization.name}</p>
        </div>
        <Link className="btn btn-primary" href="/dashboard/assessments/new">New assessment</Link>
      </div>

      <div className="filters">
        {filters.map((f) => (
          <Link
            key={f}
            className={current === f ? "active" : ""}
            href={f === "All" ? "/dashboard/assessments" : `/dashboard/assessments?status=${f}`}
          >
            {f === "All" ? "All" : statusLabel(f)}
          </Link>
        ))}
      </div>

      <div className="card">
        {assessments.length === 0 ? (
          <div className="empty">
            No assessments here yet.{" "}
            <Link href="/dashboard/assessments/new">Create the first one</Link>.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Client</th><th>Type</th><th>Status</th><th>Dates</th><th>Lead</th><th></th></tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className={a.archivedAt ? "archived-row" : ""}>
                  <td><strong>{a.clientName}</strong></td>
                  <td className="muted">{typeLabel(a.type)}</td>
                  <td><span className={`status-badge ${statusClass(a.status)}`}>{statusLabel(a.status)}</span></td>
                  <td className="muted">{fmt(a.startDate)} → {fmt(a.endDate)}</td>
                  <td className="muted">{a.leadConsultant ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn btn-secondary" href={`/dashboard/assessments/${a.id}`} style={{ padding: "0.35rem 0.7rem", fontSize: "0.82rem" }}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
