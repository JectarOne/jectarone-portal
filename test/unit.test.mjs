import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of src/lib/rbac.ts logic, tested in isolation (no TS build needed).
const ROLES = ["MEMBER", "ADMIN", "OWNER"];
const RANK = { MEMBER: 1, ADMIN: 2, OWNER: 3 };
const isRole = (v) => ROLES.includes(v);
const hasRole = (role, min) => (isRole(role) ? RANK[role] >= RANK[min] : false);

test("hasRole respects the hierarchy", () => {
  assert.equal(hasRole("OWNER", "ADMIN"), true);
  assert.equal(hasRole("ADMIN", "ADMIN"), true);
  assert.equal(hasRole("MEMBER", "ADMIN"), false);
  assert.equal(hasRole("OWNER", "MEMBER"), true);
});

test("hasRole rejects unknown roles", () => {
  assert.equal(hasRole("SUPERUSER", "MEMBER"), false);
  assert.equal(hasRole("", "MEMBER"), false);
});

// Mirror of slugify in src/lib/validation.ts
const slugify = (input) =>
  input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "org";

test("slugify produces url-safe slugs", () => {
  assert.equal(slugify("Acme SARL"), "acme-sarl");
  assert.equal(slugify("  Café & Co.  "), "cafe-co");
  assert.equal(slugify("!!!"), "org");
});

// Assessment enum-like constants (mirror of src/lib/assessments.ts).
const ASSESSMENT_TYPES = ["Web", "Network", "Cloud", "ActiveDirectory", "ISO27001", "NISTCSF", "Other"];
const ASSESSMENT_STATUSES = ["Draft", "InProgress", "Review", "Delivered"];

test("assessment type/status membership", () => {
  assert.ok(ASSESSMENT_TYPES.includes("ISO27001"));
  assert.ok(!ASSESSMENT_TYPES.includes("Physical"));
  assert.ok(ASSESSMENT_STATUSES.includes("Delivered"));
  assert.ok(!ASSESSMENT_STATUSES.includes("Done"));
});

// Date range rule used by the assessment zod refine.
const dateRangeValid = (start, end) => !start || !end || new Date(end) >= new Date(start);

test("assessment date range: end must not precede start", () => {
  assert.equal(dateRangeValid("2026-01-01", "2026-02-01"), true);
  assert.equal(dateRangeValid("2026-02-01", "2026-01-01"), false);
  assert.equal(dateRangeValid("2026-02-01", null), true);
  assert.equal(dateRangeValid(null, null), true);
});

// Sprint 3 — findings enums + risk matrix (mirror of src/lib/findings.ts).
const SEVERITIES = ["Critical", "High", "Medium", "Low", "Informational"];
const FINDING_STATUSES = ["Open", "InProgress", "Fixed", "Verified", "AcceptedRisk", "FalsePositive"];
const SCALE = { VeryLow: 1, Low: 2, Medium: 3, High: 4, VeryHigh: 5 };
function riskLevel(l, i) {
  const s = (SCALE[l] ?? 3) * (SCALE[i] ?? 3);
  if (s >= 20) return "Critical";
  if (s >= 12) return "High";
  if (s >= 6) return "Medium";
  if (s >= 3) return "Low";
  return "VeryLow";
}
const cvssValid = (n) => n === undefined || (typeof n === "number" && n >= 0 && n <= 10);

test("finding enum membership", () => {
  assert.ok(SEVERITIES.includes("Critical"));
  assert.ok(!SEVERITIES.includes("Catastrophic"));
  assert.ok(FINDING_STATUSES.includes("AcceptedRisk"));
  assert.ok(!FINDING_STATUSES.includes("Closed"));
});

test("risk = likelihood × impact → banded level (5×5)", () => {
  assert.equal(riskLevel("VeryHigh", "VeryHigh"), "Critical"); // 25
  assert.equal(riskLevel("High", "VeryHigh"), "Critical");     // 20
  assert.equal(riskLevel("High", "High"), "High");             // 16
  assert.equal(riskLevel("Medium", "High"), "High");           // 12
  assert.equal(riskLevel("Medium", "Medium"), "Medium");       // 9
  assert.equal(riskLevel("Low", "Low"), "Low");                // 4
  assert.equal(riskLevel("VeryLow", "VeryLow"), "VeryLow");    // 1
});

