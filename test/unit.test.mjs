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
