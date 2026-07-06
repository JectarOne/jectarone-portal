import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Timeline, type TimelineItem } from "@/components/timeline";

function dt(d: Date): string {
  return new Date(d).toISOString().slice(0, 16).replace("T", " ");
}

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) return null;

  const events = await prisma.activityLog.findMany({
    where: { organizationId: session.orgId },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { user: { select: { name: true } } },
  });

  const items: TimelineItem[] = events.map((e) => ({
    action: e.action, detail: e.detail, user: e.user?.name ?? null, when: dt(e.createdAt),
  }));

  return (
    <>
      <div className="topbar">
        <div><h1>Activity</h1><p>{session.organization.name}</p></div>
      </div>
      <div className="card">
        <Timeline items={items} />
      </div>
    </>
  );
}
