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
