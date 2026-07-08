// Prompt builders for the AI security assistant. Pure functions (no I/O) so the
// guardrails and grounding can be unit-tested. Every capability shares a strict
// anti-fabrication system preamble.

export const AI_CAPABILITIES = [
  "improve_wording",
  "exec_summary",
  "explain_cvss",
  "explain_cwe",
  "suggest_owasp",
  "suggest_mitre",
  "generate_remediation",
  "summarize_report",
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<AiCapability, string> = {
  improve_wording: "Improve wording",
  exec_summary: "Generate executive summary",
  explain_cvss: "Explain CVSS",
  explain_cwe: "Explain CWE",
  suggest_owasp: "Suggest OWASP mapping",
  suggest_mitre: "Suggest MITRE mapping",
  generate_remediation: "Generate remediation",
  summarize_report: "Summarize report",
};

// The non-negotiable guardrail applied to every capability.
export const GUARDRAIL = [
  "You are an assistant to a professional penetration tester documenting findings for an authorized security assessment.",
  "CRITICAL RULES — you MUST follow all of them:",
  "1. NEVER invent, fabricate, or assume vulnerabilities, CVEs, exploits, affected assets, or facts that are not explicitly present in the provided input.",
  "2. Do not escalate or add severity, impact, or technical claims beyond what the input supports.",
  "3. If the provided information is insufficient to answer, say exactly what is missing — do not guess.",
  "4. Only reference standard frameworks (OWASP Top 10 2021 categories, MITRE ATT&CK technique IDs, CWE IDs, CVSS 3.1) using their real, well-known identifiers.",
  "5. Output only the requested content — no preamble, no disclaimers, no invented references.",
].join("\n");

type Ctx = Record<string, unknown>;
function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export type BuiltPrompt = { system: string; user: string; maxTokens: number };

/** Build the {system,user} prompt for a capability from a context object. */
export function buildPrompt(capability: AiCapability, ctx: Ctx): BuiltPrompt {
  const sys = (task: string) => `${GUARDRAIL}\n\nTASK: ${task}`;

  switch (capability) {
    case "improve_wording":
      return {
        system: sys("Rewrite the finding's description to be clearer, precise, and professional. Preserve every technical fact exactly. Do not add new findings or claims."),
        user: `Title: ${s(ctx.title)}\nSeverity: ${s(ctx.severity)}\n\nCurrent description:\n${s(ctx.description) || "(none provided)"}`,
        maxTokens: 1200,
      };
    case "generate_remediation":
      return {
        system: sys("Write concrete, actionable remediation steps for the finding, grounded only in the described issue. If the issue is under-specified, state what detail is needed."),
        user: `Title: ${s(ctx.title)}\nSeverity: ${s(ctx.severity)}\nCWE: ${s(ctx.cwe) || "n/a"}\n\nDescription:\n${s(ctx.description) || "(none provided)"}\nTechnical details:\n${s(ctx.technicalDetails) || "(none provided)"}`,
        maxTokens: 1200,
      };
    case "explain_cvss":
      return {
        system: sys("Explain the given CVSS 3.1 vector/score in plain language: what each metric means and what drives the score. Explain only the provided vector — do not compute a new score or invent metrics."),
        user: `CVSS score: ${s(ctx.cvssScore) || "(not provided)"}\nCVSS vector: ${s(ctx.cvssVector) || "(not provided)"}`,
        maxTokens: 900,
      };
    case "explain_cwe":
      return {
        system: sys("Explain the referenced CWE weakness in plain language and how it relates to the finding. Use only the real, standard definition of that CWE ID."),
        user: `CWE: ${s(ctx.cwe) || "(not provided)"}\nFinding title: ${s(ctx.title)}\nDescription:\n${s(ctx.description) || "(none provided)"}`,
        maxTokens: 900,
      };
    case "suggest_owasp":
      return {
        system: sys("Suggest the single most appropriate OWASP Top 10 (2021) category (A01–A10) for the finding, based strictly on the described behaviour. Give the category id + name and one sentence of justification grounded in the input. If the description does not support a confident mapping, say so."),
        user: `Title: ${s(ctx.title)}\nDescription:\n${s(ctx.description) || "(none provided)"}\nTechnical details:\n${s(ctx.technicalDetails) || "(none provided)"}`,
        maxTokens: 500,
      };
    case "suggest_mitre":
      return {
        system: sys("Suggest the most appropriate MITRE ATT&CK technique ID (e.g. T1190) for the finding, based strictly on the described behaviour. Give the technique id + name and one sentence of justification grounded in the input. If the description does not support a confident mapping, say so."),
        user: `Title: ${s(ctx.title)}\nDescription:\n${s(ctx.description) || "(none provided)"}\nTechnical details:\n${s(ctx.technicalDetails) || "(none provided)"}`,
        maxTokens: 500,
      };
    case "exec_summary":
      return {
        system: sys("Write a concise executive summary for leadership, grounded only in the findings listed. Summarize posture and the most significant risks. Do not introduce findings that are not in the list."),
        user: `Assessment: ${s(ctx.type)} for ${s(ctx.clientName)}\nFinding counts: ${s(ctx.counts)}\n\nFindings:\n${s(ctx.findings) || "(no findings)"}`,
        maxTokens: 1400,
      };
    case "summarize_report":
      return {
        system: sys("Summarize the assessment report for a technical audience, grounded only in the provided findings and metrics. State the overall posture, key themes, and priority items. Do not invent findings or numbers."),
        user: `Assessment: ${s(ctx.type)} for ${s(ctx.clientName)}\nSecurity score: ${s(ctx.score)}\nFinding counts: ${s(ctx.counts)}\n\nFindings:\n${s(ctx.findings) || "(no findings)"}`,
        maxTokens: 1400,
      };
  }
}
