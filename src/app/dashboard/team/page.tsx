import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole, roleLabel, ROLES } from "@/lib/rbac";
import { changeRoleAction, removeMemberAction } from "@/actions/team";
import { AddMemberForm } from "./AddMemberForm";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = hasRole(session.role, "ADMIN");
  const isOwner = session.role === "OWNER";

  const members = await prisma.membership.findMany({
    where: { organizationId: session.orgId },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Team</h1>
          <p>{session.organization.name} · {members.length} member{members.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {isAdmin && <AddMemberForm canGrantOwner={isOwner} />}

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.userId === session.userId;
              return (
                <tr key={m.id}>
                  <td>{m.user.name}{isSelf && <span className="muted"> (you)</span>}</td>
                  <td className="muted">{m.user.email}</td>
                  <td>
                    {isOwner && !isSelf ? (
                      <form action={changeRoleAction} className="inline-form">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select name="role" defaultValue={m.role} className="badge" style={{ background: "var(--bg-deep)", color: "var(--text)", border: "1px solid var(--line)", padding: "0.2rem 0.4rem" }}>
                          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                        </select>
                        <button className="btn btn-secondary" type="submit" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}>Save</button>
                      </form>
                    ) : (
                      <span className="badge">{roleLabel(m.role)}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isAdmin && !isSelf && (
                      <form action={removeMemberAction} className="inline-form">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="btn btn-danger" type="submit" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}>Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.88rem" }}>
          Only owners and admins can manage team members.
        </p>
      )}
    </>
  );
}