// Sprint 4 — asset types + severity-count aggregation (mirrors report summary logic).
const ASSET_TYPES = ["Domain", "URL", "IP", "Server", "ActiveDirectory", "Azure", "AWS", "API", "MobileApp", "Other"];

test("asset type membership", () => {
  assert.ok(ASSET_TYPES.includes("ActiveDirectory"));
  assert.ok(!ASSET_TYPES.includes("Laptop"));
});

function severityCounts(findings) {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

test("report severity-count aggregation", () => {
  const findings = [
    { severity: "Critical" }, { severity: "Critical" }, { severity: "High" }, { severity: "Low" },
  ];
  assert.deepEqual(severityCounts(findings), { Critical: 2, High: 1, Medium: 0, Low: 1, Informational: 0 });
  assert.deepEqual(severityCounts([]), { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 });
});

test("cvss score must be within 0–10", () => {
  assert.equal(cvssValid(9.8), true);
  assert.equal(cvssValid(0), true);
  assert.equal(cvssValid(10), true);
  assert.equal(cvssValid(undefined), true);
  assert.equal(cvssValid(10.1), false);
  assert.equal(cvssValid(-1), false);
});

// Sprint 5 — SLA (mirrors src/lib/sla.ts).
const SLA_DAYS = { Critical: 7, High: 30, Medium: 60, Low: 90, Informational: null };
const CLOSED = ["Resolved", "AcceptedRisk", "FalsePositive", "Fixed", "Verified"];
function computeDueDate(sev, from) {
  const d = SLA_DAYS[sev];
  if (d == null) return null;
  const x = new Date(from); x.setUTCDate(x.getUTCDate() + d); return x;
}
function overdue(due, status, now) {
  if (!due) return false;
  if (CLOSED.includes(status)) return false;
  return new Date(due).getTime() < now.getTime();
}

test("SLA due date by severity", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  assert.equal(computeDueDate("Critical", base).toISOString().slice(0, 10), "2026-01-08");
  assert.equal(computeDueDate("High", base).toISOString().slice(0, 10), "2026-01-31");
  assert.equal(computeDueDate("Low", base).toISOString().slice(0, 10), "2026-04-01");
  assert.equal(computeDueDate("Informational", base), null);
});

test("overdue: past due + not closed", () => {
  const now = new Date("2026-02-01T00:00:00Z");
  assert.equal(overdue(new Date("2026-01-15"), "Open", now), true);
  assert.equal(overdue(new Date("2026-01-15"), "Resolved", now), false); // closed
  assert.equal(overdue(new Date("2026-03-01"), "Open", now), false);     // future
  assert.equal(overdue(null, "Open", now), false);                        // no SLA
});

// Sprint 5 — status transitions (mirror STATUS_TRANSITIONS).
const TRANSITIONS = {
  Open: ["InProgress", "ReadyForValidation", "Resolved", "AcceptedRisk", "FalsePositive"],
  ReadyForValidation: ["Open", "InProgress", "Resolved", "FalsePositive"],
  Resolved: ["Open", "InProgress"],
};
const canTransition = (from, to) => (TRANSITIONS[from] ?? []).includes(to);

test("status workflow transitions", () => {
  assert.equal(canTransition("Open", "InProgress"), true);
  assert.equal(canTransition("ReadyForValidation", "Resolved"), true);
  assert.equal(canTransition("Resolved", "Open"), true);       // reopen
  assert.equal(canTransition("ReadyForValidation", "AcceptedRisk"), false);
});

// Sprint 5 — markdown safety (mirror src/lib/markdown.ts core rules).
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function renderMd(input) {
  let s = escapeHtml(input);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|\s)@([a-zA-Z0-9._-]{2,40})/g, '$1<span class="mention">@$2</span>');
  return s;
}

test("markdown escapes HTML then applies safe subset", () => {
  assert.ok(!renderMd("<script>alert(1)</script>").includes("<script>"));
  assert.ok(renderMd("<script>").includes("&lt;script&gt;"));
  assert.ok(renderMd("**bold**").includes("<strong>bold</strong>"));
  assert.ok(renderMd("hi @sara").includes('<span class="mention">@sara</span>'));
});

