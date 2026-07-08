import { Document, Page, View, Text, Link, StyleSheet, Svg, Path } from "@react-pdf/renderer";
import { typeLabel } from "@/lib/assessments";
import { label as findingLabel, risk } from "@/lib/findings";
import type { Score } from "@/lib/score";
import {
  SEVERITY_ORDER, severityCounts, cvssBandCounts, averageCvss, countBy,
  prioritizedRecommendations, type ReportFinding,
} from "@/lib/report";

const BRAND = {
  bg: "#08111F", primary: "#2563EB", accent: "#38BDF8", text: "#0F172A",
  muted: "#64748B", faint: "#94A3B8", line: "#E2E8F0", panel: "#F1F5F9",
  critical: "#EF4444", high: "#F59E0B", medium: "#EAB308", low: "#22C55E", info: "#38BDF8",
};

function sevColor(s: string): string {
  return { Critical: BRAND.critical, High: BRAND.high, Medium: BRAND.medium, Low: BRAND.low, Informational: BRAND.info }[s] ?? BRAND.muted;
}
function riskColor(level: string): string {
  return { Critical: BRAND.critical, High: BRAND.high, Medium: BRAND.medium, Low: BRAND.low, VeryLow: "#64748B" }[level] ?? BRAND.muted;
}
function gradeColor(g: string): string {
  return { A: BRAND.low, B: BRAND.low, C: BRAND.medium, D: BRAND.high, F: BRAND.critical }[g] ?? BRAND.muted;
}
function fmt(d: Date | null): string { return d ? new Date(d).toISOString().slice(0, 10) : "—"; }
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ""))).toUpperCase() || "?";
}

const s = StyleSheet.create({
  cover: { backgroundColor: BRAND.bg, height: "100%", padding: 48, justifyContent: "center", alignItems: "center" },
  coverBrand: { color: "#F8FAFC", fontSize: 30, fontWeight: 700, marginTop: 20 },
  coverSub: { color: BRAND.accent, fontSize: 10, letterSpacing: 2, marginTop: 4 },
  pill: { marginTop: 26, backgroundColor: BRAND.primary, color: "#fff", fontSize: 9, fontWeight: 700, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10 },
  coverTitle: { color: "#F8FAFC", fontSize: 21, marginTop: 30, textAlign: "center" },
  monogram: { width: 54, height: 54, borderRadius: 12, backgroundColor: BRAND.accent, color: BRAND.bg, fontSize: 20, fontWeight: 700, textAlign: "center", paddingTop: 14, marginTop: 22 },
  coverMeta: { color: "#94A3B8", fontSize: 10, marginTop: 8, textAlign: "center" },
  coverFooter: { position: "absolute", bottom: 40, left: 48, right: 48, textAlign: "center" },
  coverFooterText: { color: "#94A3B8", fontSize: 8.5, marginTop: 2 },

  page: { padding: 40, paddingTop: 54, paddingBottom: 52, fontSize: 10, color: BRAND.text, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.line, paddingBottom: 8, marginBottom: 14 },
  headerBrand: { fontSize: 10, fontWeight: 700, color: BRAND.primary },
  headerMeta: { fontSize: 8, color: BRAND.muted },
  footerFixed: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: BRAND.line, paddingTop: 6 },
  footerText: { fontSize: 8, color: BRAND.muted },

  h1: { fontSize: 16, fontWeight: 700, color: BRAND.primary, marginTop: 6, marginBottom: 10 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 4 },
  p: { fontSize: 10, lineHeight: 1.55, marginBottom: 4, color: "#1E293B" },
  muted: { color: BRAND.muted },

  tocRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BRAND.line },
  tocLink: { fontSize: 11, color: BRAND.primary, textDecoration: "none" },
  tocNum: { fontSize: 10, color: BRAND.muted },

  panel: { backgroundColor: BRAND.panel, borderRadius: 6, padding: 12, marginBottom: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  scoreBig: { fontSize: 40, fontWeight: 700 },
  scoreOf: { fontSize: 12, color: BRAND.muted, marginLeft: 4 },

  table: { borderWidth: 1, borderColor: BRAND.line, borderRadius: 2, marginBottom: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BRAND.line },
  th: { backgroundColor: BRAND.primary, color: "#fff", fontSize: 8.5, fontWeight: 700, padding: 5 },
  td: { fontSize: 8.5, padding: 5, color: BRAND.text },

  chip: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, fontSize: 8, fontWeight: 700, color: "#fff", alignSelf: "flex-start" },

  sevGrid: { flexDirection: "row", marginBottom: 8 },
  sevCell: { flex: 1, padding: 8, alignItems: "center", marginRight: 3, borderRadius: 4 },
  sevCount: { fontSize: 16, fontWeight: 700, color: "#fff" },
  sevLabel: { fontSize: 8, color: "#fff", marginTop: 2 },

  matrix: { marginBottom: 8 },
  matrixRow: { flexDirection: "row" },
  matrixAxis: { width: 46, fontSize: 7, color: BRAND.muted, justifyContent: "center", textAlign: "right", paddingRight: 4 },
  matrixCell: { flex: 1, height: 26, margin: 1, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  matrixCellTxt: { fontSize: 10, fontWeight: 700, color: "#fff" },

  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barLabel: { width: 70, fontSize: 9, color: BRAND.muted },
  barTrack: { flex: 1, height: 12, backgroundColor: BRAND.panel, borderRadius: 6, marginHorizontal: 6 },
  barVal: { width: 22, fontSize: 9, fontWeight: 700, textAlign: "right" },

  findingBlock: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BRAND.line },
  findingTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  findingTitle: { fontSize: 11, fontWeight: 700, maxWidth: "72%" },
  kv: { flexDirection: "row", flexWrap: "wrap", marginBottom: 3 },
  kvItem: { fontSize: 8.5, color: BRAND.muted, marginRight: 12 },
});

