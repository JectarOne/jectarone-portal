// Deterministic seed for local dev + Playwright E2E.
// Mirrors production shape: multiple orgs, RBAC roles, assessments, findings of
// every severity, assets, evidence, comments, and activity history.
//
// Credentials (all share the same password): Passw0rd!123
//   Northwind Corp (slug: northwind)
//     admin@northwind.test       OWNER   (admin)
//     consultant@northwind.test  MEMBER  (Security Analyst)
//     client@northwind.test      CLIENT  (read-only)
//   Globex Inc (slug: globex)  — isolation target
//     admin@globex.test          OWNER
//
// Run: npm run db:seed   (requires DATABASE_URL + a migrated database)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Passw0rd!123";

const SLA_DAYS = { Critical: 7, High: 30, Medium: 60, Low: 90, Informational: null };
function dueFrom(severity, from = new Date()) {
  const d = SLA_DAYS[severity];
  if (d == null) return null;
  const x = new Date(from);
  x.setUTCDate(x.getUTCDate() + d);
  return x;
}
function daysAgo(n) {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() - n);
  return x;
}

async function wipe() {
  // Delete in FK-safe order (children first).
  await prisma.activityLog.deleteMany();
  await prisma.findingComment.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.report.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await wipe();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ---- Users ----
  const admin = await prisma.user.create({ data: { name: "Aya Benali", email: "admin@northwind.test", passwordHash, emailVerifiedAt: new Date() } });
  const consultant = await prisma.user.create({ data: { name: "Karim Idrissi", email: "consultant@northwind.test", passwordHash, emailVerifiedAt: new Date() } });
  const client = await prisma.user.create({ data: { name: "Sofia Client", email: "client@northwind.test", passwordHash, emailVerifiedAt: new Date() } });
  const globexAdmin = await prisma.user.create({ data: { name: "Otto Globex", email: "admin@globex.test", passwordHash, emailVerifiedAt: new Date() } });

  // ---- Orgs + memberships ----
  const northwind = await prisma.organization.create({ data: { name: "Northwind Corp", slug: "northwind" } });
  const globex = await prisma.organization.create({ data: { name: "Globex Inc", slug: "globex" } });

  await prisma.membership.createMany({
    data: [
      { userId: admin.id, organizationId: northwind.id, role: "OWNER" },
      { userId: consultant.id, organizationId: northwind.id, role: "MEMBER" },
      { userId: client.id, organizationId: northwind.id, role: "CLIENT" },
      { userId: globexAdmin.id, organizationId: globex.id, role: "OWNER" },
    ],
  });

  // ---- Assets (Northwind) ----
  const assetTypes = [
    ["Primary web app", "URL", "https://app.northwind.test"],
    ["Corporate DC", "ActiveDirectory", "dc01.northwind.local"],
    ["Public API", "API", "api.northwind.test"],
    ["Edge firewall", "Server", "10.0.0.1"],
  ];
  const assets = [];
  for (const [name, type, identifier] of assetTypes) {
    assets.push(await prisma.asset.create({
      data: { organizationId: northwind.id, name, type, identifier, createdById: consultant.id },
    }));
  }

  // ---- Assessments (Northwind) ----
  const aWeb = await prisma.assessment.create({
    data: {
      id: "nw-web", // stable id for E2E navigation / RBAC tests
      organizationId: northwind.id, clientName: "Northwind Corp", type: "Web", status: "InProgress",
      scope: "External web application and public API.", leadConsultant: "Karim Idrissi",
      executiveSummary: "Assessment of the customer-facing web application and its supporting API.",
      startDate: daysAgo(20), createdById: consultant.id,
    },
  });
  const aNet = await prisma.assessment.create({
    data: {
      organizationId: northwind.id, clientName: "Northwind Corp", type: "Network", status: "Delivered",
      scope: "Internal network and Active Directory.", leadConsultant: "Karim Idrissi",
      startDate: daysAgo(60), endDate: daysAgo(40), createdById: consultant.id,
    },
  });
  const aDraft = await prisma.assessment.create({
    data: {
      organizationId: northwind.id, clientName: "Northwind Corp", type: "Cloud", status: "Draft",
      scope: "AWS account review.", createdById: consultant.id,
    },
  });
  const aArchived = await prisma.assessment.create({
    data: {
      organizationId: northwind.id, clientName: "Northwind Corp", type: "ISO27001", status: "Delivered",
      scope: "Legacy ISO gap analysis.", archivedAt: daysAgo(5), createdById: admin.id,
    },
  });

  // Globex assessment (isolation)
  const gWeb = await prisma.assessment.create({
    data: { id: "gx-web", organizationId: globex.id, clientName: "Globex Inc", type: "Web", status: "InProgress", scope: "Globex portal.", createdById: globexAdmin.id },
  });

  // ---- Findings of every severity (Northwind, on aWeb) ----
  const findingSpecs = [
    { severity: "Critical", likelihood: "VeryHigh", impact: "VeryHigh", status: "Open", title: "SQL injection in login form",
      cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-89", owaspCategory: "A03 Injection", mitreTechnique: "T1190", affectedAsset: "https://app.northwind.test/login", affectedAssetType: "URL" },
    { severity: "High", likelihood: "High", impact: "High", status: "InProgress", title: "Broken access control on report export",
      cvssScore: 8.1, cwe: "CWE-284", owaspCategory: "A01 Broken Access Control", affectedAsset: "api.northwind.test" },
    { severity: "Medium", likelihood: "Medium", impact: "Medium", status: "ReadyForValidation", title: "Missing security headers",
      cvssScore: 5.3, cwe: "CWE-693", owaspCategory: "A05 Security Misconfiguration", affectedAsset: "https://app.northwind.test" },
    { severity: "Low", likelihood: "Low", impact: "Low", status: "Resolved", title: "Verbose error messages",
      cvssScore: 3.1, cwe: "CWE-209", owaspCategory: "A09 Logging Failures" },
    { severity: "Informational", likelihood: "VeryLow", impact: "VeryLow", status: "FalsePositive", title: "Server banner discloses version",
      cvssScore: 0, cwe: "CWE-200" },
  ];
  const findings = [];
  for (const s of findingSpecs) {
    const created = daysAgo(15);
    const f = await prisma.finding.create({
      data: {
        organizationId: northwind.id, assessmentId: aWeb.id,
        title: s.title, description: `Detailed description for: ${s.title}.`,
        technicalDetails: "Reproduction steps and payloads recorded during testing.",
        businessImpact: "Impact assessed against the asset's role.",
        remediation: "Apply the recommended fix and re-test.",
        severity: s.severity, likelihood: s.likelihood, impact: s.impact, status: s.status,
        cvssScore: s.cvssScore ?? null, cvssVector: s.cvssVector ?? null,
        cwe: s.cwe ?? null, owaspCategory: s.owaspCategory ?? null, mitreTechnique: s.mitreTechnique ?? null,
        affectedAsset: s.affectedAsset ?? null, affectedAssetType: s.affectedAssetType ?? null,
        assetId: assets[0].id,
        createdById: consultant.id, assigneeId: consultant.id, assignedById: admin.id, assignedAt: created,
        dueDate: dueFrom(s.severity, created), createdAt: created,
        resolvedAt: s.status === "Resolved" ? daysAgo(2) : null,
      },
    });
    findings.push(f);
    await prisma.activityLog.create({
      data: { organizationId: northwind.id, userId: consultant.id, action: "finding.created", detail: s.title, assessmentId: aWeb.id, findingId: f.id, createdAt: created },
    });
  }

  // An overdue open finding (past due date, not closed)
  const overdue = await prisma.finding.create({
    data: {
      organizationId: northwind.id, assessmentId: aWeb.id, title: "Outdated TLS configuration (overdue)",
      severity: "High", likelihood: "High", impact: "Medium", status: "Open",
      cvssScore: 7.4, cwe: "CWE-327", owaspCategory: "A02 Cryptographic Failures",
      assigneeId: consultant.id, dueDate: daysAgo(3), createdAt: daysAgo(45),
    },
  });
  findings.push(overdue);

  // ---- Evidence (metadata; storageKey null → app renders metadata-only) ----
  await prisma.evidence.create({
    data: { organizationId: northwind.id, findingId: findings[0].id, filename: "sqli-poc.png", mimeType: "image/png", sizeBytes: 82000, note: "Proof-of-concept screenshot.", uploadedById: consultant.id },
  });
  await prisma.evidence.create({
    data: { organizationId: northwind.id, findingId: findings[0].id, filename: "request.txt", mimeType: "text/plain", sizeBytes: 1200, note: "Raw HTTP request.", uploadedById: consultant.id },
  });

  // ---- Comments ----
  await prisma.findingComment.create({
    data: { organizationId: northwind.id, findingId: findings[0].id, authorId: consultant.id, body: "Confirmed exploitable. Recommend parameterized queries. cc @admin", createdAt: daysAgo(14) },
  });
  await prisma.findingComment.create({
    data: { organizationId: northwind.id, findingId: findings[0].id, authorId: admin.id, body: "Prioritized as **Critical**. Please schedule the fix this sprint.", createdAt: daysAgo(13) },
  });
  await prisma.activityLog.create({
    data: { organizationId: northwind.id, userId: consultant.id, action: "comment.added", assessmentId: aWeb.id, findingId: findings[0].id, createdAt: daysAgo(14) },
  });

  // A couple of Globex findings (isolation target)
  await prisma.finding.create({
    data: { id: "gx-secret", organizationId: globex.id, assessmentId: gWeb.id, title: "GLOBEX-ONLY secret finding", severity: "Critical", likelihood: "High", impact: "High", status: "Open", createdById: globexAdmin.id },
  });

  // ---- Report audit row ----
  await prisma.report.create({
    data: { organizationId: northwind.id, assessmentId: aNet.id, title: "Northwind Corp — Security Assessment Report", findingCount: 0, generatedById: consultant.id, createdAt: daysAgo(40) },
  });

  const counts = {
    users: await prisma.user.count(),
    orgs: await prisma.organization.count(),
    assessments: await prisma.assessment.count(),
    findings: await prisma.finding.count(),
    assets: await prisma.asset.count(),
    evidence: await prisma.evidence.count(),
    comments: await prisma.findingComment.count(),
    activity: await prisma.activityLog.count(),
  };
  console.log("Seed complete:", JSON.stringify(counts));
  console.log("Login with admin@northwind.test / " + PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
