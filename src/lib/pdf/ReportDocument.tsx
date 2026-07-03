import { Document, Page, View, Text, StyleSheet, Svg, Path } from "@react-pdf/renderer";
import { typeLabel } from "@/lib/assessments";
import { label as findingLabel, risk } from "@/lib/findings";

const BRAND = {
  bg: "#08111F",
  primary: "#2563EB",
  accent: "#38BDF8",
  text: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#EAB308",
  low: "#22C55E",
};

const styles = StyleSheet.create({
  cover: { backgroundColor: BRAND.bg, height: "100%", padding: 48, justifyContent: "center", alignItems: "center" },
  coverTitle: { color: "#F8FAFC", fontSize: 30, fontWeight: 700, marginTop: 24 },
  coverSub: { color: BRAND.accent, fontSize: 11, letterSpacing: 2, marginTop: 4 },
  coverReportTitle: { color: "#F8FAFC", fontSize: 20, marginTop: 48, textAlign: "center" },
  coverMeta: { color: "#94A3B8", fontSize: 11, marginTop: 8, textAlign: "center" },
  coverFooter: { position: "absolute", bottom: 40, left: 48, right: 48, textAlign: "center" },
  coverFooterText: { color: "#94A3B8", fontSize: 9 },

  page: { padding: 40, paddingTop: 56, paddingBottom: 56, fontSize: 10, color: BRAND.text, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BRAND.line, paddingBottom: 8, marginBottom: 16 },
  headerBrand: { fontSize: 10, fontWeight: 700 },
  headerMeta: { fontSize: 8, color: BRAND.muted },
  footerFixed: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: BRAND.line, paddingTop: 6 },
  footerText: { fontSize: 8, color: BRAND.muted },

  h2: { fontSize: 15, fontWeight: 700, color: BRAND.primary, marginTop: 14, marginBottom: 8 },
  h3: { fontSize: 11.5, fontWeight: 700, marginTop: 10, marginBottom: 3 },
  p: { fontSize: 10.5, lineHeight: 1.5, marginBottom: 4 },
  muted: { color: BRAND.muted },

  table: { borderWidth: 1, borderColor: BRAND.line, borderRadius: 2, marginBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BRAND.line },
  trLast: { flexDirection: "row" },
  thCell: { backgroundColor: BRAND.primary, color: "#fff", fontSize: 9, fontWeight: 700, padding: 5 },
  tdCell: { fontSize: 9, padding: 5, color: BRAND.text },

  chip: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, fontSize: 8, fontWeight: 700, color: "#fff", alignSelf: "flex-start" },

  matrixGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  matrixCell: { width: "20%", padding: 6, alignItems: "center" },
  matrixCount: { fontSize: 16, fontWeight: 700, color: "#fff" },
  matrixLabel: { fontSize: 8, color: "#fff", marginTop: 2 },

  findingBlock: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BRAND.line },
  findingTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  findingTitle: { fontSize: 11.5, fontWeight: 700, maxWidth: "75%" },
});

function sevColor(sev: string): string {
  return { Critical: BRAND.critical, High: BRAND.high, Medium: BRAND.medium, Low: BRAND.low, Informational: BRAND.accent }[sev] ?? BRAND.muted;
}

