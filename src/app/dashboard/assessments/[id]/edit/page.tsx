import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateAssessmentAction } from "@/actions/assessments";
import { AssessmentForm } from "../../AssessmentForm";

function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function EditAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const a = await prisma.assessment.findUnique({ where: { id } });
  if (!a || a.organizationId !== session.orgId) notFound();

  const engagements = await prisma.engagement.findMany({
    where: { organizationId: session.orgId, archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const boundUpdate = updateAssessmentAction.bind(null, a.id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> /{" "}
            <Link href={`/dashboard/assessments/${a.id}`}>{a.clientName}</Link> / Edit
          </p>
          <h1>Edit assessment</h1>
        </div>
      </div>

      <AssessmentForm
        action={boundUpdate}
        submitLabel="Save changes"
        cancelHref={`/dashboard/assessments/${a.id}`}
        engagements={engagements}
        values={{
          clientName: a.clientName, type: a.type, status: a.status,
          scope: a.scope, startDate: toDateInput(a.startDate), endDate: toDateInput(a.endDate),
          leadConsultant: a.leadConsultant, executiveSummary: a.executiveSummary, notes: a.notes,
          engagementId: a.engagementId,
        }}
      />
    </>
  );
}
