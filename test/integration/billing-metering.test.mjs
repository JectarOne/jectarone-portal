// AI-metering integration test — exercises the atomic quota reservation
// against real Postgres (requires `docker compose up -d`, like the storage
// suite). Regression: Sprint 19 audit — the original check-then-increment pair
// let concurrent requests all pass the check and overshoot the monthly limit.
// Run: npm run test:billing
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = `metering-test-${Date.now()}`;
let orgId;

// Mirror of src/lib/billing.ts reserveAiRequest (node:test can't import the TS
// module — same mirroring convention as test/unit.test.mjs). What matters is
// that the limit check and the increment are ONE conditional UPDATE.
async function reserve(organizationId, period, limit) {
  await prisma.usageCounter.createMany({ data: [{ organizationId, period }], skipDuplicates: true });
  const r = await prisma.usageCounter.updateMany({
    where: { organizationId, period, ...(limit === null ? {} : { aiRequests: { lt: limit } }) },
    data: { aiRequests: { increment: 1 } },
  });
  return r.count === 1;
}

before(async () => {
  const org = await prisma.organization.create({ data: { name: "Metering Test Org", slug: SLUG } });
  orgId = org.id;
});

after(async () => {
  await prisma.organization.delete({ where: { id: orgId } }); // cascades UsageCounter
  await prisma.$disconnect();
});

test("concurrent reservations never overshoot the monthly limit", async () => {
  const LIMIT = 5;
  const results = await Promise.all(
    Array.from({ length: 25 }, () => reserve(orgId, "2099-01", LIMIT))
  );
  const granted = results.filter(Boolean).length;
  assert.equal(granted, LIMIT, `exactly ${LIMIT} of 25 concurrent requests may pass`);

  const counter = await prisma.usageCounter.findUnique({
    where: { organizationId_period: { organizationId: orgId, period: "2099-01" } },
  });
  assert.equal(counter.aiRequests, LIMIT, "counter records exactly the limit, no overshoot");
});

test("null limit (unlimited plans) always reserves", async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () => reserve(orgId, "2099-02", null))
  );
  assert.equal(results.every(Boolean), true);
  const counter = await prisma.usageCounter.findUnique({
    where: { organizationId_period: { organizationId: orgId, period: "2099-02" } },
  });
  assert.equal(counter.aiRequests, 10);
});

test("concurrent first-of-month counter creation does not throw (P2002 race)", async () => {
  // 10 racers on a period that has no row yet — the old findUnique-then-create
  // pattern 500'd for the losers of the insert race.
  const results = await Promise.all(
    Array.from({ length: 10 }, () => reserve(orgId, "2099-03", 100))
  );
  assert.equal(results.every(Boolean), true);
});
