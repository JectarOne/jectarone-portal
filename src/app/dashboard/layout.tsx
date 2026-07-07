import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { roleLabel } from "@/lib/rbac";
import { NavLink, Avatar } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Gate the app on a verified email. Existing accounts were grandfathered by
  // the 0003 migration; only new, unverified signups are redirected.
  if (!session.user.emailVerifiedAt) redirect("/verify-email");

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="side">
        <span className="brand" style={{ marginBottom: "1rem" }}>
          <span className="mark">J</span>
          <span>JectarOne<small>Client Portal</small></span>
        </span>
        <nav className="side-nav" aria-label="Primary">
          <NavLink href="/dashboard">Overview</NavLink>
          <NavLink href="/dashboard/assessments">Assessments</NavLink>
          <NavLink href="/dashboard/findings">Findings</NavLink>
          <NavLink href="/dashboard/templates">Templates</NavLink>
          <NavLink href="/dashboard/assets">Assets</NavLink>
          <NavLink href="/dashboard/activity">Activity</NavLink>
          <NavLink href="/dashboard/team">Team</NavLink>
          <NavLink href="/dashboard/settings">Settings</NavLink>
        </nav>
        <div className="spacer" />
        <div className="whoami">
          <span className="whoami-head">
            <Avatar name={session.user.name} />
            <strong>{session.user.name}</strong>
          </span>
          {session.organization.name} · {roleLabel(session.role)}
          <ThemeToggle />
          <form action={logoutAction} style={{ marginTop: "0.7rem" }}>
            <button className="btn btn-secondary btn-block" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main" id="main">{children}</main>
    </div>
  );
}
