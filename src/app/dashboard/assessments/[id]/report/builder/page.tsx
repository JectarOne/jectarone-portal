import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { parseConfig } from "@/lib/report-config";
import { saveReportConfigAction } from "@/actions/report";
import { ReportBuilderForm } from "./ReportBuilderForm";

export default async function ReportBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!hasRole(session.role, "MEMBER")) redirect("/dashboard/assessments");
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({ where: { id }, include: { reportConfig: true } });
  if (!assessment || assessment.organizationId !== session.orgId) notFound();

  const initial = parseConfig(assessment.reportConfig?.config);
  const bound = saveReportConfigAction.bind(null, id);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            <Link href="/dashboard/assessments">Assessments</Link> /{" "}
            <Link href={`/dashboard/assessments/${id}`}>{assessment.clientName}</Link> / Report builder
          </p>
          <h1>Report builder</h1>
          <p>Choose sections, order them, and add custom content. Deliverables (PDF / HTML / DOCX) honor this configuration.</p>
        </div>
      </div>
      <ReportBuilderForm action={bound} initial={initial} executiveSummary={assessment.executiveSummary ?? ""} assessmentId={id} />
    </>
  );
}