function Shield() {
  return (
    <Svg width={60} height={60} viewBox="0 0 64 64">
      <Path d="M32 7 L53 15.5 V32 C53 44.5 43.6 52.7 32 57 C20.4 52.7 11 44.5 11 32 V15.5 Z" fill={BRAND.primary} />
      <Path d="M23 32.5 L29.5 39 L42 24.5" stroke="#F8FAFC" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function Chrome({ reportTitle }: { reportTitle: string }) {
  return (
    <>
      <View style={s.headerRow} fixed>
        <Text style={s.headerBrand}>JectarOne</Text>
        <Text style={s.headerMeta}>{reportTitle}</Text>
      </View>
      <View style={s.footerFixed} fixed>
        <Text style={s.footerText}>contact@jectar.one · CONFIDENTIAL</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  );
}

// `bookmark`/`id` are valid @react-pdf props (PDF outline + internal-link anchor)
// but are missing from the installed type defs; cast to attach them.
const anchor = (id: string, bookmark: string) => ({ id, bookmark } as Record<string, unknown>);

function SectionTitle({ id, children }: { id: string; children: string }) {
  return <Text style={s.h1} {...anchor(id, children)}>{children}</Text>;
}

function Table({ head, rows, widths }: { head: string[]; rows: (string | number)[][]; widths: string[] }) {
  return (
    <View style={s.table}>
      <View style={s.tr}>{head.map((h, i) => <Text key={i} style={[s.th, { width: widths[i] }]}>{h}</Text>)}</View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.tr}>{r.map((c, ci) => <Text key={ci} style={[s.td, { width: widths[ci] }]}>{String(c)}</Text>)}</View>
      ))}
      {rows.length === 0 && <View style={s.tr}><Text style={[s.td, { width: "100%" }]}>None recorded.</Text></View>}
    </View>
  );
}

