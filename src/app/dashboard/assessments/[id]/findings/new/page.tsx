import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createFindingAction } from "@/actions/findings";
import { FindingForm } from "../FindingForm";

export default async function NewFindingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const a = await prisma.assessment.findUnique({ where: { id } });
  if (!a || a.organizationId !== session.orgId) notFound();

  const assets = await prisma.asset.findMany({
    where: { organizationId: session.orgId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const bound = createFindingAction.bind(null, id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> /{" "}
            <Link href={`/dashboard/assessments/${id}`}>{a.clientName}</Link> / New finding
          </p>
          <h1>New finding</h1>
        </div>
      </div>
      <FindingForm action={bound} submitLabel="Create finding" cancelHref={`/dashboard/assessments/${id}`} assets={assets} />
    </>
  );
}
