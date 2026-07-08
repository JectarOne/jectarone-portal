import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { updateEngagementAction } from "@/actions/engagements";
import { EngagementForm } from "../../EngagementForm";

function dateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function EditEngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!hasRole(session.role, "MEMBER")) redirect("/dashboard/engagements");
  const { id } = await params;

  const e = await prisma.engagement.findUnique({ where: { id } });
  if (!e || e.organizationId !== session.orgId) notFound();

  const bound = updateEngagementAction.bind(null, id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/engagements">Engagements</Link> /{" "}
            <Link href={`/dashboard/engagements/${id}`}>{e.name}</Link> / Edit
          </p>
          <h1>Edit engagement</h1>
        </div>
      </div>
      <EngagementForm
        action={bound}
        values={{ name: e.name, clientName: e.clientName, scope: e.scope, leadConsultant: e.leadConsultant, startDate: dateInput(e.startDate), endDate: dateInput(e.endDate) }}
        submitLabel="Save changes"
        cancelHref={`/dashboard/engagements/${id}`}
      />
    </>
  );
}
