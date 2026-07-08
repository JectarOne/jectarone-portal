// Report builder configuration — which sections appear, their order, and custom
// exec-summary / recommendations / appendix content. Pure + testable.

export type SectionKey =
  | "mgmt" | "exec" | "scope" | "risk" | "cvss" | "owasp" | "mitre"
  | "cwe" | "assets" | "overview" | "details" | "evidence" | "recs" | "appendix";

export const SECTIONS: { key: SectionKey; label: string; locked?: boolean }[] = [
  { key: "mgmt", label: "Management Summary" },
  { key: "exec", label: "Executive Summary" },
  { key: "scope", label: "Assessment Scope" },
  { key: "risk", label: "Risk Score & Matrix" },
  { key: "cvss", label: "CVSS Analysis" },
  { key: "owasp", label: "OWASP Top 10 Mapping" },
  { key: "mitre", label: "MITRE ATT&CK Mapping" },
  { key: "cwe", label: "CWE Summary" },
  { key: "assets", label: "Assets Summary" },
  { key: "overview", label: "Findings Overview", locked: true }, // always present
  { key: "details", label: "Detailed Findings", locked: true },  // always present
  { key: "evidence", label: "Evidence Summary" },
  { key: "recs", label: "Recommendations" },
  { key: "appendix", label: "Appendix" },
];

const DEFAULT_ORDER = SECTIONS.map((s) => s.key);
const LOCKED = new Set(SECTIONS.filter((s) => s.locked).map((s) => s.key));

export type ReportConfigData = {
  order: SectionKey[];
  disabled: SectionKey[];
  customRecommendations: string | null;
  appendix: string | null;
};

export function defaultConfig(): ReportConfigData {
  return { order: [...DEFAULT_ORDER], disabled: [], customRecommendations: null, appendix: null };
}

/** Parse persisted JSON into a valid config, tolerating unknown/missing keys. */
export function parseConfig(json: string | null | undefined): ReportConfigData {
  const base = defaultConfig();
  if (!json) return base;
  let raw: Partial<ReportConfigData>;
  try { raw = JSON.parse(json); } catch { return base; }

  const known = new Set(DEFAULT_ORDER);
  // Sanitize order: keep known keys in given order, append any missing.
  const order: SectionKey[] = [];
  for (const k of raw.order ?? []) if (known.has(k as SectionKey) && !order.includes(k as SectionKey)) order.push(k as SectionKey);
  for (const k of DEFAULT_ORDER) if (!order.includes(k)) order.push(k);

  const disabled = (raw.disabled ?? [])
    .filter((k): k is SectionKey => known.has(k as SectionKey) && !LOCKED.has(k as SectionKey));

  return {
    order,
    disabled,
    customRecommendations: raw.customRecommendations ?? null,
    appendix: raw.appendix ?? null,
  };
}

/** Section keys to render, in order, honoring disabled flags (locked always shown). */
export function enabledSectionsInOrder(cfg: ReportConfigData): SectionKey[] {
  const off = new Set(cfg.disabled.filter((k) => !LOCKED.has(k)));
  return cfg.order.filter((k) => !off.has(k));
}

export function isEnabled(cfg: ReportConfigData, key: SectionKey): boolean {
  if (LOCKED.has(key)) return true;
  return !cfg.disabled.includes(key);
}
