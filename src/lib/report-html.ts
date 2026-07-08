import { severityCounts, cvssBandCounts, averageCvss, countBy, prioritizedRecommendations, SEVERITY_ORDER } from "@/lib/report";
import { enabledSectionsInOrder, type ReportConfigData, type SectionKey } from "@/lib/report-config";
import { typeLabel } from "@/lib/assessments";
import { label as findingLabel } from "@/lib/findings";
import type { ReportFindingRow, ReportAsset, ReportAssessment } from "@/lib/pdf/ReportDocument";
import type { Score } from "@/lib/score";

export type ReportData = {
  assessment: ReportAssessment;
  findings: ReportFindingRow[];
  assets: ReportAsset[];
  score: Score;
  reportTitle: string;
  generatedBy: string;
  generatedAt: string;
  config: ReportConfigData;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function fmt(d: Date | null): string { return d ? new Date(d).toISOString().slice(0, 10) : "—"; }
function table(head: string[], rows: (string | number)[][]): string {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}">None recorded.</td></tr>`
  }</tbody></table>`;
}

/** Render a branded, standalone HTML deliverable honoring the report config. */
export function renderReportHtml(d: ReportData): string {
  const { assessment: a, findings, assets, score, config } = d;
  const sev = severityCounts(findings);
  const avg = averageCvss(findings);
  const cvss = cvssBandCounts(findings);
  const owasp = countBy(findings, "owaspCategory");
  const mitre = countBy(findings, "mitreTechnique");
  const cwe = countBy(findings, "cwe");
  const recs = prioritizedRecommendations(findings);

  const renderers: Record<SectionKey, () => string> = {
    mgmt: () => `<section><h2>Management Summary</h2>
      <p class="score"><span class="score-big">${score.score}</span>/100 · ${esc(score.label)} (${esc(score.grade)})</p>
      <p>This ${esc(typeLabel(a.type).toLowerCase())} assessment of ${esc(a.clientName)} identified ${findings.length} finding(s) (${sev.Critical} critical, ${sev.High} high).${avg != null ? ` Average CVSS ${avg}.` : ""}</p></section>`,
    exec: () => `<section><h2>Executive Summary</h2><p>${esc(a.executiveSummary || "No executive summary was provided.")}</p></section>`,
    scope: () => `<section><h2>Assessment Scope</h2><ul>
      <li>Type: ${esc(typeLabel(a.type))}</li><li>Status: ${esc(findingLabel(a.status))}</li>
      <li>Period: ${fmt(a.startDate)} → ${fmt(a.endDate)}</li><li>Lead: ${esc(a.leadConsultant ?? "—")}</li></ul>
      <p>${esc(a.scope || "No scope statement was recorded.")}</p></section>`,
    risk: () => `<section><h2>Risk Score &amp; Matrix</h2><div class="sevgrid">${
      SEVERITY_ORDER.map((s) => `<div class="sev sev-${s.toLowerCase()}"><b>${sev[s]}</b><span>${esc(findingLabel(s))}</span></div>`).join("")}</div></section>`,
    cvss: () => `<section><h2>CVSS Analysis</h2><p>Average CVSS base score: ${avg ?? "—"}.</p>${table(["Band", "Findings"], Object.entries(cvss))}</section>`,
    owasp: () => `<section><h2>OWASP Top 10 Mapping</h2>${table(["OWASP category", "Findings"], owasp)}</section>`,
    mitre: () => `<section><h2>MITRE ATT&amp;CK Mapping</h2>${table(["Technique", "Findings"], mitre)}</section>`,
    cwe: () => `<section><h2>CWE Summary</h2>${table(["CWE", "Findings"], cwe)}</section>`,
    assets: () => `<section><h2>Assets Summary</h2>${table(["Asset", "Type", "Identifier", "Findings"], assets.map((x) => [x.name, findingLabel(x.type), x.identifier ?? "—", x.findingCount]))}</section>`,
    overview: () => `<section><h2>Findings Overview</h2>${table(["#", "Finding", "Severity", "Status", "CVSS"], findings.map((f, i) => [i + 1, f.title, findingLabel(f.severity), findingLabel(f.status), f.cvssScore ?? "—"]))}</section>`,
    details: () => `<section><h2>Detailed Findings</h2>${findings.map((f, i) => `<div class="finding">
      <h3>${i + 1}. ${esc(f.title)} <span class="chip sev-${f.severity.toLowerCase()}">${esc(findingLabel(f.severity))}</span></h3>
      <p class="meta">${f.cvssScore != null ? `CVSS ${f.cvssScore} · ` : ""}${f.owaspCategory ? `${esc(f.owaspCategory)} · ` : ""}${f.cwe ? `${esc(f.cwe)} · ` : ""}${f.mitreTechnique ? `MITRE ${esc(f.mitreTechnique)}` : ""}</p>
      ${f.description ? `<p><b>Description.</b> ${esc(f.description)}</p>` : ""}
      ${f.businessImpact ? `<p><b>Business impact.</b> ${esc(f.businessImpact)}</p>` : ""}
      ${f.remediation ? `<p><b>Recommendation.</b> ${esc(f.remediation)}</p>` : ""}</div>`).join("")}</section>`,
    evidence: () => `<section><h2>Evidence</h2>${table(["Finding", "Evidence files"], findings.filter((f) => f.evidenceCount > 0).map((f) => [f.title, f.evidenceCount]))}</section>`,
    recs: () => `<section><h2>Recommendations</h2>${config.customRecommendations ? `<p>${esc(config.customRecommendations)}</p>` : ""}<ol>${
      recs.map((r) => `<li><b>${esc(r.title)}</b> — ${esc(r.remediation)}</li>`).join("") || "<li>No recommendations recorded.</li>"}</ol></section>`,
    appendix: () => config.appendix ? `<section><h2>Appendix</h2><p>${esc(config.appendix)}</p></section>` : "",
  };

  const body = enabledSectionsInOrder(config).map((k) => renderers[k]()).join("\n");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.reportTitle)}</title><style>
:root{--bg:#08111f;--primary:#2563eb;--accent:#38bdf8;--text:#0f172a;--muted:#64748b;--line:#e2e8f0}
*{box-sizing:border-box}body{font-family:Inter,system-ui,Segoe UI,sans-serif;color:var(--text);margin:0;background:#f1f5f9}
.wrap{max-width:900px;margin:0 auto;background:#fff;padding:48px}
.cover{background:var(--bg);color:#f8fafc;padding:56px;text-align:center;border-radius:12px;margin-bottom:32px}
.cover h1{margin:.4rem 0;font-size:1.8rem}.cover .sub{color:var(--accent);letter-spacing:2px;font-size:.75rem}
.pill{display:inline-block;background:var(--primary);color:#fff;border-radius:999px;padding:2px 12px;font-size:.7rem;font-weight:700;margin:8px 0}
h2{color:var(--primary);border-bottom:2px solid var(--line);padding-bottom:6px;margin-top:32px}
table{width:100%;border-collapse:collapse;margin:8px 0;font-size:.9rem}th{background:var(--primary);color:#fff;text-align:left;padding:6px}
td{border-bottom:1px solid var(--line);padding:6px}
.sevgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.sev{padding:12px;border-radius:8px;text-align:center;color:#fff}
.sev b{display:block;font-size:1.5rem}.sev span{font-size:.75rem}
.sev-critical{background:#ef4444}.sev-high{background:#f59e0b}.sev-medium{background:#eab308}.sev-low{background:#22c55e}.sev-informational{background:#38bdf8}
.chip{border-radius:4px;padding:1px 8px;font-size:.7rem;color:#fff}.finding{border-bottom:1px solid var(--line);padding:8px 0}
.meta{color:var(--muted);font-size:.8rem}.score-big{font-size:2rem;font-weight:800;color:var(--primary)}
footer{margin-top:40px;color:var(--muted);font-size:.75rem;border-top:1px solid var(--line);padding-top:12px}
</style></head><body><div class="wrap">
<div class="cover"><div class="sub">JECTARONE · CYBERSECURITY CONSULTING</div><div class="pill">CONFIDENTIAL</div>
<h1>${esc(typeLabel(a.type))} Assessment Report</h1><p>Prepared for ${esc(a.clientName)}</p>
<p>${a.leadConsultant ? `Lead: ${esc(a.leadConsultant)} · ` : ""}${fmt(a.startDate)} → ${fmt(a.endDate)}</p></div>
${body}
<footer>CONFIDENTIAL — intended solely for ${esc(a.clientName)}. Generated ${esc(d.generatedAt)} by ${esc(d.generatedBy)}. · contact@jectar.one</footer>
</div></body></html>`;
}