function Bars({ items, max }: { items: { label: string; value: number; color: string }[]; max: number }) {
  return (
    <View>
      {items.map((it) => (
        <View key={it.label} style={s.barRow}>
          <Text style={s.barLabel}>{it.label}</Text>
          <View style={s.barTrack}><View style={{ width: `${(it.value / Math.max(1, max)) * 100}%`, height: 12, backgroundColor: it.color, borderRadius: 6 }} /></View>
          <Text style={s.barVal}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

export type ReportFindingRow = ReportFinding & {
  id: string; cvssVector: string | null; affectedAsset: string | null;
  description: string | null; businessImpact: string | null; evidenceCount: number;
};
export type ReportAsset = { name: string; type: string; identifier: string | null; findingCount: number };
export type ReportAssessment = {
  clientName: string; orgName: string; type: string; scope: string | null; status: string;
  startDate: Date | null; endDate: Date | null; leadConsultant: string | null; executiveSummary: string | null;
};

const IMPACTS = ["VeryHigh", "High", "Medium", "Low", "VeryLow"]; // top→bottom
const LIKES = ["VeryLow", "Low", "Medium", "High", "VeryHigh"]; // left→right

export function ReportDocument({
  assessment, findings, assets, score, reportTitle, generatedBy, generatedAt,
  disabled = [], customRecommendations = null, appendix = null,
}: {
  assessment: ReportAssessment; findings: ReportFindingRow[]; assets: ReportAsset[];
  score: Score; reportTitle: string; generatedBy: string; generatedAt: string;
  disabled?: string[]; customRecommendations?: string | null; appendix?: string | null;
}) {
  const show = (k: string) => !disabled.includes(k);
  const sevCounts = severityCounts(findings);
  const sevMax = Math.max(1, ...SEVERITY_ORDER.map((s2) => sevCounts[s2]));
  const cvss = cvssBandCounts(findings);
  const avgCvss = averageCvss(findings);
  const owasp = countBy(findings, "owaspCategory");
  const cwe = countBy(findings, "cwe");
  const mitre = countBy(findings, "mitreTechnique");
  const recs = prioritizedRecommendations(findings);
  const topRisks = [...findings].sort((a, b) => (b.cvssScore ?? 0) - (a.cvssScore ?? 0)).slice(0, 3);
  const totalEvidence = findings.reduce((n, f) => n + f.evidenceCount, 0);

  return (
    <Document title={reportTitle} author="JectarOne" subject={`${typeLabel(assessment.type)} — ${assessment.clientName}`}>
      {/* Cover */}
      <Page size="A4" style={s.cover}>
        <Shield />
        <Text style={s.coverBrand}>JectarOne</Text>
        <Text style={s.coverSub}>CYBERSECURITY CONSULTING</Text>
        <Text style={s.pill}>CONFIDENTIAL</Text>
        <Text style={s.coverTitle}>{typeLabel(assessment.type)} Assessment Report</Text>
        <Text style={s.monogram}>{initials(assessment.clientName)}</Text>
        <Text style={s.coverMeta}>Prepared for {assessment.clientName}</Text>
        <Text style={s.coverMeta}>
          {assessment.leadConsultant ? `Lead: ${assessment.leadConsultant} · ` : ""}{fmt(assessment.startDate)} → {fmt(assessment.endDate)}
        </Text>
        <View style={s.coverFooter}>
          <Text style={s.coverFooterText}>contact@jectar.one · +212 752-138075 · jectar.one</Text>
          <Text style={s.coverFooterText}>CONFIDENTIAL — intended solely for {assessment.clientName}. Generated {generatedAt} by {generatedBy}.</Text>
        </View>
      </Page>

      {/* Table of contents */}
      <Page size="A4" style={s.page}>
        <Chrome reportTitle={reportTitle} />
        <Text style={s.h1} {...anchor("contents", "Contents")}>Contents</Text>
        {[
          ["mgmt", "1. Management Summary"], ["exec", "2. Executive Summary"], ["scope", "3. Assessment Scope"],
          ["risk", "4. Risk Score & Matrix"], ["cvss", "5. CVSS Analysis"], ["owasp", "6. OWASP Top 10 Mapping"],
          ["mitre", "7. MITRE ATT&CK Mapping"], ["cwe", "8. CWE Summary"], ["assets", "9. Assets Summary"],
          ["overview", "10. Findings Overview"], ["details", "11. Detailed Findings"], ["evidence", "12. Evidence"],
          ["recs", "13. Recommendations"],
        ].map(([id, title]) => (
          <View key={id} style={s.tocRow}>
            <Link src={`#${id}`} style={s.tocLink}>{title}</Link>
            <Text style={s.tocNum}>§</Text>
          </View>
        ))}
      </Page>

      {/* Management + Executive + Scope */}
      <Page size="A4" style={s.page}>
        <Chrome reportTitle={reportTitle} />

        <SectionTitle id="mgmt">Management Summary</SectionTitle>
        <View style={s.panel}>
          <View style={s.scoreRow}>
            <Text style={[s.scoreBig, { color: gradeColor(score.grade) }]}>{score.score}</Text>
            <Text style={s.scoreOf}>/ 100</Text>
            <Text style={[s.chip, { backgroundColor: gradeColor(score.grade), marginLeft: 12 }]}>Security posture: {score.label} ({score.grade})</Text>
          </View>
          <Text style={s.p}>
            This {typeLabel(assessment.type).toLowerCase()} assessment of {assessment.clientName} identified {findings.length} finding{findings.length === 1 ? "" : "s"}
            {" "}({sevCounts.Critical} critical, {sevCounts.High} high). {avgCvss != null ? `Average CVSS is ${avgCvss}. ` : ""}
            Prioritize remediation of critical and high-severity items to improve the overall security posture.
          </Text>
        </View>
        <Text style={s.h2}>Top risks</Text>
        {topRisks.length === 0 ? <Text style={s.p}>No findings recorded.</Text> : topRisks.map((f, i) => (
          <Text key={f.id} style={s.p}>{i + 1}. {f.title} — {findingLabel(f.severity)}{f.cvssScore != null ? ` (CVSS ${f.cvssScore})` : ""}</Text>
        ))}

        {show("exec") && <><SectionTitle id="exec">Executive Summary</SectionTitle>
        <Text style={s.p}>{assessment.executiveSummary || "No executive summary was provided for this assessment."}</Text></>}

        {show("scope") && <><SectionTitle id="scope">Assessment Scope</SectionTitle>
        <View style={s.kv}>
          <Text style={s.kvItem}>Type: {typeLabel(assessment.type)}</Text>
          <Text style={s.kvItem}>Status: {findingLabel(assessment.status)}</Text>
          <Text style={s.kvItem}>Period: {fmt(assessment.startDate)} → {fmt(assessment.endDate)}</Text>
          <Text style={s.kvItem}>Lead: {assessment.leadConsultant ?? "—"}</Text>
        </View>
        <Text style={s.p}>{assessment.scope || "No scope statement was recorded."}</Text></>}
      </Page>

      {/* Risk score + matrix + CVSS */}
      <Page size="A4" style={s.page}>
        <Chrome reportTitle={reportTitle} />

        <SectionTitle id="risk">Risk Score & Matrix</SectionTitle>
        <View style={s.sevGrid}>
          {SEVERITY_ORDER.map((sv) => (
            <View key={sv} style={[s.sevCell, { backgroundColor: sevColor(sv) }]}>
              <Text style={s.sevCount}>{sevCounts[sv]}</Text>
              <Text style={s.sevLabel}>{findingLabel(sv)}</Text>
            </View>
          ))}
        </View>
        <Text style={s.h2}>Risk matrix (likelihood × impact)</Text>
        <View style={s.matrix}>
          {IMPACTS.map((im) => (
            <View key={im} style={s.matrixRow}>
              <Text style={s.matrixAxis}>{findingLabel(im)}</Text>
              {LIKES.map((lk) => {
                const r = risk(lk, im);
                const n = findings.filter((f) => f.impact === im && f.likelihood === lk).length;
                return <View key={lk} style={[s.matrixCell, { backgroundColor: riskColor(r.level), opacity: n ? 1 : 0.35 }]}><Text style={s.matrixCellTxt}>{n || ""}</Text></View>;
              })}
            </View>
          ))}
          <View style={s.matrixRow}>
            <Text style={s.matrixAxis}> </Text>
            {LIKES.map((lk) => <Text key={lk} style={{ flex: 1, textAlign: "center", fontSize: 7, color: BRAND.muted }}>{findingLabel(lk)}</Text>)}
          </View>
        </View>
        <Text style={[s.p, s.muted]}>Rows: impact (high → low). Columns: likelihood (low → high).</Text>

        <SectionTitle id="cvss">CVSS Analysis</SectionTitle>
        <Text style={s.p}>Average CVSS base score: {avgCvss ?? "—"}. Distribution by severity band:</Text>
        <Bars max={Math.max(1, ...Object.values(cvss))} items={[
          { label: "Critical", value: cvss.Critical, color: BRAND.critical },
          { label: "High", value: cvss.High, color: BRAND.high },
          { label: "Medium", value: cvss.Medium, color: BRAND.medium },
          { label: "Low", value: cvss.Low, color: BRAND.low },
          { label: "None", value: cvss.None, color: BRAND.muted },
        ]} />
        <Text style={[s.p, s.muted, { marginTop: 4 }]}>Severity distribution (count): {SEVERITY_ORDER.map((sv) => `${findingLabel(sv)} ${sevCounts[sv]}`).join(" · ")} (max {sevMax}).</Text>
      </Page>

      {/* Framework mappings */}
      <Page size="A4" style={s.page}>
        <Chrome reportTitle={reportTitle} />
        {show("owasp") && <><SectionTitle id="owasp">OWASP Top 10 Mapping</SectionTitle>
        <Table head={["OWASP category", "Findings"]} widths={["78%", "22%"]} rows={owasp.map(([k, v]) => [k, v])} /></>}

        {show("mitre") && <><SectionTitle id="mitre">MITRE ATT&CK Mapping</SectionTitle>
        <Table head={["Technique", "Findings"]} widths={["78%", "22%"]} rows={mitre.map(([k, v]) => [k, v])} /></>}

        {show("cwe") && <><SectionTitle id="cwe">CWE Summary</SectionTitle>
        <Table head={["CWE", "Findings"]} widths={["78%", "22%"]} rows={cwe.map(([k, v]) => [k, v])} /></>}
      </Page>

      {/* Assets + findings overview */}
      <Page size="A4" style={s.page}>
        <Chrome reportTitle={reportTitle} />
        {show("assets") && <><SectionTitle id="assets">Assets Summary</SectionTitle>
        <Table head={["Asset", "Type", "Identifier", "Findings"]} widths={["34%", "22%", "30%", "14%"]}
          rows={assets.map((a) => [a.name, findingLabel(a.type), a.identifier ?? "—", a.findingCount])} /></>}

        <SectionTitle id="overview">Findings Overview</SectionTitle>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { width: "6%" }]}>#</Text>
            <Text style={[s.th, { width: "44%" }]}>Finding</Text>
            <Text style={[s.th, { width: "16%" }]}>Severity</Text>
            <Text style={[s.th, { width: "18%" }]}>Status</Text>
            <Text style={[s.th, { width: "16%" }]}>CVSS</Text>
          </View>
          {findings.map((f, i) => (
            <View key={f.id} style={s.tr}>
              <Text style={[s.td, { width: "6%" }]}>{i + 1}</Text>
              <Text style={[s.td, { width: "44%" }]}>{f.title}</Text>
              <Text style={[s.td, { width: "16%", color: sevColor(f.severity), fontWeight: 700 }]}>{findingLabel(f.severity)}</Text>
              <Text style={[s.td, { width: "18%" }]}>{findingLabel(f.status)}</Text>
              <Text style={[s.td, { width: "16%" }]}>{f.cvssScore ?? "—"}</Text>
            </View>
          ))}
          {findings.length === 0 && <View style={s.tr}><Text style={[s.td, { width: "100%" }]}>No findings recorded.</Text></View>}
        </View>
      </Page>

      {/* Detailed findings */}
      {findings.length > 0 && (
        <Page size="A4" style={s.page}>
          <Chrome reportTitle={reportTitle} />
          <SectionTitle id="details">Detailed Findings</SectionTitle>
          {findings.map((f, i) => {
            const r = risk(f.likelihood, f.impact);
            return (
              <View key={f.id} style={s.findingBlock} wrap={false}>
                <View style={s.findingTitleRow}>
                  <Text style={s.findingTitle}>{i + 1}. {f.title}</Text>
                  <Text style={[s.chip, { backgroundColor: sevColor(f.severity) }]}>{findingLabel(f.severity)} · Risk {r.score}</Text>
                </View>
                <View style={s.kv}>
                  {f.cvssScore != null && <Text style={s.kvItem}>CVSS {f.cvssScore}{f.cvssVector ? ` (${f.cvssVector})` : ""}</Text>}
                  {f.owaspCategory && <Text style={s.kvItem}>OWASP {f.owaspCategory}</Text>}
                  {f.cwe && <Text style={s.kvItem}>{f.cwe}</Text>}
                  {f.mitreTechnique && <Text style={s.kvItem}>MITRE {f.mitreTechnique}</Text>}
                  {f.affectedAsset && <Text style={s.kvItem}>Asset: {f.affectedAsset}</Text>}
                  {f.evidenceCount > 0 && <Text style={s.kvItem}>{f.evidenceCount} evidence file{f.evidenceCount === 1 ? "" : "s"}</Text>}
                </View>
                {f.description && (<><Text style={s.h2}>Description</Text><Text style={s.p}>{f.description}</Text></>)}
                {f.businessImpact && (<><Text style={s.h2}>Business Impact</Text><Text style={s.p}>{f.businessImpact}</Text></>)}
                {f.remediation && (<><Text style={s.h2}>Recommendation</Text><Text style={s.p}>{f.remediation}</Text></>)}
              </View>
            );
          })}
        </Page>
      )}

      {/* Evidence + recommendations */}
      <Page size="A4" style={s.page}>
        <Chrome reportTitle={reportTitle} />
        {show("evidence") && <><SectionTitle id="evidence">Evidence</SectionTitle>
        <Text style={s.p}>{totalEvidence} evidence file{totalEvidence === 1 ? "" : "s"} collected across {findings.filter((f) => f.evidenceCount > 0).length} finding(s).</Text>
        <Table head={["Finding", "Evidence files"]} widths={["78%", "22%"]}
          rows={findings.filter((f) => f.evidenceCount > 0).map((f) => [f.title, f.evidenceCount])} /></>}

        {show("recs") && <><SectionTitle id="recs">Recommendations</SectionTitle>
        {customRecommendations && <Text style={s.p}>{customRecommendations}</Text>}
        {recs.length === 0 && !customRecommendations ? <Text style={s.p}>No recommendations recorded.</Text> : recs.map((rec, i) => (
          <View key={i} style={{ marginBottom: 6 }} wrap={false}>
            <View style={s.findingTitleRow}>
              <Text style={[s.h2, { maxWidth: "72%" }]}>{i + 1}. {rec.title}</Text>
              <Text style={[s.chip, { backgroundColor: sevColor(rec.severity) }]}>{findingLabel(rec.severity)}</Text>
            </View>
            <Text style={s.p}>{rec.remediation}</Text>
          </View>
        ))}</>}

        {appendix && <><SectionTitle id="appendix">Appendix</SectionTitle>
        <Text style={s.p}>{appendix}</Text></>}
      </Page>
    </Document>
  );
}