function fmt(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

function Shield() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Path d="M32 7 L53 15.5 V32 C53 44.5 43.6 52.7 32 57 C20.4 52.7 11 44.5 11 32 V15.5 Z" fill={BRAND.primary} />
      <Path d="M23 32.5 L29.5 39 L42 24.5" stroke="#F8FAFC" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function PageChrome({ reportTitle, pageLabel }: { reportTitle: string; pageLabel?: string }) {
  return (
    <>
      <View style={styles.headerRow} fixed>
        <Text style={styles.headerBrand}>JectarOne</Text>
        <Text style={styles.headerMeta}>{reportTitle}</Text>
      </View>
      <View style={styles.footerFixed} fixed>
        <Text style={styles.footerText}>contact@jectar.one · +212 752-138075 · CONFIDENTIAL</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      {pageLabel}
    </>
  );
}

export type ReportFindingRow = {
  id: string;
  title: string;
  severity: string;
  likelihood: string;
  impact: string;
  status: string;
  cvssScore: number | null;
  description: string | null;
  businessImpact: string | null;
  remediation: string | null;
  affectedAsset: string | null;
};

export type ReportAssessment = {
  clientName: string;
  type: string;
  scope: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  leadConsultant: string | null;
  executiveSummary: string | null;
};

const SEVERITIES = ["Critical", "High", "Medium", "Low", "Informational"] as const;

export function ReportDocument({
  assessment, findings, reportTitle,
}: {
  assessment: ReportAssessment;
  findings: ReportFindingRow[];
  reportTitle: string;
}) {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length])) as Record<string, number>;

  return (
    <Document title={reportTitle} author="JectarOne">
      {/* Cover */}
      <Page size="A4" style={styles.cover}>
        <Shield />
        <Text style={styles.coverTitle}>JectarOne</Text>
        <Text style={styles.coverSub}>CYBERSECURITY CONSULTING</Text>
        <Text style={styles.coverReportTitle}>{typeLabel(assessment.type)} Report</Text>
        <Text style={styles.coverMeta}>Prepared for: {assessment.clientName}</Text>
        <Text style={styles.coverMeta}>
          {assessment.leadConsultant ? `Lead: ${assessment.leadConsultant} · ` : ""}
          {fmt(assessment.startDate)} → {fmt(assessment.endDate)}
        </Text>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>contact@jectar.one · +212 752-138075 · jectar.one</Text>
          <Text style={styles.coverFooterText}>CONFIDENTIAL — intended solely for {assessment.clientName}.</Text>
        </View>
      </Page>

      {/* Content */}
      <Page size="A4" style={styles.page}>
        <PageChrome reportTitle={reportTitle} />

        <Text style={styles.h2}>Executive Summary</Text>
        <Text style={styles.p}>{assessment.executiveSummary || "No executive summary provided."}</Text>
        {assessment.scope && (<><Text style={styles.h3}>Scope</Text><Text style={styles.p}>{assessment.scope}</Text></>)}

        <Text style={styles.h2}>Findings Summary</Text>
        <View style={styles.matrixGrid}>
          {SEVERITIES.map((s) => (
            <View key={s} style={[styles.matrixCell, { backgroundColor: sevColor(s) }]}>
              <Text style={styles.matrixCount}>{counts[s]}</Text>
              <Text style={styles.matrixLabel}>{findingLabel(s)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Findings Overview</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.thCell, { width: "8%" }]}>#</Text>
            <Text style={[styles.thCell, { width: "42%" }]}>Finding</Text>
            <Text style={[styles.thCell, { width: "18%" }]}>Severity</Text>
            <Text style={[styles.thCell, { width: "18%" }]}>Status</Text>
            <Text style={[styles.thCell, { width: "14%" }]}>CVSS</Text>
          </View>
          {findings.map((f, i) => (
            <View key={f.id} style={i === findings.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.tdCell, { width: "8%" }]}>{i + 1}</Text>
              <Text style={[styles.tdCell, { width: "42%" }]}>{f.title}</Text>
              <Text style={[styles.tdCell, { width: "18%", color: sevColor(f.severity), fontWeight: 700 }]}>{findingLabel(f.severity)}</Text>
              <Text style={[styles.tdCell, { width: "18%" }]}>{findingLabel(f.status)}</Text>
              <Text style={[styles.tdCell, { width: "14%" }]}>{f.cvssScore ?? "—"}</Text>
            </View>
          ))}
          {findings.length === 0 && (
            <View style={styles.trLast}><Text style={[styles.tdCell, { width: "100%" }]}>No findings recorded for this assessment.</Text></View>
          )}
        </View>
      </Page>

      {/* Detailed findings (own page(s), auto-flows) */}
      {findings.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageChrome reportTitle={reportTitle} />
          <Text style={styles.h2}>Detailed Findings</Text>
          {findings.map((f, i) => {
            const r = risk(f.likelihood, f.impact);
            return (
              <View key={f.id} style={styles.findingBlock} wrap={false}>
                <View style={styles.findingTitleRow}>
                  <Text style={styles.findingTitle}>{i + 1}. {f.title}</Text>
                  <Text style={[styles.chip, { backgroundColor: sevColor(f.severity) }]}>
                    {findingLabel(f.severity)} · Risk {r.score}
                  </Text>
                </View>
                {f.affectedAsset && <Text style={[styles.p, styles.muted]}>Asset: {f.affectedAsset}</Text>}
                {f.description && (<><Text style={styles.h3}>Description</Text><Text style={styles.p}>{f.description}</Text></>)}
                {f.businessImpact && (<><Text style={styles.h3}>Business Impact</Text><Text style={styles.p}>{f.businessImpact}</Text></>)}
                {f.remediation && (<><Text style={styles.h3}>Recommendation</Text><Text style={styles.p}>{f.remediation}</Text></>)}
              </View>
            );
          })}
        </Page>
      )}
    </Document>
  );
}
