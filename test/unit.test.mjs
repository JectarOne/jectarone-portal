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
