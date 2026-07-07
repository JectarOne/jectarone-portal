import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createFindingAction } from "@/actions/findings";
import { label } from "@/lib/findings";
import { FindingForm } from "../FindingForm";

export default async function NewFindingPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const { template: templateId } = await searchParams;

  const a = await prisma.assessment.findUnique({ where: { id } });
  if (!a || a.organizationId !== session.orgId) notFound();

  const assets = await prisma.asset.findMany({
    where: { organizationId: session.orgId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Templates available to prefill from: built-ins (org null) + this org's own.
  const templates = await prisma.findingTemplate.findMany({
    where: { archivedAt: null, OR: [{ organizationId: session.orgId }, { organizationId: null }] },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: { id: true, title: true, category: true },
  });

  // If ?template=<id> and it is visible to this org, prefill the form from it.
  let values = {};
  let fromTitle: string | null = null;
  if (templateId) {
    const t = await prisma.findingTemplate.findUnique({ where: { id: templateId } });
    if (t && (t.organizationId === session.orgId || t.organizationId === null)) {
      fromTitle = t.title;
      values = {
        title: t.title, severity: t.severity, likelihood: t.likelihood, impact: t.impact,
        cvssScore: t.cvssScore, cvssVector: t.cvssVector, cwe: t.cwe,
        owaspCategory: t.owaspCategory, mitreTechnique: t.mitreTechnique,
        description: t.description, businessImpact: t.businessImpact, remediation: t.remediation,
      };
    }
  }

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

      {templates.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 className="sub">Start from a template</h3>
          {fromTitle && (
            <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              Prefilled from <strong>{fromTitle}</strong>.{" "}
              <Link href={`/dashboard/assessments/${id}/findings/new`}>Clear</Link>
            </p>
          )}
          <div className="filters" role="list">
            {templates.map((t) => (
              <Link
                key={t.id}
                role="listitem"
                className={`filter${t.id === templateId ? " active" : ""}`}
                href={`/dashboard/assessments/${id}/findings/new?template=${t.id}`}
              >
                <span className="muted">{label(t.category)}</span> · {t.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      <FindingForm
        key={templateId ?? "blank"}
        action={bound}
        values={values}
        submitLabel="Create finding"
        cancelHref={`/dashboard/assessments/${id}`}
        assets={assets}
      />
    </>
  );
}
