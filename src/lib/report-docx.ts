import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
} from "docx";
import { severityCounts, cvssBandCounts, averageCvss, countBy, prioritizedRecommendations, SEVERITY_ORDER } from "@/lib/report";
import { enabledSectionsInOrder, type SectionKey } from "@/lib/report-config";
import { typeLabel } from "@/lib/assessments";
import { label as findingLabel } from "@/lib/findings";
import type { ReportData } from "@/lib/report-html";

const BRAND = "2563EB";
function fmt(d: Date | null): string { return d ? new Date(d).toISOString().slice(0, 10) : "—"; }
function h2(text: string): Paragraph { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, color: BRAND, bold: true })] }); }
function p(text: string): Paragraph { return new Paragraph({ spacing: { after: 80 }, children: [new TextRun(text)] }); }

function grid(head: string[], rows: (string | number)[][]): Table {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const headRow = new TableRow({
    tableHeader: true,
    children: head.map((h) => new TableCell({ shading: { fill: BRAND }, borders, children: [new Paragraph({ children: [new TextRun({ text: h, color: "FFFFFF", bold: true })] })] })),
  });
  const bodyRows = (rows.length ? rows : [head.map(() => "—")]).map((r) =>
    new TableRow({ children: r.map((c) => new TableCell({ borders, children: [new Paragraph(String(c))] })) })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow, ...bodyRows] });
}

/** Render the assessment report as a branded .docx honoring the report config. */
export async function renderReportDocx(d: ReportData): Promise<Buffer> {
  const { assessment: a, findings, assets, score, config } = d;
  const sev = severityCounts(findings);
  const avg = averageCvss(findings);
  const cvss = cvssBandCounts(findings);
  const recs = prioritizedRecommendations(findings);

  const renderers: Record<SectionKey, () => (Paragraph | Table)[]> = {
    mgmt: () => [h2("Management Summary"),
      p(`Security posture: ${score.score}/100 — ${score.label} (${score.grade}).`),
      p(`This ${typeLabel(a.type).toLowerCase()} assessment of ${a.clientName} identified ${findings.length} finding(s) (${sev.Critical} critical, ${sev.High} high).${avg != null ? ` Average CVSS ${avg}.` : ""}`)],
    exec: () => [h2("Executive Summary"), p(a.executiveSummary || "No executive summary was provided.")],
    scope: () => [h2("Assessment Scope"),
      p(`Type: ${typeLabel(a.type)} · Status: ${findingLabel(a.status)} · Period: ${fmt(a.startDate)} → ${fmt(a.endDate)} · Lead: ${a.leadConsultant ?? "—"}`),
      p(a.scope || "No scope statement was recorded.")],
    risk: () => [h2("Risk Score & Matrix"), grid(["Severity", "Count"], SEVERITY_ORDER.map((s) => [findingLabel(s), sev[s]]))],
    cvss: () => [h2("CVSS Analysis"), p(`Average CVSS base score: ${avg ?? "—"}.`), grid(["Band", "Findings"], Object.entries(cvss))],
    owasp: () => [h2("OWASP Top 10 Mapping"), grid(["OWASP category", "Findings"], countBy(findings, "owaspCategory"))],
    mitre: () => [h2("MITRE ATT&CK Mapping"), grid(["Technique", "Findings"], countBy(findings, "mitreTechnique"))],
    cwe: () => [h2("CWE Summary"), grid(["CWE", "Findings"], countBy(findings, "cwe"))],
    assets: () => [h2("Assets Summary"), grid(["Asset", "Type", "Identifier", "Findings"], assets.map((x) => [x.name, findingLabel(x.type), x.identifier ?? "—", x.findingCount]))],
    overview: () => [h2("Findings Overview"), grid(["#", "Finding", "Severity", "Status", "CVSS"], findings.map((f, i) => [i + 1, f.title, findingLabel(f.severity), findingLabel(f.status), f.cvssScore ?? "—"]))],
    details: () => [h2("Detailed Findings"), ...findings.flatMap((f, i) => {
      const out: (Paragraph | Table)[] = [new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160 }, children: [new TextRun({ text: `${i + 1}. ${f.title} (${findingLabel(f.severity)})`, bold: true })] })];
      if (f.cvssScore != null || f.owaspCategory || f.cwe || f.mitreTechnique) out.push(p([f.cvssScore != null ? `CVSS ${f.cvssScore}` : "", f.owaspCategory ?? "", f.cwe ?? "", f.mitreTechnique ? `MITRE ${f.mitreTechnique}` : ""].filter(Boolean).join(" · ")));
      if (f.description) out.push(p(`Description. ${f.description}`));
      if (f.businessImpact) out.push(p(`Business impact. ${f.businessImpact}`));
      if (f.remediation) out.push(p(`Recommendation. ${f.remediation}`));
      return out;
    })],
    evidence: () => [h2("Evidence"), grid(["Finding", "Evidence files"], findings.filter((f) => f.evidenceCount > 0).map((f) => [f.title, f.evidenceCount]))],
    recs: () => [h2("Recommendations"), ...(config.customRecommendations ? [p(config.customRecommendations)] : []),
      ...(recs.length ? recs.map((r, i) => p(`${i + 1}. ${r.title} — ${r.remediation}`)) : [p("No recommendations recorded.")])],
    appendix: () => config.appendix ? [h2("Appendix"), p(config.appendix)] : [],
  };

  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "JectarOne — Cybersecurity Consulting", color: BRAND, bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CONFIDENTIAL", bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.TITLE, children: [new TextRun(`${typeLabel(a.type)} Assessment Report`)] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun(`Prepared for ${a.clientName} · ${fmt(a.startDate)} → ${fmt(a.endDate)}`)] }),
    ...enabledSectionsInOrder(config).flatMap((k) => renderers[k]()),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: `CONFIDENTIAL — intended solely for ${a.clientName}. Generated ${d.generatedAt} by ${d.generatedBy}.`, color: "64748B", size: 16 })] }),
  ];

  const doc = new Document({ creator: "JectarOne", title: d.reportTitle, sections: [{ children }] });
  return Packer.toBuffer(doc);
}
