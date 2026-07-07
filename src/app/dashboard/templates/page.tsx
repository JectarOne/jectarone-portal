import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { label, severityClass, TEMPLATE_CATEGORIES } from "@/lib/findings";
import { deleteTemplateAction } from "@/actions/templates";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { q = "", category = "" } = await searchParams;
  const canEdit = hasRole(session.role, "MEMBER");
  const canDelete = hasRole(session.role, "ADMIN");

  const templates = await prisma.findingTemplate.findMany({
    where: {
      archivedAt: null,
      OR: [{ organizationId: session.orgId }, { organizationId: null }],
      ...(category ? { category } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Finding templates</h1>
          <p>Reusable finding library with CVSS / CWE / OWASP / MITRE and remediation defaults.</p>
        </div>
        {canEdit && <Link className="btn btn-primary" href="/dashboard/templates/new">New template</Link>}
      </div>

      <form className="toolbar" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Search templates…" aria-label="Search templates" />
        <select name="category" defaultValue={category} aria-label="Filter by category">
          <option value="">All categories</option>
          {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>

      {templates.length === 0 ? (
        <div className="card empty">
          <p>No templates match.</p>
          {canEdit && <p><Link href="/dashboard/templates/new">Create the first template</Link>.</p>}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Severity</th><th>CVSS</th><th>OWASP</th><th></th></tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const builtin = t.organizationId === null;
              return (
                <tr key={t.id}>
                  <td>
                    {t.title}{" "}
                    {builtin && <span className="badge" title="Built-in template">built-in</span>}
                  </td>
                  <td>{label(t.category)}</td>
                  <td><span className={`badge ${severityClass(t.severity)}`}>{label(t.severity)}</span></td>
                  <td>{t.cvssScore ?? "—"}</td>
                  <td className="muted">{t.owaspCategory ?? "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit && !builtin && <Link className="linkbtn" href={`/dashboard/templates/${t.id}/edit`}>Edit</Link>}
                    {canDelete && !builtin && (
                      <form action={deleteTemplateAction} className="inline-form" style={{ display: "inline-flex", marginLeft: "0.6rem" }}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="linkbtn danger" type="submit">Delete</button>
                      </form>
                    )}
                    {builtin && <span className="muted" style={{ fontSize: "0.78rem" }}>read-only</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
