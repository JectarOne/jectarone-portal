import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deviceName } from "@/lib/device";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { revokeSessionAction, revokeOtherSessionsAction } from "@/actions/sessions";

function dt(d: Date): string { return new Date(d).toISOString().slice(0, 16).replace("T", " "); }

export default async function SessionsPage() {
  const session = await getSession();
  if (!session) return null;

  const [sessions, events] = await Promise.all([
    prisma.session.findMany({ where: { userId: session.userId, revokedAt: null }, orderBy: { lastSeenAt: "desc" } }),
    prisma.activityLog.findMany({
      where: { organizationId: session.orgId, userId: session.userId, action: { startsWith: "security." } },
      orderBy: { createdAt: "desc" }, take: 20,
    }),
  ]);

  return (
    <>
      <div className="section-head" style={{ marginTop: "1rem" }}>
        <h2>Active sessions <span className="count">{sessions.length}</span></h2>
        <form action={revokeOtherSessionsAction}>
          <button className="btn btn-secondary" type="submit">Sign out all other sessions</button>
        </form>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Device</th><th>IP</th><th>Started</th><th>Last active</th><th></th></tr></thead>
          <tbody>
            {sessions.map((s) => {
              const current = s.id === session.sessionId;
              return (
                <tr key={s.id}>
                  <td><strong>{deviceName(s.userAgent)}</strong>{current && <span className="badge sev-low" style={{ marginLeft: 8 }}>This device</span>}</td>
                  <td className="muted">{s.ip ?? "—"}</td>
                  <td className="muted">{dt(s.createdAt)}</td>
                  <td className="muted">{dt(s.lastSeenAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    {!current && (
                      <form action={revokeSessionAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn btn-danger btn-sm" type="submit">Revoke</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-head"><h2>Security events</h2></div>
      <div className="card">
        <Timeline items={events.map((e): TimelineItem => ({ action: e.action, detail: e.detail, user: session.user.name, when: dt(e.createdAt) }))} />
      </div>
    </>
  );
}
