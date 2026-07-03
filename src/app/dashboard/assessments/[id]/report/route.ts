import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { ReportDocument } from "@/lib/pdf/ReportDocument";

/** Generate the assessment's PDF report live from current DB data (GET, download). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!hasRole(session.role, "MEMBER")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment || assessment.organizationId !== session.orgId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const findings = await prisma.finding.findMany({
    where: { organizationId: session.orgId, assessmentId: id, archivedAt: null },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, title: true, severity: true, likelihood: true, impact: true, status: true,
      cvssScore: true, description: true, businessImpact: true, remediation: true, affectedAsset: true,
    },
  });

  const reportTitle = `${assessment.clientName} — Security Assessment Report`;
  const buffer = await renderToBuffer(
    ReportDocument({
      assessment: {
        clientName: assessment.clientName,
        type: assessment.type,
        scope: assessment.scope,
        status: assessment.status,
        startDate: assessment.startDate,
        endDate: assessment.endDate,
        leadConsultant: assessment.leadConsultant,
        executiveSummary: assessment.executiveSummary,
      },
      findings,
      reportTitle,
    })
  );

  await prisma.report.create({
    data: {
      organizationId: session.orgId,
      assessmentId: id,
      title: reportTitle,
      findingCount: findings.length,
      generatedById: session.userId,
    },
  });
  await logActivity({
    organizationId: session.orgId, userId: session.userId, action: "report.generated",
    detail: `${findings.length} finding(s)`, assessmentId: id,
  });

  const filename = `JectarOne-${assessment.clientName.replace(/[^a-z0-9-]+/gi, "-")}-report.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