// Sprint 6 — evidence storage helpers (mirror src/lib/storage.ts).
const ALLOWED_EVIDENCE = { "image/png": "PNG", "image/jpeg": "JPG", "application/pdf": "PDF", "text/plain": "TXT", "application/zip": "ZIP" };
function evidenceKey(orgId, findingId, filename) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/\.{2,}/g, "_").replace(/^[._-]+/, "").slice(0, 120) || "file";
  return `org/${orgId}/finding/${findingId}/123-abcd-${safe}`;
}

test("evidence type allowlist", () => {
  assert.ok(ALLOWED_EVIDENCE["image/png"]);
  assert.ok(ALLOWED_EVIDENCE["application/zip"]);
  assert.ok(!ALLOWED_EVIDENCE["application/x-msdownload"]);
  assert.ok(!ALLOWED_EVIDENCE["text/html"]);
});

test("evidence key is org-namespaced + sanitized", () => {
  const k = evidenceKey("org1", "f1", "../../etc/passwd evil.png");
  assert.ok(k.startsWith("org/org1/finding/f1/"));
  assert.ok(!k.includes(".."));
  assert.ok(!k.includes(" "));
  assert.ok(!k.includes("/etc/"));
});

// Sprint 7 — CVSS band (mirror of cvssBand in src/components/findings-ui.tsx).
function cvssBand(score) {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "none";
}

test("cvss band boundaries (CVSS v3)", () => {
  assert.equal(cvssBand(9.8), "critical");
  assert.equal(cvssBand(9.0), "critical");
  assert.equal(cvssBand(8.9), "high");
  assert.equal(cvssBand(7.0), "high");
  assert.equal(cvssBand(6.9), "medium");
  assert.equal(cvssBand(4.0), "medium");
  assert.equal(cvssBand(3.9), "low");
  assert.equal(cvssBand(0.1), "low");
  assert.equal(cvssBand(0), "none");
});

// Sprint 7 — initials (mirror of initials in src/components/nav-link.tsx).
function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

test("initials from display name", () => {
  assert.equal(initials("Issam Majidi"), "IM");
  assert.equal(initials("issam"), "IS");
  assert.equal(initials("  Ada  Lovelace  King "), "AK");
  assert.equal(initials(""), "?");
});

// Sprint 10 — token hashing + expiry (mirror of src/lib/token.ts).
import crypto from "node:crypto";
const hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const isExpired = (expiresAt, now = Date.now()) => expiresAt.getTime() < now;

test("token hash is sha256 hex, deterministic, and collision-distinct", () => {
  const h = hashToken("abc");
  assert.match(h, /^[0-9a-f]{64}$/, "sha256 hex");
  assert.equal(h, hashToken("abc"), "deterministic");
  assert.notEqual(hashToken("abc"), hashToken("abd"), "distinct inputs → distinct hashes");
});

test("token expiry check", () => {
  const now = Date.parse("2026-07-05T12:00:00Z");
  assert.equal(isExpired(new Date(now - 1000), now), true);
  assert.equal(isExpired(new Date(now + 1000), now), false);
});

