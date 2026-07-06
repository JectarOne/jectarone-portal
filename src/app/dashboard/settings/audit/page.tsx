import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Timeline, type TimelineItem } from "@/components/timeline";

function dt(d: Date): string { return new Date(d).toISOString().slice(0, 16).replace("T", " "); }

const FILTERS: [string, string][] = [
  ["", "All"], ["finding", "Findings"], ["evidence", "Evidence"],
  ["report", "Reports"], ["security", "Security"], ["apitoken", "API tokens"], ["org", "Org"],
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { cat } = await searchParams;

  const where: { organizationId: string; action?: { startsWith: string } } = { organizationId: session.orgId };
  if (cat) where.action = { startsWith: `${cat}.` };

  const events = await prisma.activityLog.findMany({
    where, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } },
  });

  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="filters" style={{ marginBottom: "1rem" }}>
        {FILTERS.map(([key, label]) => (
          <Link key={key} className={(cat ?? "") === key ? "active" : ""} href={key ? `/dashboard/settings/audit?cat=${key}` : "/dashboard/settings/audit"}>{label}</Link>
        ))}
      </div>
      <div className="card">
        <Timeline items={events.map((e): TimelineItem => ({ action: e.action, detail: e.detail, user: e.user?.name ?? null, when: dt(e.createdAt) }))} />
      </div>
    </div>
  );
}
