import { test, expect } from "@playwright/test";

test.describe("ops: health endpoint", () => {
  test("GET /api/health reports ok with DB up (no auth required)", async ({ request }) => {
    const resp = await request.get("/api/health");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("ok");
    expect(typeof body.version).toBe("string");
    // No sensitive fields leak.
    expect(JSON.stringify(body)).not.toMatch(/secret|password|DATABASE_URL|token/i);
    expect(resp.headers()["cache-control"]).toContain("no-store");
  });
});
