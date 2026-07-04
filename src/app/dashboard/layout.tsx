import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { roleLabel } from "@/lib/rbac";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="side">
        <span className="brand" style={{ marginBottom: "1rem" }}>
          <span className="mark">J</span>
          <span>JectarOne<small>Client Portal</small></span>
        </span>
        <nav className="side-nav" aria-label="Primary">
          <Link className="nav-link" href="/dashboard">Overview</Link>
          <Link className="nav-link" href="/dashboard/assessments">Assessments</Link>
          <Link className="nav-link" href="/dashboard/findings">Findings</Link>
          <Link className="nav-link" href="/dashboard/assets">Assets</Link>
          <Link className="nav-link" href="/dashboard/team">Team</Link>
        </nav>
        <div className="spacer" />
        <div className="whoami">
          <strong>{session.user.name}</strong>
          {session.organization.name} · {roleLabel(session.role)}
          <form action={logoutAction} style={{ marginTop: "0.7rem" }}>
            <button className="btn btn-secondary btn-block" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main" id="main">{children}</main>
    </div>
  );
}
