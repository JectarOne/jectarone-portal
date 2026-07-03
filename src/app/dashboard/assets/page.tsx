import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { label } from "@/lib/findings";
import { setAssetArchivedAction, deleteAssetAction } from "@/actions/assets";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const sp = await searchParams;
  const showArchived = sp.archived === "1";

  const assets = await prisma.asset.findMany({
    where: { organizationId: session.orgId, archivedAt: showArchived ? { not: null } : null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { findings: true } } },
  });
  const canDelete = hasRole(session.role, "ADMIN");

  return (
    <>
      <div className="topbar">
        <div><h1>Assets</h1><p>{session.organization.name}</p></div>
        <Link className="btn btn-primary" href="/dashboard/assets/new">New asset</Link>
      </div>

      <div className="filters">
        <Link className={!showArchived ? "active" : ""} href="/dashboard/assets">Active</Link>
        <Link className={showArchived ? "active" : ""} href="/dashboard/assets?archived=1">Archived</Link>
      </div>

      <div className="card">
        {assets.length === 0 ? (
          <div className="empty">No assets yet. <Link href="/dashboard/assets/new">Add the first one</Link>.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Identifier</th><th>Findings</th><th></th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.name}</strong></td>
                  <td className="muted">{label(a.type)}</td>
                  <td className="muted">{a.identifier ?? "—"}</td>
                  <td className="muted">{a._count.findings}</td>
                  <td style={{ textAlign: "right", display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                    <Link className="btn btn-secondary" href={`/dashboard/assets/${a.id}/edit`} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem" }}>Edit</Link>
                    <form action={setAssetArchivedAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="archive" value={a.archivedAt ? "0" : "1"} />
                      <button className="btn btn-secondary" type="submit" style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem" }}>
                        {a.archivedAt ? "Restore" : "Archive"}
                      </button>
                    </form>
                    {canDelete && (
                      <form action={deleteAssetAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="btn btn-danger" type="submit" style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem" }}>Delete</button>
                      </form>
                    )}
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
