import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAssessmentAction } from "@/actions/assessments";
import { AssessmentForm } from "../AssessmentForm";

export default async function NewAssessmentPage({ searchParams }: { searchParams: Promise<{ engagement?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { engagement: engagementParam } = await searchParams;

  const engagements = await prisma.engagement.findMany({
    where: { organizationId: session.orgId, archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  // Preselect the engagement when arriving from an engagement page.
  const preselect = engagements.some((e) => e.id === engagementParam) ? engagementParam : undefined;

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> / New
          </p>
          <h1>New assessment</h1>
        </div>
      </div>

      <AssessmentForm
        action={createAssessmentAction}
        submitLabel="Create assessment"
        cancelHref="/dashboard/assessments"
        engagements={engagements}
        values={{ engagementId: preselect }}
      />
    </>
  );
}
