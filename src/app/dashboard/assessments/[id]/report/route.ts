import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import { isClosed } from "@/lib/findings";
import { isOverdue } from "@/lib/sla";
import { securityScore } from "@/lib/score";
import { logActivity } from "@/lib/activity";
import { parseConfig } from "@/lib/report-config";
import { renderReportHtml, type ReportData } from "@/lib/report-html";
import { renderReportDocx } from "@/lib/report-docx";
import { ReportDocument, type ReportFindingRow, type ReportAsset } from "@/lib/pdf/ReportDocument";

/** Generate the assessment report live from current DB data — PDF (default), HTML, or DOCX. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!hasRole(session.role, "MEMBER")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "html" ? "html"
    : new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const assessment = await prisma.assessment.findUnique({ where: { id }, include: { reportConfig: true } });
  if (!assessment || assessment.organizationId !== session.orgId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const config = parseConfig(assessment.reportConfig?.config);

  const [rawFindings, rawAssets] = await Promise.all([
    prisma.finding.findMany({
      where: { organizationId: session.orgId, assessmentId: id, archivedAt: null },
      orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, title: true, severity: true, likelihood: true, impact: true, status: true,
        cvssScore: true, cvssVector: true, cwe: true, owaspCategory: true, mitreTechnique: true,
        description: true, businessImpact: true, remediation: true, affectedAsset: true, dueDate: true,
        evidence: { where: { deletedAt: null }, select: { id: true } },
      },
    }),
    prisma.asset.findMany({
      where: { organizationId: session.orgId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { name: true, type: true, identifier: true, _count: { select: { findings: true } } },
    }),
  ]);

  const findings: ReportFindingRow[] = rawFindings.map((f) => ({
    id: f.id, title: f.title, severity: f.severity, likelihood: f.likelihood, impact: f.impact, status: f.status,
    cvssScore: f.cvssScore, cvssVector: f.cvssVector, cwe: f.cwe, owaspCategory: f.owaspCategory,
    mitreTechnique: f.mitreTechnique, description: f.description, businessImpact: f.businessImpact,
    remediation: f.remediation, affectedAsset: f.affectedAsset, evidenceCount: f.evidence.length,
  }));
  const assets: ReportAsset[] = rawAssets.map((a) => ({ name: a.name, type: a.type, identifier: a.identifier, findingCount: a._count.findings }));

  const open = rawFindings.filter((f) => !isClosed(f.status));
  const overdue = rawFindings.filter((f) => isOverdue(f.dueDate, f.status)).length;
  const score = securityScore(open, overdue);

  const reportTitle = `${assessment.clientName} — ${assessment.type} Assessment Report`;
  const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");

  const data: ReportData = {
    assessment: {
      clientName: assessment.clientName, orgName: session.organization.name, type: assessment.type,
      scope: assessment.scope, status: assessment.status, startDate: assessment.startDate,
      endDate: assessment.endDate, leadConsultant: assessment.leadConsultant, executiveSummary: assessment.executiveSummary,
    },
    findings, assets, score, reportTitle, generatedBy: session.user.name, generatedAt, config,
  };

  // Every generation writes a Report audit row + activity entry.
  await prisma.report.create({
    data: { organizationId: session.orgId, assessmentId: id, title: reportTitle, findingCount: findings.length, generatedById: session.userId },
  });
  await logActivity({ organizationId: session.orgId, userId: session.userId, action: "report.generated", detail: `${format.toUpperCase()} · ${findings.length} finding(s)`, assessmentId: id });

  const base = `JectarOne-${assessment.clientName.replace(/[^a-z0-9-]+/gi, "-")}-report`;

  if (format === "html") {
    return new NextResponse(renderReportHtml(data), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="${base}.html"`, "Cache-Control": "no-store" },
    });
  }
  if (format === "docx") {
    const docx = await renderReportDocx(data);
    return new NextResponse(new Uint8Array(docx), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${base}.docx"`, "Cache-Control": "no-store",
      },
    });
  }

  const buffer = await renderToBuffer(
    ReportDocument({
      ...data,
      disabled: config.disabled,
      customRecommendations: config.customRecommendations,
      appendix: config.appendix,
    })
  );
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"`, "Cache-Control": "no-store" },
  });
}
