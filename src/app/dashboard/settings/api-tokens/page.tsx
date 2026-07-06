import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { ApiTokenForm } from "./ApiTokenForm";
import { revokeApiTokenAction } from "@/actions/api-tokens";
import { EmptyState } from "@/components/findings-ui";

function dt(d: Date): string { return new Date(d).toISOString().slice(0, 10); }

export default async function ApiTokensPage() {
  const session = await getSession();
  if (!session) return null;
  const canManage = hasRole(session.role, "ADMIN");
  const tokens = await prisma.apiToken.findMany({
    where: { organizationId: session.orgId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  return (
    <div style={{ marginTop: "1rem" }}>
      {canManage
        ? <ApiTokenForm />
        : <div className="card" style={{ marginBottom: "1rem" }}><p className="muted">Only admins can create API tokens.</p></div>}
      <div className="card">
        <h3 className="chart-title">Active tokens</h3>
        {tokens.length === 0 ? (
          <EmptyState title="No API tokens" hint="Create a token to access the REST API." />
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Prefix</th><th>Created by</th><th>Last used</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td className="muted"><code>{t.prefix}…</code></td>
                  <td className="muted">{t.user?.name ?? "—"}</td>
                  <td className="muted">{t.lastUsedAt ? dt(t.lastUsedAt) : "never"}</td>
                  <td className="muted">{dt(t.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    {canManage && (
                      <form action={revokeApiTokenAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn btn-danger btn-sm" type="submit">Revoke</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