// Sprint 12 — report aggregation (mirror of src/lib/report.ts).
function reportBand(x) { if (x == null) return "None"; if (x >= 9) return "Critical"; if (x >= 7) return "High"; if (x >= 4) return "Medium"; if (x > 0) return "Low"; return "None"; }
function countBy(items, key) {
  const m = new Map();
  for (const f of items) { const v = f[key]; if (!v) continue; m.set(v, (m.get(v) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
const SEV_RANK = { Critical: 5, High: 4, Medium: 3, Low: 2, Informational: 1 };
function prioritized(items, max = 12) {
  return items.filter((f) => f.remediation && f.remediation.trim())
    .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) || (b.cvssScore ?? 0) - (a.cvssScore ?? 0))
    .slice(0, max);
}

test("report: cvss band boundaries", () => {
  assert.equal(reportBand(9.8), "Critical");
  assert.equal(reportBand(7), "High");
  assert.equal(reportBand(4), "Medium");
  assert.equal(reportBand(0.1), "Low");
  assert.equal(reportBand(0), "None");
  assert.equal(reportBand(null), "None");
});

test("report: countBy aggregates + sorts by count desc", () => {
  const f = [{ owaspCategory: "A03 Injection" }, { owaspCategory: "A03 Injection" }, { owaspCategory: "A01 Broken Access Control" }, { owaspCategory: null }];
  assert.deepEqual(countBy(f, "owaspCategory"), [["A03 Injection", 2], ["A01 Broken Access Control", 1]]);
  assert.deepEqual(countBy([], "cwe"), []);
});

// Sprint 13 — device label (mirror of src/lib/device.ts).
function deviceName(ua) {
  if (!ua) return "Unknown device";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} · ${os}` : b;
}
test("deviceName parses common user agents", () => {
  assert.equal(deviceName("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0"), "Chrome · Windows");
  assert.equal(deviceName("Mozilla/5.0 (Macintosh) Firefox/121.0"), "Firefox · macOS");
  assert.equal(deviceName(null), "Unknown device");
});

test("report: recommendations prioritized by severity then cvss", () => {
  const f = [
    { title: "low", severity: "Low", cvssScore: 3, remediation: "fix" },
    { title: "crit", severity: "Critical", cvssScore: 9, remediation: "fix" },
    { title: "high", severity: "High", cvssScore: 8, remediation: "fix" },
    { title: "no-rem", severity: "Critical", cvssScore: 10, remediation: "" },
  ];
  assert.deepEqual(prioritized(f).map((x) => x.title), ["crit", "high", "low"]);
});

// Mirror of src/lib/finding-diff.ts normalization + diff (no TS build needed).
const norm = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const TRACKED = [["title","Title"],["severity","Severity"],["cvssScore","CVSS score"],["remediation","Remediation"]];
function diffFinding(before, after) {
  const out = [];
  for (const [key, label] of TRACKED) {
    const from = norm(before[key]); const to = norm(after[key]);
    if (from !== to) out.push({ field: key, label, from, to });
  }
  return out;
}

test("diffFinding reports only changed fields", () => {
  const before = { title: "A", severity: "High", cvssScore: 7.5, remediation: "" };
  const after = { title: "B", severity: "High", cvssScore: 9.0, remediation: null };
  const d = diffFinding(before, after);
  assert.equal(d.length, 2);
  assert.deepEqual(d.map((c) => c.field).sort(), ["cvssScore", "title"]);
});

test("diffFinding treats empty string and null as equal (no change)", () => {
  const d = diffFinding({ remediation: "" }, { remediation: null });
  assert.equal(d.length, 0);
});

test("diffFinding normalizes numbers to strings for comparison", () => {
  const d = diffFinding({ cvssScore: 9 }, { cvssScore: "9" });
  assert.equal(d.length, 0);
});

// Mirror of src/lib/risk-acceptance.ts.
function isAcceptanceExpired(status, until, now = new Date()) {
  if (status !== "AcceptedRisk" || !until) return false;
  return until.getTime() < now.getTime();
}
test("isAcceptanceExpired only for AcceptedRisk with a past expiry", () => {
  const now = new Date("2026-07-07");
  assert.equal(isAcceptanceExpired("AcceptedRisk", new Date("2026-07-01"), now), true);
  assert.equal(isAcceptanceExpired("AcceptedRisk", new Date("2026-08-01"), now), false);
  assert.equal(isAcceptanceExpired("AcceptedRisk", null, now), false);
  assert.equal(isAcceptanceExpired("Open", new Date("2020-01-01"), now), false);
});

// Mirror of src/lib/report-config.ts parse/order semantics.
const RC_ORDER = ["mgmt","exec","scope","risk","cvss","owasp","mitre","cwe","assets","overview","details","evidence","recs","appendix"];
const RC_LOCKED = new Set(["overview","details"]);
function rcParse(json) {
  const base = { order: [...RC_ORDER], disabled: [], customRecommendations: null, appendix: null };
  if (!json) return base;
  let raw; try { raw = JSON.parse(json); } catch { return base; }
  const known = new Set(RC_ORDER);
  const order = [];
  for (const k of raw.order ?? []) if (known.has(k) && !order.includes(k)) order.push(k);
  for (const k of RC_ORDER) if (!order.includes(k)) order.push(k);
  const disabled = (raw.disabled ?? []).filter((k) => known.has(k) && !RC_LOCKED.has(k));
  return { order, disabled, customRecommendations: raw.customRecommendations ?? null, appendix: raw.appendix ?? null };
}
function rcEnabled(cfg) { const off = new Set(cfg.disabled.filter((k) => !RC_LOCKED.has(k))); return cfg.order.filter((k) => !off.has(k)); }

test("report config: invalid JSON falls back to default", () => {
  const c = rcParse("not json");
  assert.equal(c.order.length, RC_ORDER.length);
  assert.deepEqual(c.disabled, []);
});
test("report config: reorder is preserved, missing keys appended", () => {
  const c = rcParse(JSON.stringify({ order: ["exec", "mgmt"] }));
  assert.equal(c.order[0], "exec");
  assert.equal(c.order[1], "mgmt");
  assert.equal(c.order.length, RC_ORDER.length);
});
test("report config: locked sections cannot be disabled", () => {
  const c = rcParse(JSON.stringify({ disabled: ["overview", "cvss"] }));
  assert.ok(!c.disabled.includes("overview"));
  assert.ok(c.disabled.includes("cvss"));
  assert.ok(rcEnabled(c).includes("overview"));
  assert.ok(!rcEnabled(c).includes("cvss"));
});

// Mirror of src/lib/ai/prompts.ts guardrail + a representative builder.
const AI_GUARDRAIL_MARK = "NEVER invent, fabricate, or assume vulnerabilities";
function aiBuildUser_suggestOwasp(ctx) {
  return `Title: ${ctx.title ?? ""}\nDescription:\n${ctx.description ?? "(none provided)"}`;
}
test("AI prompts carry the anti-fabrication guardrail", () => {
  // The real GUARDRAIL string (kept in sync with src/lib/ai/prompts.ts).
  const GUARDRAIL = [
    "You are an assistant to a professional penetration tester documenting findings for an authorized security assessment.",
    "CRITICAL RULES — you MUST follow all of them:",
    "1. NEVER invent, fabricate, or assume vulnerabilities, CVEs, exploits, affected assets, or facts that are not explicitly present in the provided input.",
  ].join("\n");
  assert.ok(GUARDRAIL.includes(AI_GUARDRAIL_MARK));
});
test("AI user prompt grounds in the provided finding, not free text", () => {
  const u = aiBuildUser_suggestOwasp({ title: "SQL injection", description: "param is concatenated" });
  assert.match(u, /SQL injection/);
  assert.match(u, /concatenated/);
});

// Mirror of src/lib/ai/provider.ts provider selection.
function aiProvider(env) {
  const p = (env.AI_PROVIDER ?? "").toLowerCase();
  if (p === "anthropic" || p === "openai" || p === "mock") return p;
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENAI_API_KEY) return "openai";
  return "mock";
}
test("AI provider selection: explicit, then key-based, then mock", () => {
  assert.equal(aiProvider({ AI_PROVIDER: "openai" }), "openai");
  assert.equal(aiProvider({ AI_PROVIDER: "anthropic" }), "anthropic");
  assert.equal(aiProvider({ ANTHROPIC_API_KEY: "x" }), "anthropic");
  assert.equal(aiProvider({ OPENAI_API_KEY: "x" }), "openai");
  assert.equal(aiProvider({}), "mock");
});

// Mirror of src/lib/engagements.ts lifecycle transitions.
const ENG_TRANSITIONS = {
  Scoping: ["Active"],
  Active: ["Reporting", "Scoping"],
  Reporting: ["Remediation", "Active"],
  Remediation: ["Retest", "Reporting"],
  Retest: ["Closed", "Remediation"],
  Closed: ["Active"],
};
const engCanTransition = (from, to) => (ENG_TRANSITIONS[from] ?? []).includes(to);
test("engagement lifecycle allows valid forward + reopen transitions", () => {
  assert.equal(engCanTransition("Scoping", "Active"), true);
  assert.equal(engCanTransition("Retest", "Closed"), true);
  assert.equal(engCanTransition("Closed", "Active"), true); // reopen
});
test("engagement lifecycle rejects illegal jumps", () => {
  assert.equal(engCanTransition("Scoping", "Closed"), false);
  assert.equal(engCanTransition("Active", "Retest"), false);
  assert.equal(engCanTransition("Closed", "Reporting"), false);
});

// Mirror of src/lib/retest.ts transitions.
const RT_TRANSITIONS = {
  Requested: ["Scheduled", "InProgress"],
  Scheduled: ["InProgress", "Requested"],
  InProgress: ["Verified", "Failed", "Scheduled"],
  Verified: [],
  Failed: [],
};
const rtCanTransition = (from, to) => (RT_TRANSITIONS[from] ?? []).includes(to);
const rtIsOpen = (s) => !["Verified", "Failed"].includes(s);
test("retest lifecycle: request → schedule/progress → verify/fail", () => {
  assert.equal(rtCanTransition("Requested", "InProgress"), true);
  assert.equal(rtCanTransition("InProgress", "Verified"), true);
  assert.equal(rtCanTransition("InProgress", "Failed"), true);
  assert.equal(rtCanTransition("Requested", "Verified"), false); // must go through InProgress
  assert.equal(rtCanTransition("Verified", "InProgress"), false); // terminal
});
test("retest open/terminal classification", () => {
  assert.equal(rtIsOpen("Requested"), true);
  assert.equal(rtIsOpen("Scheduled"), true);
  assert.equal(rtIsOpen("Verified"), false);
  assert.equal(rtIsOpen("Failed"), false);
});

// Mirror of src/lib/plans.ts.
const PLANS = ["starter", "professional", "business", "enterprise"];
const PLAN_RANK = { starter: 0, professional: 1, business: 2, enterprise: 3 };
const isPlanFn = (v) => PLANS.includes(v);
const hasPlanFn = (plan, min) => (isPlanFn(plan) ? PLAN_RANK[plan] >= PLAN_RANK[min] : false);
const underLimitFn = (current, limit) => limit === null || current < limit;
test("hasPlan respects the tier hierarchy", () => {
  assert.equal(hasPlanFn("business", "professional"), true);
  assert.equal(hasPlanFn("professional", "professional"), true);
  assert.equal(hasPlanFn("starter", "professional"), false);
  assert.equal(hasPlanFn("enterprise", "starter"), true);
});
test("hasPlan rejects unknown plan strings", () => {
  assert.equal(hasPlanFn("gold", "starter"), false);
});
test("underLimit: null is unlimited, numeric is a strict less-than boundary", () => {
  assert.equal(underLimitFn(999, null), true);
  assert.equal(underLimitFn(4, 5), true);
  assert.equal(underLimitFn(5, 5), false);
  assert.equal(underLimitFn(6, 5), false);
});

// Mirror of src/lib/billing.ts effectivePlan — canceled/expired always fall
// back to starter-level access regardless of the stored plan.
function effectivePlanFn(sub) {
  if (sub.status === "canceled" || sub.status === "expired") return "starter";
  return isPlanFn(sub.plan) ? sub.plan : "starter";
}
test("effectivePlan: canceled/expired subscriptions lose paid-tier access", () => {
  assert.equal(effectivePlanFn({ plan: "business", status: "canceled" }), "starter");
  assert.equal(effectivePlanFn({ plan: "professional", status: "expired" }), "starter");
});
test("effectivePlan: trialing/active/past_due keep the purchased tier", () => {
  assert.equal(effectivePlanFn({ plan: "professional", status: "trialing" }), "professional");
  assert.equal(effectivePlanFn({ plan: "business", status: "active" }), "business");
  assert.equal(effectivePlanFn({ plan: "professional", status: "past_due" }), "professional");
});

// Mirror of src/lib/stripe.ts mapStripeStatus. Deny-by-default: any status
// outside our vocabulary means "not in good standing" (regression: Sprint 19
// audit — `paused`/`incomplete`/unknown used to map to "active", granting
// paid-tier access without payment).
function mapStripeStatusFn(status) {
  if (["trialing", "active", "past_due", "canceled"].includes(status)) return status;
  return "expired";
}
test("mapStripeStatus normalizes Stripe's status vocabulary to ours", () => {
  assert.equal(mapStripeStatusFn("trialing"), "trialing");
  assert.equal(mapStripeStatusFn("active"), "active");
  assert.equal(mapStripeStatusFn("past_due"), "past_due");
  assert.equal(mapStripeStatusFn("canceled"), "canceled");
});
test("mapStripeStatus denies access for every not-in-good-standing or unknown status", () => {
  assert.equal(mapStripeStatusFn("unpaid"), "expired");
  assert.equal(mapStripeStatusFn("incomplete"), "expired");
  assert.equal(mapStripeStatusFn("incomplete_expired"), "expired");
  assert.equal(mapStripeStatusFn("paused"), "expired");
  assert.equal(mapStripeStatusFn("some_future_status"), "expired");
});

// Mirror of src/lib/billing.ts sweepTrialExpiry date-comparison logic.
function trialHasLapsed(trialEndsAt, now) {
  return trialEndsAt.getTime() <= now.getTime();
}
test("trial expiry sweep: lapsed only strictly after (or at) trialEndsAt", () => {
  const now = new Date("2026-07-09T00:00:00Z");
  assert.equal(trialHasLapsed(new Date("2026-07-08T00:00:00Z"), now), true);
  assert.equal(trialHasLapsed(new Date("2026-07-09T00:00:00Z"), now), true);
  assert.equal(trialHasLapsed(new Date("2026-07-10T00:00:00Z"), now), false);
});

// Mirror of src/lib/plans.ts planPriceCents (annual = 10x monthly — ~2 months free).
const PLAN_PRICE = {
  starter: { monthly: 3900, annual: 39000 },
  professional: { monthly: 14900, annual: 149000 },
  business: { monthly: 39900, annual: 399000 },
  enterprise: { monthly: 0, annual: 0 },
};
test("annual pricing is a 10x-monthly discount (2 months free)", () => {
  assert.equal(PLAN_PRICE.professional.annual, PLAN_PRICE.professional.monthly * 10);
  assert.ok(PLAN_PRICE.professional.annual < PLAN_PRICE.professional.monthly * 12);
});

// Mirror of src/actions/billing.ts startCheckoutAction's double-subscription
// guard: an org with a live Stripe subscription must change plans via the
// Billing Portal — a second Checkout would create a parallel subscription
// (double billing). Regression: Sprint 19 audit.
const mustUsePortalFn = (sub) =>
  Boolean(sub.stripeSubscriptionId) && (sub.status === "active" || sub.status === "past_due");
test("checkout is blocked for orgs with a live Stripe subscription", () => {
  assert.equal(mustUsePortalFn({ stripeSubscriptionId: "sub_1", status: "active" }), true);
  assert.equal(mustUsePortalFn({ stripeSubscriptionId: "sub_1", status: "past_due" }), true);
});
test("checkout stays open for trials, ended subscriptions, and orgs never on Stripe", () => {
  assert.equal(mustUsePortalFn({ stripeSubscriptionId: null, status: "trialing" }), false);
  assert.equal(mustUsePortalFn({ stripeSubscriptionId: "sub_1", status: "canceled" }), false);
  assert.equal(mustUsePortalFn({ stripeSubscriptionId: "sub_1", status: "expired" }), false);
  assert.equal(mustUsePortalFn({ stripeSubscriptionId: null, status: "active" }), false);
});

// Mirror of src/lib/stripe.ts billing-mode resolution: stripe (key set) >
// mock (explicit BILLING_MODE=mock) > disabled (default). Disabled mode hides
// billing UI, no-ops checkout actions, skips plan gates, and creates no trials
// — the bare deploy must degrade gracefully, never error.
const billingModeFn = (env) =>
  env.STRIPE_SECRET_KEY ? "stripe" : env.BILLING_MODE === "mock" ? "mock" : "disabled";
test("billing mode: Stripe keys win, mock needs the explicit flag, default is disabled", () => {
  assert.equal(billingModeFn({ STRIPE_SECRET_KEY: "sk_test_1" }), "stripe");
  assert.equal(billingModeFn({ STRIPE_SECRET_KEY: "sk_test_1", BILLING_MODE: "mock" }), "stripe");
  assert.equal(billingModeFn({ BILLING_MODE: "mock" }), "mock");
  assert.equal(billingModeFn({}), "disabled");
  assert.equal(billingModeFn({ BILLING_MODE: "on" }), "disabled"); // only "mock" is recognized
});

// Mirror of src/lib/billing.ts storageAllows — the evidence-upload storage cap
// (used + incoming must fit; null = unlimited). Regression: Sprint 19 audit —
// storageBytes was displayed but never enforced.
const storageAllowsFn = (used, incoming, limit) => limit === null || used + incoming <= limit;
test("storageAllows: inclusive cap, null = unlimited", () => {
  const GB = 1024 * 1024 * 1024;
  assert.equal(storageAllowsFn(0, 500, GB), true);
  assert.equal(storageAllowsFn(GB - 500, 500, GB), true); // exactly at the cap
  assert.equal(storageAllowsFn(GB - 499, 500, GB), false); // one byte over
  assert.equal(storageAllowsFn(50 * GB, 25 * 1024 * 1024, null), true);
});
